<script setup lang="ts">
import type { ECharts } from 'echarts/core';
import { inject, nextTick, onMounted, ref } from 'vue';
import type { FieldInfo, PolarEntry, PolarParams, SearchResult } from '../../types/search';
import { type DashboardApi, dashboardKey, type WidgetRegistration } from '../composables/useDashboard';
import { BRAND_BLUE_RGB } from '../plugins/vuetify';
import { downloadCsv, toFilename, unwrapValue } from './csv';
import EChartsChart from './EChartsChart.vue';

const props = defineProps<{
	settings: {
		id: string;
		label?: string;
		key_field?: string;
		value_field: string;
		unit?: string;
		interval: string;
		statistic?: string;
		mark?: string;
		filter?: string;
		placement?: string;
	};
	fieldLookup?: (name: string) => FieldInfo | undefined;
}>();

const defaultFieldInfo: FieldInfo = {
	toNumber: (v) => (typeof v === 'number' ? v : typeof v === 'object' && v !== null && '@value' in v ? (v as { '@value': number })['@value'] : Number(v)),
	toText: (v) => String(v ?? ''),
	formatAxis: () => {},
};

function findField(name: string): FieldInfo {
	return props.fieldLookup?.(name) ?? defaultFieldInfo;
}

const dashboard = inject<DashboardApi>(dashboardKey)!;
const keyField = 'timestamp';

const times = ref<PolarEntry[] | null>(null);
const timesB = ref<PolarEntry[]>([]);
const chartOptions = ref<Record<string, unknown> | null>(null);
const chartHeight = ref<number | undefined>();

/**
 * Based on https://stackoverflow.com/a/18070247/1144085
 */
function circularAvg(data: PolarEntry[]): number {
	const f = (2 * Math.PI) / data.length;
	let x = 0;
	let y = 0;
	data.forEach((time, i) => {
		x += time.count * Math.sin(f * i);
		y += time.count * Math.cos(f * i);
	});
	let z = Math.atan2(x, y);
	if (z < 0) {
		z += 2 * Math.PI;
	}
	return (Math.round((z / f) * 2) / 2) % data.length;
}

function filterByValue(value: string, negated?: boolean) {
	dashboard.addConstraint((props.settings.key_field || keyField) + '.' + props.settings.interval, value, true, negated);
}

function params(): PolarParams {
	return {
		id: props.settings.id,
		type: 'polar',
		key_field: props.settings.key_field || keyField,
		value_field: props.settings.value_field,
		unit: props.settings.unit,
		interval: props.settings.interval,
		filter: props.settings.filter,
	};
}

function update(result: SearchResult, resultB?: SearchResult) {
	times.value = (result[props.settings.id] as PolarEntry[]) || [];
	timesB.value = (resultB?.[props.settings.id] as PolarEntry[]) || [];
	nextTick(draw);
}

function init() {
	times.value = null;
	timesB.value = [];
	chartOptions.value = null;
}

