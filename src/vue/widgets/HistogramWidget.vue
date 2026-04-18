<script setup lang="ts">
import type { ECharts } from 'echarts/core';
import { inject, nextTick, ref, toRef } from 'vue';
import type { HistogramInterval, HistogramParams, SearchResult } from '../../types/search';
import { compactDuration, compactNumber } from '../../utils/helpers';
import { type DashboardApi, dashboardKey } from '../composables/useDashboard';
import { useWidgetData } from '../composables/useWidgetData';
import { BRAND_BLUE_RGB } from '../plugins/vuetify';
import { downloadCsv, toFilename } from './csv';
import EChartsChart from './EChartsChart.vue';

const props = defineProps<{
	settings: {
		id: string;
		label?: string;
		field: string;
		interval: number;
		unit?: string;
		filter?: string;
		placement?: string;
	};
	formatFieldText?: (value: unknown, field: string) => string;
	active: boolean;
}>();

const dashboard = inject<DashboardApi>(dashboardKey)!;
const intervals = ref<HistogramInterval[] | null>(null);
const chartOptions = ref<Record<string, unknown> | null>(null);
const chartHeight = ref<number | undefined>();

function fieldToText(value: unknown): string {
	if (props.formatFieldText) return props.formatFieldText(value, props.settings.field);
	if (typeof value === 'object' && value !== null && '@value' in value) {
		const obj = value as { '@value': number; unit?: string };
		return obj.unit ? obj['@value'] + ' ' + obj.unit : String(obj['@value']);
	}
	if (props.settings.field.startsWith('duration') && typeof value === 'number') return compactDuration(value);
	return String(value ?? '');
}

function params(): HistogramParams {
	return {
		id: props.settings.id,
		type: 'histogram',
		field: props.settings.field,
		interval: props.settings.interval,
		unit: props.settings.unit,
		filter: props.settings.filter,
	};
}

function update(result: SearchResult) {
	intervals.value = (result[props.settings.id] as HistogramInterval[]) || [];
	nextTick(draw);
}

function init() {
	intervals.value = null;
	chartOptions.value = null;
}

function draw() {
	if (!intervals.value?.length) return;

	const height = Math.max(intervals.value.length * 20, 150);
	chartHeight.value = height;
	const categories = intervals.value.map((i) => `${fieldToText(i.from)}..${fieldToText(i.to)}`);
	const counts = intervals.value.map((i) => i.count);

	const options: Record<string, unknown> = {
		animation: false,
		grid: { left: 80, right: 20, top: 10, bottom: 30, height: height - 40 },
		xAxis: {
			type: 'value',
			axisLabel: { hideOverlap: true, formatter: compactNumber },
			splitLine: { show: false },
		},
		yAxis: {
			type: 'category',
			data: categories,
			axisTick: { show: false },
			inverse: true,
		},
		tooltip: {
			trigger: 'item',
			formatter: (params: { name: string; value: number }) => {
				if (params?.value === undefined) return '';
				return `<b>${params.name}</b>: ${params.value}`;
			},
		},
		series: [
			{
				name: 'count',
				type: 'bar',
				data: counts,
				barWidth: 10,
				itemStyle: {
					color: `rgba(${BRAND_BLUE_RGB}, 0.4)`,
					borderRadius: 5,
				},
			},
		],
		legend: { show: false },
	};

	chartOptions.value = options;
}

const chartRef = ref<InstanceType<typeof EChartsChart> | null>(null);

function onChartReady(instance: ECharts) {
	instance.on('click', (params: unknown) => {
		const { dataIndex } = params as { dataIndex?: number };
		if (dataIndex !== undefined && intervals.value) {
			const interval = intervals.value[dataIndex];
			const range = `[${fieldToText(interval.from)}..${fieldToText(interval.to)})`;
			dashboard.addConstraint(props.settings.field, range, true);
		}
	});
}

function downloadCSV() {
	if (!intervals.value?.length) return;
	const rows: string[][] = [[props.settings.field, 'count']];
	for (const interval of intervals.value) {
		rows.push([`[${fieldToText(interval.from)}..${fieldToText(interval.to)})`, String(interval.count)]);
	}
	downloadCsv(rows, `${toFilename(props.settings.label || props.settings.id)}.csv`);
}

defineExpose({
	reflow() {
		chartRef.value?.reflow();
	},
});

const { failed } = useWidgetData(dashboard, toRef(props, 'active'), params, { init, update });
</script>

<template>
	<div>
		<v-row v-show="intervals?.length">
			<v-spacer />
			<div class="d-flex ga-1">
				<v-btn variant="text" size="small" class="xbtn" title="Download" @click="downloadCSV"><v-icon icon="mdi-download" size="small" /></v-btn>
				<v-btn variant="text" size="small" class="xbtn" title="Snapshot" @click="chartRef?.snapshot()"><v-icon icon="mdi-camera" size="small" /></v-btn>
			</div>
		</v-row>
		<EChartsChart ref="chartRef" v-if="intervals?.length" :options="chartOptions" :height="chartHeight" @ready="onChartReady" />
		<p v-if="failed" class="none">Failed</p>
		<p v-else-if="intervals === null" class="none">Loading...</p>
		<p v-else-if="intervals.length === 0" class="none">None</p>
	</div>
</template>
