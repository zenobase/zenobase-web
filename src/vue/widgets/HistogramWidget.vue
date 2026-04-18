<script setup lang="ts">
import type { ECharts } from 'echarts/core';
import { inject, nextTick, ref, toRef } from 'vue';
import type { HistogramInterval, HistogramParams, SearchResult } from '../../types/search';
import { compactDuration, compactNumber } from '../../utils/helpers';
import LoadingState from '../components/LoadingState.vue';
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
const intervalsB = ref<HistogramInterval[]>([]);
const chartOptions = ref<Record<string, unknown> | null>(null);
const chartHeight = ref<number | undefined>();
let mergedBins: Array<{ label: string; from: unknown; to: unknown }> = [];

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

function update(result: SearchResult, resultB?: SearchResult) {
	intervals.value = (result[props.settings.id] as HistogramInterval[]) || [];
	intervalsB.value = (resultB?.[props.settings.id] as HistogramInterval[]) || [];
	nextTick(draw);
}

function init() {
	intervals.value = null;
	intervalsB.value = [];
	chartOptions.value = null;
}

function draw() {
	if (!intervals.value?.length && !intervalsB.value.length) return;

	const hasB = intervalsB.value.length > 0;
	const merged = mergeIntervals(intervals.value || [], intervalsB.value);
	mergedBins = merged.map(({ label, from, to }) => ({ label, from, to }));
	const height = Math.max(merged.length * (hasB ? 30 : 20), 150);
	chartHeight.value = height;
	const categories = merged.map((m) => m.label);
	const counts = merged.map((m) => m.a);
	const countsB = merged.map((m) => m.b);

	const series: Record<string, unknown>[] = [
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
	];
	if (hasB) {
		series.push({
			name: 'count-B',
			type: 'bar',
			data: countsB,
			barWidth: 10,
			itemStyle: {
				color: 'rgba(204, 102, 0, 0.4)',
				borderRadius: 5,
			},
		});
	}

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
		series,
		legend: { show: false },
	};

	chartOptions.value = options;
}

function mergeIntervals(a: HistogramInterval[], b: HistogramInterval[]): Array<{ label: string; from: unknown; to: unknown; a: number | null; b: number | null }> {
	const map = new Map<string, { from: unknown; to: unknown; a: number | null; b: number | null }>();
	const key = (i: HistogramInterval) => `${fieldToText(i.from)}..${fieldToText(i.to)}`;
	for (const i of a) map.set(key(i), { from: i.from, to: i.to, a: i.count, b: null });
	for (const i of b) {
		const k = key(i);
		const existing = map.get(k);
		if (existing) existing.b = i.count;
		else map.set(k, { from: i.from, to: i.to, a: null, b: i.count });
	}
	return Array.from(map.entries())
		.map(([label, v]) => ({ label, from: v.from, to: v.to, a: v.a, b: v.b }))
		.sort((x, y) => Number(x.from) - Number(y.from));
}

const chartRef = ref<InstanceType<typeof EChartsChart> | null>(null);

function onChartReady(instance: ECharts) {
	instance.on('click', (params: unknown) => {
		const { dataIndex } = params as { dataIndex?: number };
		if (dataIndex !== undefined && mergedBins[dataIndex]) {
			const bin = mergedBins[dataIndex];
			const range = `[${fieldToText(bin.from)}..${fieldToText(bin.to)})`;
			dashboard.addConstraint(props.settings.field, range, true);
		}
	});
}

function downloadCSV() {
	if (!mergedBins.length) return;
	const hasB = intervalsB.value.length > 0;
	const merged = mergeIntervals(intervals.value || [], intervalsB.value);
	const header = hasB ? [props.settings.field, 'count', 'count-B'] : [props.settings.field, 'count'];
	const rows: string[][] = [header];
	for (const m of merged) {
		const range = `[${fieldToText(m.from)}..${fieldToText(m.to)})`;
		rows.push(hasB ? [range, String(m.a ?? 0), String(m.b ?? 0)] : [range, String(m.a ?? 0)]);
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
		<v-row v-show="intervals?.length || intervalsB.length">
			<v-spacer />
			<div class="d-flex ga-1">
				<v-btn variant="text" size="small" class="xbtn" title="Download" @click="downloadCSV"><v-icon icon="mdi-download" size="small" /></v-btn>
				<v-btn variant="text" size="small" class="xbtn" title="Snapshot" @click="chartRef?.snapshot()"><v-icon icon="mdi-camera" size="small" /></v-btn>
			</div>
		</v-row>
		<EChartsChart ref="chartRef" v-if="intervals?.length || intervalsB.length" :options="chartOptions" :height="chartHeight" @ready="onChartReady" />
		<LoadingState v-if="failed" state="failed" />
		<LoadingState v-else-if="intervals === null" state="loading" />
		<LoadingState v-else-if="intervals.length === 0 && intervalsB.length === 0" state="empty" />
	</div>
</template>