function draw() {
	if (!times.value?.length && !timesB.value?.length) return;

	const field = findField(props.settings.value_field);
	const statistic = props.settings.statistic || 'count';

	const categories: string[] = [];
	const seriesAData: number[] = [];

	times.value?.forEach((time) => {
		const value = time[statistic];
		categories.push(time.label);
		seriesAData.push(value !== undefined ? field.toNumber(value) : 0);
	});

	const allSeries: Record<string, unknown>[] = [
		{
			type: 'bar',
			data: seriesAData,
			coordinateSystem: 'polar',
			name: statistic,
			barGap: '-100%',
			barCategoryGap: '0%',
			itemStyle: { color: `rgba(${BRAND_BLUE_RGB}, 0.4)`, borderColor: `rgba(${BRAND_BLUE_RGB}, 0.2)`, borderWidth: 1 },
		},
	];

	if (timesB.value?.length) {
		const seriesBData: number[] = [];
		timesB.value.forEach((time) => {
			const value = time[statistic];
			seriesBData.push(value !== undefined ? field.toNumber(value) : 0);
		});
		allSeries.push({
			type: 'bar',
			data: seriesBData,
			coordinateSystem: 'polar',
			name: statistic + '-B',
			barGap: '-100%',
			barCategoryGap: '0%',
			itemStyle: { color: 'rgba(204, 102, 0, 0.4)', borderColor: 'rgba(204, 102, 0, 0.2)', borderWidth: 1 },
		});
	}

	const markAreaData: Record<string, unknown>[][] = [];

	if (props.settings.mark === 'avg' && times.value?.length) {
		const avg = circularAvg(times.value);
		const from = avg - 0.5;
		const to = avg + 0.5;
		markAreaData.push([{ xAxis: from }, { xAxis: to }]);
		if (from < 0) {
			markAreaData.push([{ xAxis: times.value.length - 0.5 }, { xAxis: times.value.length }]);
		}
	}

	if (timesB.value?.length && props.settings.mark === 'avg') {
		const avgB = circularAvg(timesB.value);
		markAreaData.push([{ xAxis: avgB - 0.5 }, { xAxis: avgB + 0.5 }]);
	}

	const size = props.settings.placement === 'top' ? 150 : 350;
	chartHeight.value = size;

	const options: Record<string, unknown> = {
		animation: false,
		polar: { radius: '75%' },
		angleAxis: {
			type: 'category',
			data: categories,
			startAngle: 90 + 360 / (categories.length * 2),
			axisTick: { show: false },
			axisLine: { lineStyle: { color: '#ddd' } },
			splitLine: { show: true, lineStyle: { color: '#ddd' } },
		},
		radiusAxis: {
			axisLine: { show: false },
			axisTick: { show: false },
			splitLine: { show: true, lineStyle: { color: '#ddd' } },
			axisLabel: { show: false },
			min: field.minValue,
			max: field.maxValue,
		},
		tooltip: {
			trigger: 'item',
			formatter: (params: { name: string; value: number }) => {
				if (params?.value === undefined) return '';
				return '<b>' + params.name + '</b>: ' + (field.toText(params.value) || params.value) + (props.settings.unit || '');
			},
		},
		series: allSeries,
		legend: { show: false },
	};

	chartOptions.value = options;
}

const chartRef = ref<InstanceType<typeof EChartsChart> | null>(null);

function onChartReady(instance: ECharts) {
	instance.on('click', (params: unknown) => {
		const { dataIndex, seriesIndex } = params as { dataIndex?: number; seriesIndex?: number };
		if (dataIndex !== undefined) {
			const entries = seriesIndex === 1 ? timesB.value : times.value;
			if (entries?.[dataIndex]) {
				filterByValue(entries[dataIndex].value);
			}
		}
	});
}

function downloadCSV() {
	if (!times.value?.length) return;
	const statistic = props.settings.statistic || 'count';
	const unit = unwrapValue(times.value[0][statistic]).unit || props.settings.unit;
	const header = statistic + '_' + props.settings.value_field + (unit ? '_' + unit : '');
	const rows = [[props.settings.interval, header]];
	for (const time of times.value) {
		rows.push([time.value, unwrapValue(time[statistic]).value]);
	}
	downloadCsv(rows, `${toFilename(props.settings.label || props.settings.id)}.csv`);
}

defineExpose({
	reflow() {
		chartRef.value?.reflow();
	},
});

const registration: WidgetRegistration = { params, update, init };
onMounted(() => dashboard.register(registration));
</script>

