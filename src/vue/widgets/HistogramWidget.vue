<script setup lang="ts">
import { inject, nextTick, onMounted, ref } from 'vue';
import { type DashboardApi, dashboardKey, type WidgetRegistration } from '../composables/useDashboard';
import type HighchartsChart from './HighchartsChart.vue';

interface Interval {
	from: unknown;
	to: unknown;
	count: number;
}

const props = defineProps<{
	settings: {
		id: string;
		field: string;
		interval: number;
		unit?: string;
		filter?: string;
		placement?: string;
	};
	formatFieldText?: (value: unknown, field: string) => string;
}>();

const dashboard = inject<DashboardApi>(dashboardKey)!;
const intervals = ref<Interval[] | null>(null);
const chartOptions = ref<Record<string, unknown> | null>(null);

function fieldToText(value: unknown): string {
	if (props.formatFieldText) return props.formatFieldText(value, props.settings.field);
	if (typeof value === 'object' && value !== null && '@value' in value) {
		const obj = value as { '@value': number; unit?: string };
		return obj.unit ? obj['@value'] + ' ' + obj.unit : String(obj['@value']);
	}
	return String(value ?? '');
}

function params(): Record<string, unknown> {
	return {
		id: props.settings.id,
		type: 'histogram',
		field: props.settings.field,
		interval: props.settings.interval,
		unit: props.settings.unit,
		filter: props.settings.filter,
	};
}

function update(result: Record<string, unknown>) {
	intervals.value = (result[props.settings.id] as Interval[]) || [];
	nextTick(draw);
}

function init() {
	intervals.value = null;
	chartOptions.value = null;
}

function draw() {
	if (!intervals.value?.length) return;

	const height = Math.max(intervals.value.length * 20, 150);
	const options: Record<string, unknown> = {
		chart: {
			type: 'bar',
			zoomType: 'x',
			height,
			animation: false,
			events: {
				selection: (event: { xAxis: Array<{ min?: number; max?: number }> }) => {
					const min = event.xAxis[0].min !== undefined ? Math.ceil(event.xAxis[0].min) : 0;
					const max = event.xAxis[0].max !== undefined ? Math.floor(event.xAxis[0].max) : intervals.value!.length - 1;
					if (min <= max) {
						const from = fieldToText(intervals.value![max].from);
						const to = fieldToText(intervals.value![min].to);
						if (from || to) {
							dashboard.addConstraint(props.settings.field, `[${from}..${to})`, true);
						}
					}
					return false;
				},
			},
		},
		title: { text: null },
		xAxis: {
			categories: intervals.value.map((i) => `${fieldToText(i.from)}..${fieldToText(i.to)}`),
			tickLength: 0,
		},
		yAxis: {
			title: null,
			labels: { overflow: 'justify' },
			allowDecimals: false,
		},
		series: [
			{
				name: 'count',
				color: 'rgba(47, 126, 216, 0.4)',
				data: intervals.value.map((i) => i.count),
			},
		],
		tooltip: {
			shared: false,
			hideDelay: 0,
			crosshairs: false,
			headerFormat: '<b>{point.key}</b>: ',
			pointFormat: '{point.y}',
		},
		plotOptions: {
			series: {
				pointWidth: 10,
				borderRadius: 5,
				borderWidth: 0,
				cursor: 'pointer',
				animation: false,
				events: {
					click: (event: { point: { x: number } }) => {
						const interval = intervals.value![event.point.x];
						const range = `[${fieldToText(interval.from)}..${fieldToText(interval.to)})`;
						dashboard.addConstraint(props.settings.field, range, true);
					},
				},
			},
		},
		legend: { enabled: false },
		credits: { enabled: false },
	};
	chartOptions.value = options;
}

const chartRef = ref<InstanceType<typeof HighchartsChart> | null>(null);

function downloadCSV() {
	if (!intervals.value?.length) return;
	const rows = [[props.settings.field, 'count'].join(',')];
	for (const interval of intervals.value) {
		const value = `[${fieldToText(interval.from)}..${fieldToText(interval.to)})`;
		rows.push([value, interval.count].join(','));
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
		<div class="row-fluid" v-show="intervals?.length">
			<div class="pull-right">
				<a class="xbtn" title="Download" @click="downloadCSV"><i class="fa fa-file-text" /></a>
				<a class="xbtn" title="Snapshot" @click="chartRef?.snapshot()"><i class="fa fa-camera" /></a>
			</div>
		</div>
		<HighchartsChart ref="chartRef" v-if="intervals?.length" :options="chartOptions" />
		<p v-if="intervals === null" class="none">Loading...</p>
		<p v-else-if="intervals.length === 0" class="none">None</p>
	</div>
</template>
