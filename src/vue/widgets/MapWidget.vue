<script setup lang="ts">
import { inject, nextTick, onBeforeUnmount, ref, toRef } from 'vue';
import type { GeoBounds, MapParams, MapPoint, SearchResult } from '../../types/search';
import LoadingState from '../components/LoadingState.vue';
import { type DashboardApi, dashboardKey } from '../composables/useDashboard';
import { GOOGLE_MAPS_MAP_ID, loadGoogleMaps } from '../composables/useGoogleMaps';
import { useWidgetData } from '../composables/useWidgetData';

let maps: typeof google.maps;

const props = defineProps<{
	settings: {
		id: string;
		filter?: string;
	};
	active: boolean;
}>();

const dashboard = inject<DashboardApi>(dashboardKey)!;
const locationField = 'location';

const mapEl = ref<HTMLDivElement | null>(null);
let map: google.maps.Map | null = null;
let bounds: google.maps.LatLngBounds | null = null;
let boundsB: google.maps.LatLngBounds | null = null;
let markers: Array<google.maps.marker.AdvancedMarkerElement | google.maps.Rectangle> = [];
let factor = 1.0;
let boundsUpdateTimeout: ReturnType<typeof setTimeout> | null = null;

const loading = ref(true);
const empty = ref(false);

function toBounds(result: Partial<GeoBounds>): google.maps.LatLngBounds {
	if (result.lat_min !== undefined) {
		const sw = new maps.LatLng(result.lat_min, result.lon_min!);
		const ne = new maps.LatLng(result.lat_max!, result.lon_max!);
		return new maps.LatLngBounds(sw, ne);
	}
	return new maps.LatLngBounds();
}

