<script setup lang="ts">
import { inject, nextTick, onMounted, ref } from 'vue';
import type { FieldInfo, ScatterPlotParams, SearchResult } from '../../types/search';
import { statistics } from '../../utils/statistics';
import { type DashboardApi, dashboardKey, type WidgetRegistration } from '../composables/useDashboard';
// biome-ignore lint/style/useImportType: Vue component used in template
import HighchartsChart from './HighchartsChart.vue';

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

	const options: Record<string, unknown> = {
		chart: {
			type: 'scatter',
			zoomType: 'xy',
			animation: false,
		},
		title: { text: null },
		xAxis: {
			title: {
				text: buildLabel(props.settings.label_x, props.settings.statistic_x, props.settings.field_x, props.settings.unit_x),
			},
			tickLength: 5,
			tickWidth: 1,
			lineWidth: 0,
			gridLineWidth: 0,
			startOnTick: false,
			floor: xField.minValue,
			ceiling: xField.maxValue,
		},
		yAxis: {
			title: {
				text: buildLabel(props.settings.label_y, props.settings.statistic_y, props.settings.field_y, props.settings.unit_y),
			},
			tickLength: 5,
			tickWidth: 1,
			lineWidth: 0,
			gridLineWidth: 0,
			startOnTick: false,
			floor: yField.minValue,
			ceiling: yField.maxValue,
		},
		tooltip: {
			crosshairs: false,
			shared: false,
			hideDelay: 0,
			formatter: function (this: { x: number; y: number }) {
				return '<b>x</b>: ' + (xField.toText(this.x) || this.x) + (props.settings.unit_x || '') + ', ' + '<b>y</b>: ' + (yField.toText(this.y) || this.y) + (props.settings.unit_y || '');
			},
		},
		series: [
			{
				data: data.value,
				animation: false,
				color: 'rgba(119, 152, 191, 0.5)',
				allowPointSelect: true,
				marker: {
					radius: 5,
					symbol: 'circle',
				},
			},
		] as Array<Record<string, unknown>>,
		plotOptions: {
			series: {
				animation: false,
				stickyTracking: false,
			},
		},
		legend: { enabled: false },
		credits: { enabled: false },
	};

	const series = options.series as Array<Record<string, unknown>>;

	if (dataB.value?.length) {
		series.push({
			data: dataB.value,
			animation: false,
			color: 'rgba(204, 102, 0, 0.5)',
			allowPointSelect: true,
			marker: {
				radius: 5,
				symbol: 'circle',
			},
		});
	}

	if (data.value!.length > 1 && props.settings.regression === 'linear') {
		const regression = statistics.regression(data.value!);
		if (regression) {
			series.push({
				type: 'line',
				data: regression.data,
				color: 'rgb(119, 152, 191)',
				dashStyle: 'Dot',
				lineWidth: 2,
				enableMouseTracking: false,
				marker: { enabled: false },
			});
		}
	}

	if (dataB.value && dataB.value.length > 1 && props.settings.regression === 'linear') {
		const regressionB = statistics.regression(dataB.value);
		if (regressionB) {
			series.push({
				type: 'line',
				data: regressionB.data,
				color: 'rgb(204, 102, 0)',
				dashStyle: 'Dot',
				lineWidth: 2,
				enableMouseTracking: false,
				marker: { enabled: false },
			});
		}
	}

	if (data.value!.length > 3 || dataB.value.length > 3) {
		const rOpts: Record<string, unknown> = {
			chart: {
				type: 'line',
				inverted: true,
				height: 75,
				plotBorderWidth: 1,
				plotBackgroundColor: '#fafafa',
				marginLeft: 65,
				animation: false,
			},
			title: { text: null },
			xAxis: {
				title: { text: null },
				labels: { enabled: false },
				lineWidth: 0,
				tickLength: 0,
			},
			yAxis: {
				title: { text: null },
				max: 1.0,
				min: -1.0,
				lineWidth: 0,
				tickInterval: 1.0,
				tickWidth: 0,
				gridLineWidth: 1,
			},
			tooltip: {
				shared: true,
				hideDelay: 0,
			},
			series: [] as Array<Record<string, unknown>>,
			legend: { enabled: false },
			credits: { enabled: false },
		};

		const rSeries = rOpts.series as Array<Record<string, unknown>>;

		if (data.value && data.value.length > 3) {
			const correlation = statistics.correlate(data.value, true);
			rSeries.push({
				data: [[0, correlation.r]],
				color: 'rgb(119, 152, 191)',
				animation: false,
				marker: {
					radius: 5,
					symbol: 'circle',
				},
				tooltip: {
					headerFormat: '',
					pointFormat: "<b>Spearman's rho:</b> {point.y}<br/>",
					valueDecimals: 3,
				},
				states: {
					hover: { enabled: false },
				},
			});
			rSeries.push({
				type: 'errorbar',
				data: [[0, correlation.lower, correlation.upper]],
				lineWidth: 2,
				color: 'rgb(119, 152, 191)',
				animation: false,
				tooltip: {
					headerFormat: '',
					pointFormat: '<b>95% confidence interval:</b> [' + correlation.lower.toFixed(3) + '..' + correlation.upper.toFixed(3) + ']<br/>',
				},
			});
		}

		if (dataB.value && dataB.value.length > 3) {
			const correlationB = statistics.correlate(dataB.value, true);
			rSeries.push({
				data: [[1, correlationB.r]],
				color: 'rgb(204, 102, 0)',
				animation: false,
				marker: {
					radius: 5,
					symbol: 'circle',
				},
				tooltip: {
					headerFormat: '',
					pointFormat: "<b>Spearman's rho:</b> {point.y}<br/>",
					valueDecimals: 3,
				},
				states: {
					hover: { enabled: false },
				},
			});
			rSeries.push({
				type: 'errorbar',
				data: [[1, correlationB.lower, correlationB.upper]],
				lineWidth: 2,
				color: 'rgb(204, 102, 0)',
				animation: false,
				tooltip: {
					headerFormat: '',
					pointFormat: '<b>95% confidence interval:</b> [' + correlationB.lower.toFixed(3) + '..' + correlationB.upper.toFixed(3) + ']<br/>',
				},
			});
		}

		rChartOptions.value = rOpts;
	}

	if (props.settings.placement === 'top') {
		(options.chart as Record<string, unknown>).height = 150;
	}

	xField.formatAxis(options.xAxis as Record<string, unknown>);
	yField.formatAxis(options.yAxis as Record<string, unknown>);
	chartOptions.value = options;
}

const chartRef = ref<InstanceType<typeof HighchartsChart> | null>(null);

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
		<HighchartsChart ref="chartRef" v-if="data?.length || dataB?.length" :options="chartOptions" />
		<HighchartsChart v-if="rChartOptions" :options="rChartOptions" />
		<p v-if="data === null" class="none">Loading...</p>
		<p v-else-if="data.length === 0 && dataB.length === 0" class="none">None</p>
	</div>
</template>