<template>
	<div>
		<v-row v-show="times?.length || timesB?.length">
			<v-spacer />
			<div class="d-flex ga-1">
				<v-menu>
					<template #activator="{ props: menuProps }">
						<v-btn variant="text" size="small" class="xbtn" title="Filter" v-bind="menuProps"><v-icon icon="mdi-filter" size="small" /><v-icon icon="mdi-menu-down" size="small" /></v-btn>
					</template>
					<v-list>
						<v-list-item v-if="settings.interval === 'month_of_year'" @click="filterByValue('[1..3]')">Jan - Mar</v-list-item>
						<v-list-item v-if="settings.interval === 'month_of_year'" @click="filterByValue('[4..6]')">Apr - Jun</v-list-item>
						<v-list-item v-if="settings.interval === 'month_of_year'" @click="filterByValue('[7..9]')">Jul - Sep</v-list-item>
						<v-list-item v-if="settings.interval === 'month_of_year'" @click="filterByValue('[10..12]')">Oct - Dec</v-list-item>
						<v-divider v-if="settings.interval === 'month_of_year'" />
						<v-list-item v-if="settings.interval === 'month_of_year'" @click="filterByValue('[4..9]')">Apr - Sep</v-list-item>
						<v-list-item v-if="settings.interval === 'month_of_year'" @click="filterByValue('[4..9]', true)">Oct - Mar</v-list-item>
						<v-list-item v-if="settings.interval === 'day_of_month'" @click="filterByValue('[1..16)')">1st - 15th</v-list-item>
						<v-list-item v-if="settings.interval === 'day_of_month'" @click="filterByValue('[16..*)')">16th - 31st</v-list-item>
						<v-list-item v-if="settings.interval === 'day_of_week'" @click="filterByValue('[1..5]')">Mon - Fri</v-list-item>
						<v-list-item v-if="settings.interval === 'day_of_week'" @click="filterByValue('[6..7]')">Sat - Sun</v-list-item>
						<v-list-item v-if="settings.interval === 'hour_of_day'" @click="filterByValue('[0..12)')">0h - 12h</v-list-item>
						<v-list-item v-if="settings.interval === 'hour_of_day'" @click="filterByValue('[12..*)')">12h - 24h</v-list-item>
						<v-divider v-if="settings.interval === 'hour_of_day'" />
						<v-list-item v-if="settings.interval === 'hour_of_day'" @click="filterByValue('[0..3)')">0h - 3h</v-list-item>
						<v-list-item v-if="settings.interval === 'hour_of_day'" @click="filterByValue('[3..6)')">3h - 6h</v-list-item>
						<v-list-item v-if="settings.interval === 'hour_of_day'" @click="filterByValue('[6..9)')">6h - 9h</v-list-item>
						<v-list-item v-if="settings.interval === 'hour_of_day'" @click="filterByValue('[9..12)')">9h - 12h</v-list-item>
						<v-list-item v-if="settings.interval === 'hour_of_day'" @click="filterByValue('[12..15)')">12h - 15h</v-list-item>
						<v-list-item v-if="settings.interval === 'hour_of_day'" @click="filterByValue('[15..18)')">15h - 18h</v-list-item>
						<v-list-item v-if="settings.interval === 'hour_of_day'" @click="filterByValue('[18..21)')">18h - 21h</v-list-item>
						<v-list-item v-if="settings.interval === 'hour_of_day'" @click="filterByValue('[21..*)')">21h - 24h</v-list-item>
					</v-list>
				</v-menu>
				<v-btn variant="text" size="small" class="xbtn" title="Download" @click="downloadCSV"><v-icon icon="mdi-download" size="small" /></v-btn>
				<v-btn variant="text" size="small" class="xbtn" title="Snapshot" @click="chartRef?.snapshot()"><v-icon icon="mdi-camera" size="small" /></v-btn>
			</div>
		</v-row>
		<EChartsChart ref="chartRef" v-if="times?.length || timesB?.length" :options="chartOptions" :height="chartHeight" @ready="onChartReady" />
		<p v-if="times === null" class="none">Loading...</p>
		<p v-else-if="times.length === 0 && timesB.length === 0" class="none">None</p>
	</div>
</template>