function drawConstraintBounds(constraints: Array<{ value: string }>, lineColor: string) {
	if (!map) return;
	constraints.forEach((constraint) => {
		const c = constraint.value.split(',');
		if (c.length === 4) {
			const sw = new maps.LatLng(parseFloat(c[0]), parseFloat(c[1]));
			const ne = new maps.LatLng(parseFloat(c[2]), parseFloat(c[3]));
			new maps.Rectangle({
				strokeColor: lineColor,
				strokeOpacity: 0.8,
				strokeWeight: 2,
				fillOpacity: 0,
				map,
				bounds: new maps.LatLngBounds(sw, ne),
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
	label.className = 'mdi mdi-filter';
	control.appendChild(label);
	control.addEventListener('click', () => {
		if (map) {
			dashboard.addConstraint(locationField, map.getBounds()!.toUrlValue(3), true);
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
	const requests: Promise<SearchResult>[] = [dashboard.search([pointsParams])];
	if (dashboard.constraintsB.value.length > 0) {
		requests.push(dashboard.searchB([pointsParams]));
	}
	const responses = await Promise.all(requests);
	const points = (responses[0][props.settings.id] as MapPoint[]) || [];
	const pointsB = (responses[1]?.[props.settings.id] as MapPoint[]) || [];
	addPoints(points, pointsB);
}

function clearMarkers() {
	markers.forEach((marker) => {
		if (marker instanceof maps.Rectangle) {
			marker.setMap(null);
		} else {
			marker.map = null;
		}
	});
	markers = [];
}

function createDot(color: string, count: number): HTMLDivElement {
	const dot = document.createElement('div');
	dot.style.width = '10px';
	dot.style.height = '10px';
	dot.style.borderRadius = '50%';
	dot.style.backgroundColor = color;
	dot.style.opacity = String(1 - 1 / (count + 1));
	return dot;
}

function addPoints(points: MapPoint[], pointsB: MapPoint[]) {
	clearMarkers();

	if (!map || (!points.length && !pointsB.length)) return;

	points.forEach((point) => {
		const dot = createDot('rgb(47, 126, 216)', point.count);
		const marker = new maps.marker.AdvancedMarkerElement({
			position: { lat: point.lat, lng: point.lon },
			map,
			title: point.count + (point.count === 1 ? ' event' : ' events'),
			content: dot,
		});
		markers.push(marker);

		const sw = new maps.LatLng(point.lat_min, point.lon_min);
		const ne = new maps.LatLng(point.lat_max, point.lon_max);
		const filterBounds = new maps.LatLngBounds(sw, ne);

		if (point.lat_min !== point.lat_max) {
			const rectOptions: Record<string, unknown> = {
				bounds: filterBounds,
				strokeWeight: 0,
				fillOpacity: 0,
				clickable: true,
				visible: true,
				map,
			};
			const filterRectangle = new maps.Rectangle(rectOptions);

			maps.event.addListener(filterRectangle, 'mouseover', () => {
				rectOptions.strokeWeight = 1;
				filterRectangle.setOptions(rectOptions);
			});
			maps.event.addListener(filterRectangle, 'mouseout', () => {
				rectOptions.strokeWeight = 0;
				filterRectangle.setOptions(rectOptions);
			});
			maps.event.addListener(filterRectangle, 'click', () => {
				dashboard.addConstraint(locationField, filterBounds.toUrlValue(6), true);
			});
			dot.style.cursor = 'pointer';
			dot.addEventListener('click', () => {
				dashboard.addConstraint(locationField, filterBounds.toUrlValue(6), true);
			});
			markers.push(filterRectangle);
		}
	});

	pointsB.forEach((point) => {
		const marker = new maps.marker.AdvancedMarkerElement({
			position: { lat: point.lat, lng: point.lon },
			map,
			title: point.count + (point.count === 1 ? ' event' : ' events'),
			content: createDot('rgb(204, 102, 0)', point.count),
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

	const mapOptions: google.maps.MapOptions = {
		mapId: GOOGLE_MAPS_MAP_ID,
		mapTypeId: maps.MapTypeId.ROADMAP,
		streetViewControl: false,
		mapTypeControlOptions: {
			style: maps.MapTypeControlStyle.DROPDOWN_MENU,
		},
		minZoom: 1,
	};

	map = new maps.Map(mapEl.value, mapOptions);
	map.fitBounds(bounds!.union(boundsB!));

	maps.event.addListener(map, 'bounds_changed', () => {
		if (boundsUpdateTimeout) clearTimeout(boundsUpdateTimeout);
		boundsUpdateTimeout = setTimeout(() => {
			if (!map) return;
			const currentBounds = map.getBounds();
			if (currentBounds && currentBounds.toSpan().lat() !== 0) {
				const zoom = map.getZoom();
				if (zoom !== undefined) {
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
				}
				bounds = currentBounds;
				refreshPoints();
			}
		}, 1000);
	});

	drawConstraintBounds(dashboard.getConstraints(locationField), 'rgb(47, 126, 216)');
	drawConstraintBounds(dashboard.getConstraintsB(locationField), 'rgb(204, 102, 0)');
	map.controls[maps.ControlPosition.TOP_RIGHT].push(createFilterControl());
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

async function update(result: SearchResult, resultB?: SearchResult) {
	maps = await loadGoogleMaps();
	bounds = toBounds((result[props.settings.id] as GeoBounds) || {});
	boundsB = toBounds((resultB?.[props.settings.id] as GeoBounds) || {});
	loading.value = false;
	empty.value = false;
	nextTick(drawMap);
}

function init() {
	clearMarkers();
	map = null;
	bounds = null;
	boundsB = null;
	factor = 1.0;
	loading.value = true;
	empty.value = false;
}

onBeforeUnmount(() => {
	if (boundsUpdateTimeout) clearTimeout(boundsUpdateTimeout);
	clearMarkers();
});

const { failed } = useWidgetData(dashboard, toRef(props, 'active'), params, { init, update });
</script>

<template>
	<div>
		<div ref="mapEl" :id="settings.id + '-map'" style="height: 400px" v-show="!loading && !empty" />
		<LoadingState v-if="failed" state="failed" />
		<LoadingState v-else-if="loading" state="loading" />
		<LoadingState v-else-if="empty" state="empty" />
	</div>
</template>
