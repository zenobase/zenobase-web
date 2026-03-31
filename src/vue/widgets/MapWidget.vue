<script setup lang="ts">
import { inject, nextTick, onBeforeUnmount, onMounted, ref } from 'vue';
import type { GeoBounds, MapParams, MapPoint, SearchResult } from '../../types/search';
import { type DashboardApi, dashboardKey, type WidgetRegistration } from '../composables/useDashboard';

declare const google: {
	maps: {
		Map: new (el: HTMLElement, options: Record<string, unknown>) => GoogleMap;
		LatLng: new (lat: number, lng: number) => GoogleLatLng;
		LatLngBounds: new (sw?: GoogleLatLng, ne?: GoogleLatLng) => GoogleLatLngBounds;
		Marker: new (options: Record<string, unknown>) => GoogleMarker;
		Rectangle: new (options: Record<string, unknown>) => GoogleRectangle;
		SymbolPath: { CIRCLE: number };
		MapTypeId: { ROADMAP: string };
		MapTypeControlStyle: { DROPDOWN_MENU: string };
		ControlPosition: { TOP_RIGHT: number };
		event: {
			addListener(instance: unknown, event: string, handler: () => void): void;
			trigger(instance: unknown, event: string): void;
		};
	};
};

interface GoogleMap {
	fitBounds(bounds: GoogleLatLngBounds): void;
	getBounds(): GoogleLatLngBounds;
	getZoom(): number;
	controls: Record<number, { push(el: HTMLElement): void }>;
}

interface GoogleLatLng {
	lat(): number;
	lng(): number;
}

interface GoogleLatLngBounds {
	isEmpty(): boolean;
	union(other: GoogleLatLngBounds): GoogleLatLngBounds;
	getSouthWest(): GoogleLatLng;
	getNorthEast(): GoogleLatLng;
	toSpan(): GoogleLatLng;
	toUrlValue(precision: number): string;
}

interface GoogleMarker {
	setMap(map: GoogleMap | null): void;
}

interface GoogleRectangle {
	setMap(map: GoogleMap | null): void;
	setOptions(options: Record<string, unknown>): void;
}

const props = defineProps<{
	settings: {
		id: string;
		filter?: string;
	};
}>();

const dashboard = inject<DashboardApi>(dashboardKey)!;
const locationField = 'location';

const mapEl = ref<HTMLDivElement | null>(null);
let map: GoogleMap | null = null;
let bounds: GoogleLatLngBounds | null = null;
let boundsB: GoogleLatLngBounds | null = null;
let markers: Array<GoogleMarker | GoogleRectangle> = [];
let factor = 1.0;
let boundsUpdateTimeout: ReturnType<typeof setTimeout> | null = null;

const loading = ref(true);
const empty = ref(false);

function toBounds(result: Partial<GeoBounds>): GoogleLatLngBounds {
	if (result.lat_min !== undefined) {
		const sw = new google.maps.LatLng(result.lat_min, result.lon_min!);
		const ne = new google.maps.LatLng(result.lat_max!, result.lon_max!);
		return new google.maps.LatLngBounds(sw, ne);
	}
	return new google.maps.LatLngBounds();
}

function drawConstraintBounds(constraints: Array<{ value: string }>, lineColor: string) {
	if (!map) return;
	constraints.forEach((constraint) => {
		const c = constraint.value.split(',');
		if (c.length === 4) {
			const sw = new google.maps.LatLng(parseFloat(c[0]), parseFloat(c[1]));
			const ne = new google.maps.LatLng(parseFloat(c[2]), parseFloat(c[3]));
			new google.maps.Rectangle({
				strokeColor: lineColor,
				strokeOpacity: 0.8,
				strokeWeight: 2,
				fillOpacity: 0,
				map,
				bounds: new google.maps.LatLngBounds(sw, ne),
				clickable: false,
			});
		}
	});
}

function createFilterControl(): HTMLElement {
	const parent = document.createElement('div');
	parent.style.padding = '0 10px';
	const control = document.createElement('div');
	control.title = 'Filter bucket for events in this area';
	control.className = 'map-control';
	parent.appendChild(control);
	const label = document.createElement('i');
	label.className = 'fa fa-filter';
	control.appendChild(label);
	control.addEventListener('click', () => {
		if (map) {
			dashboard.addConstraint(locationField, map.getBounds().toUrlValue(3), true);
		}
	});
	return parent;
}

function getFilter(): string | undefined {
	let filter = props.settings.filter;
	if (bounds && !bounds.isEmpty()) {
		filter = filter ? filter + '|' : '';
		filter += 'location:' + [bounds.getSouthWest().lat(), bounds.getSouthWest().lng(), bounds.getNorthEast().lat(), bounds.getNorthEast().lng()].join(',');
	}
	return filter;
}

async function refreshPoints() {
	const pointsParams: MapParams & { field: string; factor: number } = {
		id: props.settings.id,
		type: 'map',
		field: 'location',
		factor,
		filter: getFilter(),
	};
	const result = await dashboard.search([pointsParams]);
	const points = (result[props.settings.id] as MapPoint[]) || [];
	addPoints(points, []);
}

