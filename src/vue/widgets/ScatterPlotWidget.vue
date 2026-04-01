<script setup lang="ts">
import { inject, nextTick, onMounted, ref } from 'vue';
import type { FieldInfo, ScatterPlotParams, SearchResult } from '../../types/search';
import { compactDuration, compactNumber } from '../../utils/helpers';
import { statistics } from '../../utils/statistics';
import { type DashboardApi, dashboardKey, type WidgetRegistration } from '../composables/useDashboard';
// biome-ignore lint/style/useImportType: Vue component used in template
import EChartsChart from './EChartsChart.vue';

const props = defineProps<{
	settings: {
		id: string;
		key_field?: string;
		field_x: string;
		unit_x?: string;
		statistic_x?: string;
		filter_x?: string;
		label_x?: string;
		field_y: string;
		unit_y?: string;
		statistic_y?: string;
		filter_y?: string;
		label_y?: string;
		interval?: string;
		lag?: number;
		regression?: string;
		filter?: string;
		placement?: string;
	};
	fieldLookup?: (name: string) => FieldInfo | undefined;
}>();

const defaultFieldInfo: FieldInfo = {
	toNumber: (v) => Number(v),
	toText: (v) => String(v ?? ''),
	formatAxis: () => {},
};

function findField(name: string): FieldInfo {
	return props.fieldLookup?.(name) ?? defaultFieldInfo;
}

const dashboard = inject<DashboardApi>(dashboardKey)!;
const keyField = 'timestamp';

const data = ref<number[][] | null>(null);
const dataB = ref<number[][]>([]);
const chartOptions = ref<Record<string, unknown> | null>(null);
const chartHeight = ref<number | undefined>();
const rChartOptions = ref<Record<string, unknown> | null>(null);

function buildLabel(label: string | undefined, statistic: string | undefined, field: string, unit: string | undefined): string {
	if (label) return label;
	let header = (statistic || 'count') + ' of ' + field;
	if (unit) header += ' (' + unit + ')';
	return header;
}

function params(): ScatterPlotParams {
	return {
		id: props.settings.id,
		type: 'scatterplot',
		field_x: props.settings.field_x,
		unit_x: props.settings.unit_x,
		statistic_x: props.settings.statistic_x,
		filter_x: props.settings.filter_x,
		field_y: props.settings.field_y,
		unit_y: props.settings.unit_y,
		statistic_y: props.settings.statistic_y,
		filter_y: props.settings.filter_y,
		key_field: props.settings.key_field || keyField,
		interval: props.settings.interval,
		lag: props.settings.lag,
	};
}

function update(result: SearchResult, resultB?: SearchResult) {
	data.value = (result[props.settings.id] as number[][]) || [];
	dataB.value = (resultB?.[props.settings.id] as number[][]) || [];
	nextTick(draw);
}

function init() {
	data.value = null;
	dataB.value = [];
	chartOptions.value = null;
	rChartOptions.value = null;
}

