<script setup lang="ts">
import { HeatmapLayer } from '@deck.gl/aggregation-layers';
import { GoogleMapsOverlay } from '@deck.gl/google-maps';
import { inject, nextTick, onBeforeUnmount, ref, toRef } from 'vue';
import type { GeoBounds, HeatmapParams, HeatmapPoint, SearchResult } from '../../types/search';
import LoadingState from '../components/LoadingState.vue';
import { type DashboardApi, dashboardKey } from '../composables/useDashboard';
import { GOOGLE_MAPS_MAP_ID, loadGoogleMaps } from '../composables/useGoogleMaps';
import { useWidgetData } from '../composables/useWidgetData';

let maps: typeof google.maps;

function fieldToNumber(value: unknown): number {
	if (typeof value === 'number') return value;
	if (typeof value === 'object' && value !== null && '@value' in value) return (value as { '@value': number })['@value'];
	return Number(value);
}

const props = defineProps<{
	settings: {
		id: string;
		value_field?: string;
		unit?: string;
		filter?: string;
	};
	active: boolean;
}>();

const dashboard = inject<DashboardApi>(dashboardKey)!;
const locationField = 'location';

const mapEl = ref<HTMLDivElement | null>(null);
let map: google.maps.Map | null = null;
let overlay: GoogleMapsOverlay | null = null;
let bounds: google.maps.LatLngBounds | null = null;
let boundsB: google.maps.LatLngBounds | null = null;
let precision = 8;
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
	const pointsParams: HeatmapParams = {
		id: props.settings.id,
		type: 'heatmap',
		precision,
		value_field: props.settings.value_field,
		unit: props.settings.unit,
		filter: getFilter(),
	};
	const requests: Promise<SearchResult>[] = [dashboard.search([pointsParams])];
	if (dashboard.constraintsB.value.length > 0) {
		requests.push(dashboard.searchB([pointsParams]));
	}
	const responses = await Promise.all(requests);
	const points = (responses[0][props.settings.id] as HeatmapPoint[]) || [];
	const pointsB = (responses[1]?.[props.settings.id] as HeatmapPoint[]) || [];
	addPoints(points, pointsB);
}

function addPoints(points: HeatmapPoint[], pointsB: HeatmapPoint[]) {
	if (!map || (!points.length && !pointsB.length)) return;

	const data: Array<{ position: number[]; weight: number }> = [];
	points.forEach((point) => {
		const weight = props.settings.value_field && points.length > 1 ? fieldToNumber(point.sum) : point.count;
		data.push({ position: [point.lon, point.lat], weight });
	});

	const dataB: Array<{ position: number[]; weight: number }> = [];
	pointsB.forEach((point) => {
		const weight = props.settings.value_field && pointsB.length > 1 ? fieldToNumber(point.sum) : point.count;
		dataB.push({ position: [point.lon, point.lat], weight });
	});

	const layers: HeatmapLayer[] = [];
	if (data.length) {
		layers.push(
			new HeatmapLayer({
				id: 'heatmap-primary',
				data,
				getPosition: (d: { position: number[] }) => d.position as [number, number],
				getWeight: (d: { weight: number }) => d.weight,
				radiusPixels: 20,
				opacity: 0.5,
				colorRange: [
					[0, 126, 216],
					[64, 126, 216],
					[128, 126, 216],
					[192, 126, 216],
					[255, 126, 216],
				],
			}),
		);
	}
	if (dataB.length) {
		layers.push(
			new HeatmapLayer({
				id: 'heatmap-secondary',
				data: dataB,
				getPosition: (d: { position: number[] }) => d.position as [number, number],
				getWeight: (d: { weight: number }) => d.weight,
				radiusPixels: 20,
				opacity: 0.5,
				colorRange: [
					[204, 103, 0],
					[204, 140, 0],
					[204, 180, 0],
					[204, 220, 0],
					[204, 255, 0],
				],
			}),
		);
	}

	overlay?.setProps({ layers });
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
				precision = Math.min(Math.ceil(map.getZoom()! / 3.0) + 3, 9);
				bounds = currentBounds;
				refreshPoints();
			}
		}, 1000);
	});

	overlay = new GoogleMapsOverlay({});
	overlay.setMap(map);
	drawConstraintBounds(dashboard.getConstraints(locationField), 'rgb(47, 126, 216)');
	drawConstraintBounds(dashboard.getConstraintsB(locationField), 'rgb(204, 102, 0)');
	map.controls[maps.ControlPosition.TOP_RIGHT].push(createFilterControl());
}

function params(): HeatmapParams {
	const filters: string[] = [];
	if (props.settings.filter) {
		filters.push(props.settings.filter);
	}
	if (props.settings.value_field) {
		filters.push(props.settings.value_field + ':*');
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
	map = null;
	overlay = null;
	bounds = null;
	boundsB = null;
	precision = 8;
	loading.value = true;
	empty.value = false;
}

onBeforeUnmount(() => {
	if (boundsUpdateTimeout) clearTimeout(boundsUpdateTimeout);
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