function addPoints(points: MapPoint[], pointsB: MapPoint[]) {
	// Clear existing markers
	markers.forEach((marker) => {
		marker.setMap(null);
	});
	markers = [];

	if (!map || (!points.length && !pointsB.length)) return;

	points.forEach((point) => {
		const marker = new google.maps.Marker({
			position: new google.maps.LatLng(point.lat, point.lon),
			map,
			title: point.count + (point.count === 1 ? ' event' : ' events'),
			icon: {
				path: google.maps.SymbolPath.CIRCLE,
				fillOpacity: 1 - 1 / (point.count + 1),
				fillColor: 'rgb(47, 126, 216)',
				strokeWeight: 0,
				scale: 5,
			},
		});
		markers.push(marker);

		const sw = new google.maps.LatLng(point.lat_min, point.lon_min);
		const ne = new google.maps.LatLng(point.lat_max, point.lon_max);
		const filterBounds = new google.maps.LatLngBounds(sw, ne);

		if (point.lat_min !== point.lat_max) {
			const rectOptions: Record<string, unknown> = {
				bounds: filterBounds,
				strokeWeight: 0,
				fillOpacity: 0,
				clickable: true,
				visible: true,
				map,
			};
			const filterRectangle = new google.maps.Rectangle(rectOptions);

			google.maps.event.addListener(filterRectangle, 'mouseover', () => {
				rectOptions.strokeWeight = 1;
				filterRectangle.setOptions(rectOptions);
			});
			google.maps.event.addListener(filterRectangle, 'mouseout', () => {
				rectOptions.strokeWeight = 0;
				filterRectangle.setOptions(rectOptions);
			});
			google.maps.event.addListener(filterRectangle, 'click', () => {
				dashboard.addConstraint(locationField, filterBounds.toUrlValue(6), true);
			});
			google.maps.event.addListener(marker, 'click', () => {
				dashboard.addConstraint(locationField, filterBounds.toUrlValue(6), true);
			});
			markers.push(filterRectangle);
		}
	});

	pointsB.forEach((point) => {
		const marker = new google.maps.Marker({
			position: new google.maps.LatLng(point.lat, point.lon),
			map,
			title: point.count + (point.count === 1 ? ' event' : ' events'),
			icon: {
				path: google.maps.SymbolPath.CIRCLE,
				fillOpacity: 1 - 1 / (point.count + 1),
				fillColor: 'rgb(204, 102, 0)',
				strokeWeight: 0,
				scale: 5,
			},
		});
		markers.push(marker);
	});
}

function drawMap() {
	if ((!bounds || bounds.isEmpty()) && (!boundsB || boundsB.isEmpty())) {
		empty.value = true;
		return;
	}

	if (!mapEl.value) return;

	const mapOptions = {
		mapTypeId: google.maps.MapTypeId.ROADMAP,
		streetViewControl: false,
		mapTypeControlOptions: {
			style: google.maps.MapTypeControlStyle.DROPDOWN_MENU,
		},
		styles: [{ stylers: [{ saturation: -100 }] }],
		minZoom: 1,
	};

	map = new google.maps.Map(mapEl.value, mapOptions);
	map.fitBounds(bounds!.union(boundsB!));

	google.maps.event.addListener(map, 'bounds_changed', () => {
		if (boundsUpdateTimeout) clearTimeout(boundsUpdateTimeout);
		boundsUpdateTimeout = setTimeout(() => {
			if (!map) return;
			const currentBounds = map.getBounds();
			if (currentBounds.toSpan().lat() !== 0) {
				const zoom = map.getZoom();
				if (zoom <= 4) {
					factor = 1.0;
				} else if (zoom <= 7) {
					factor = 0.8;
				} else if (zoom <= 9) {
					factor = 0.6;
				} else if (zoom <= 12) {
					factor = 0.4;
				} else if (zoom <= 14) {
					factor = 0.2;
				} else {
					factor = 0.0;
				}
				bounds = currentBounds;
				refreshPoints();
			}
		}, 1000);
	});

	drawConstraintBounds(dashboard.getConstraints(locationField), 'rgb(47, 126, 216)');
	drawConstraintBounds(dashboard.getConstraintsB(locationField), 'rgb(204, 102, 0)');
	map.controls[google.maps.ControlPosition.TOP_RIGHT].push(createFilterControl());
}

function params(): MapParams {
	const filters: string[] = [];
	if (props.settings.filter) {
		filters.push(props.settings.filter);
	}
	return {
		id: props.settings.id,
		type: 'geobounds',
		filter: filters.join('|'),
	};
}

function update(result: SearchResult, resultB?: SearchResult) {
	bounds = toBounds((result[props.settings.id] as GeoBounds) || {});
	boundsB = toBounds((resultB?.[props.settings.id] as GeoBounds) || {});
	loading.value = false;
	empty.value = false;
	nextTick(drawMap);
}

function init() {
	// Clear existing markers
	markers.forEach((marker) => {
		marker.setMap(null);
	});
	markers = [];
	map = null;
	bounds = null;
	boundsB = null;
	factor = 1.0;
	loading.value = true;
	empty.value = false;
}

onBeforeUnmount(() => {
	if (boundsUpdateTimeout) clearTimeout(boundsUpdateTimeout);
	markers.forEach((marker) => {
		marker.setMap(null);
	});
});

const registration: WidgetRegistration = { params, update, init };
onMounted(() => dashboard.register(registration));
</script>

<template>
	<div>
		<div ref="mapEl" :id="settings.id + '-map'" style="height: 400px" v-show="!loading && !empty" />
		<p v-if="loading" class="none">Loading...</p>
		<p v-else-if="empty" class="none">None</p>
	</div>
</template>