function draw() {
	if (!data.value?.length && !dataB.value?.length) return;

	const xField = findField(props.settings.field_x);
	const yField = findField(props.settings.field_y);
	const isDurationX = props.settings.field_x.startsWith('duration');
	const isDurationY = props.settings.field_y.startsWith('duration');

	const allSeries: Record<string, unknown>[] = [
		{
			type: 'scatter',
			data: data.value,
			symbolSize: 10,
			itemStyle: { color: 'rgba(119, 152, 191, 0.5)' },
			selectedMode: 'single',
		},
	];

	if (dataB.value?.length) {
		allSeries.push({
			type: 'scatter',
			data: dataB.value,
			symbolSize: 10,
			itemStyle: { color: 'rgba(204, 102, 0, 0.5)' },
			selectedMode: 'single',
		});
	}

	if (data.value!.length > 1 && props.settings.regression === 'linear') {
		const regression = statistics.regression(data.value!);
		if (regression) {
			allSeries.push({
				type: 'line',
				data: regression.data,
				lineStyle: { type: 'dotted', width: 2, color: 'rgb(119, 152, 191)' },
				itemStyle: { color: 'rgb(119, 152, 191)' },
				symbol: 'none',
				silent: true,
			});
		}
	}

	if (dataB.value && dataB.value.length > 1 && props.settings.regression === 'linear') {
		const regressionB = statistics.regression(dataB.value);
		if (regressionB) {
			allSeries.push({
				type: 'line',
				data: regressionB.data,
				lineStyle: { type: 'dotted', width: 2, color: 'rgb(204, 102, 0)' },
				itemStyle: { color: 'rgb(204, 102, 0)' },
				symbol: 'none',
				silent: true,
			});
		}
	}

	chartHeight.value = props.settings.placement === 'top' ? 150 : undefined;

	const options: Record<string, unknown> = {
		animation: false,
		grid: { left: 60, right: 20, top: 10, bottom: 40, containLabel: false },
		xAxis: {
			type: 'value',
			name: buildLabel(props.settings.label_x, props.settings.statistic_x, props.settings.field_x, props.settings.unit_x),
			nameLocation: 'middle',
			nameGap: 25,
			splitNumber: 8,
			axisLine: { show: false, onZero: false },
			axisTick: { show: true, lineStyle: { color: '#ccc' }, alignWithLabel: true },
			axisLabel: { formatter: isDurationX ? compactDuration : compactNumber },
			splitLine: { show: false },
			min: xField.minValue,
			max: xField.maxValue,
		},
		yAxis: {
			type: 'value',
			name: buildLabel(props.settings.label_y, props.settings.statistic_y, props.settings.field_y, props.settings.unit_y),
			nameLocation: 'middle',
			nameGap: 40,
			splitNumber: 8,
			axisLine: { show: false, onZero: false },
			axisTick: { show: true, lineStyle: { color: '#ccc' }, alignWithLabel: true },
			axisLabel: { formatter: isDurationY ? compactDuration : compactNumber },
			splitLine: { show: false },
			min: yField.minValue,
			max: yField.maxValue,
		},
		tooltip: {
			trigger: 'item',
			formatter: (params: { value: number[] }) => {
				if (!params?.value) return '';
				return (
					'<b>x</b>: ' +
					(isDurationX ? compactDuration(params.value[0]) : xField.toText(params.value[0]) || params.value[0]) +
					(props.settings.unit_x || '') +
					', ' +
					'<b>y</b>: ' +
					(isDurationY ? compactDuration(params.value[1]) : yField.toText(params.value[1]) || params.value[1]) +
					(props.settings.unit_y || '')
				);
			},
		},
		dataZoom: [
			{ type: 'inside', xAxisIndex: 0 },
			{ type: 'inside', yAxisIndex: 0 },
		],
		series: allSeries,
		legend: { show: false },
	};

	chartOptions.value = options;

	// Correlation chart
	if (data.value!.length > 3 || dataB.value.length > 3) {
		const rSeries: Record<string, unknown>[] = [];

		if (data.value && data.value.length > 3) {
			const correlation = statistics.correlate(data.value, true);
			rSeries.push({
				type: 'scatter',
				data: [[0, correlation.r]],
				symbolSize: 10,
				itemStyle: { color: 'rgb(119, 152, 191)' },
				silent: true,
			});
			if (correlation.lower !== undefined && correlation.upper !== undefined) {
				rSeries.push({
					type: 'custom',
					data: [[0, correlation.lower, correlation.upper]],
					renderItem: (_params: unknown, api: { coord: (val: number[]) => number[]; style: (opts: Record<string, unknown>) => Record<string, unknown> }) => {
						const lowPt = api.coord([0, correlation.lower]);
						const highPt = api.coord([0, correlation.upper]);
						return {
							type: 'group',
							children: [
								{
									type: 'line',
									shape: { x1: lowPt[0], y1: lowPt[1], x2: highPt[0], y2: highPt[1] },
									style: { stroke: 'rgb(119, 152, 191)', lineWidth: 2 },
								},
								{
									type: 'line',
									shape: { x1: lowPt[0] - 4, y1: lowPt[1], x2: lowPt[0] + 4, y2: lowPt[1] },
									style: { stroke: 'rgb(119, 152, 191)', lineWidth: 2 },
								},
								{
									type: 'line',
									shape: { x1: highPt[0] - 4, y1: highPt[1], x2: highPt[0] + 4, y2: highPt[1] },
									style: { stroke: 'rgb(119, 152, 191)', lineWidth: 2 },
								},
							],
						};
					},
				});
			}
		}

		if (dataB.value && dataB.value.length > 3) {
			const correlationB = statistics.correlate(dataB.value, true);
			rSeries.push({
				type: 'scatter',
				data: [[1, correlationB.r]],
				symbolSize: 10,
				itemStyle: { color: 'rgb(204, 102, 0)' },
				silent: true,
			});
			if (correlationB.lower !== undefined && correlationB.upper !== undefined) {
				rSeries.push({
					type: 'custom',
					data: [[1, correlationB.lower, correlationB.upper]],
					renderItem: (_params: unknown, api: { coord: (val: number[]) => number[]; style: (opts: Record<string, unknown>) => Record<string, unknown> }) => {
						const lowPt = api.coord([1, correlationB.lower]);
						const highPt = api.coord([1, correlationB.upper]);
						return {
							type: 'group',
							children: [
								{
									type: 'line',
									shape: { x1: lowPt[0], y1: lowPt[1], x2: highPt[0], y2: highPt[1] },
									style: { stroke: 'rgb(204, 102, 0)', lineWidth: 2 },
								},
								{
									type: 'line',
									shape: { x1: lowPt[0] - 4, y1: lowPt[1], x2: lowPt[0] + 4, y2: lowPt[1] },
									style: { stroke: 'rgb(204, 102, 0)', lineWidth: 2 },
								},
								{
									type: 'line',
									shape: { x1: highPt[0] - 4, y1: highPt[1], x2: highPt[0] + 4, y2: highPt[1] },
									style: { stroke: 'rgb(204, 102, 0)', lineWidth: 2 },
								},
							],
						};
					},
				});
			}
		}

		rChartOptions.value = {
			animation: false,
			grid: { left: 65, right: 20, top: 10, bottom: 10 },
			xAxis: {
				type: 'value',
				show: false,
			},
			yAxis: {
				type: 'value',
				min: -1,
				max: 1,
				interval: 1,
				axisLine: { show: false },
				axisTick: { show: false },
				splitLine: { show: true },
			},
			tooltip: {
				trigger: 'item',
				formatter: (params: { value: number[] }) => {
					if (!params?.value) return '';
					return "<b>Spearman's rho:</b> " + params.value[1].toFixed(3);
				},
			},
			series: rSeries,
			legend: { show: false },
		};
	}
}

const chartRef = ref<InstanceType<typeof EChartsChart> | null>(null);

function downloadCSV() {
	if (!data.value?.length && !dataB.value?.length) return;
	const headerX = props.settings.label_x || (props.settings.statistic_x || 'count') + '_' + props.settings.field_x + (props.settings.unit_x ? '_' + props.settings.unit_x : '');
	const headerY = props.settings.label_y || (props.settings.statistic_y || 'count') + '_' + props.settings.field_y + (props.settings.unit_y ? '_' + props.settings.unit_y : '');
	const hasB = dataB.value?.length > 0;
	const rows = [[headerX, headerY, hasB ? 'dataset' : ''].filter(Boolean).join(',')];
	if (data.value) {
		for (const point of data.value) {
			const row = [point[0], point[1]];
			if (hasB) row.push('A' as unknown as number);
			rows.push(row.join(','));
		}
	}
	if (dataB.value) {
		for (const point of dataB.value) {
			const row = [point[0], point[1]];
			if (hasB) row.push('B' as unknown as number);
			rows.push(row.join(','));
		}
	}
	const blob = new Blob([rows.join('\n')], { type: 'text/csv;charset=utf-8' });
	const url = URL.createObjectURL(blob);
	const a = document.createElement('a');
	a.href = url;
	a.download = `${props.settings.id}.csv`;
	document.body.appendChild(a);
	a.click();
	document.body.removeChild(a);
	URL.revokeObjectURL(url);
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
		<div class="row-fluid" v-show="data?.length || dataB?.length">
			<div class="pull-right">
				<a class="xbtn" title="Download" @click="downloadCSV"><i class="fa fa-file-text" /></a>
				<a class="xbtn" title="Snapshot" @click="chartRef?.snapshot()"><i class="fa fa-camera" /></a>
			</div>
		</div>
		<EChartsChart ref="chartRef" v-if="data?.length || dataB?.length" :options="chartOptions" :height="chartHeight" />
		<EChartsChart v-if="rChartOptions" :options="rChartOptions" />
		<p v-if="data === null" class="none">Loading...</p>
		<p v-else-if="data.length === 0 && dataB.length === 0" class="none">None</p>
	</div>
</template>
