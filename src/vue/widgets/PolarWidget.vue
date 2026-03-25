<script setup lang="ts">
import { inject, nextTick, onMounted, ref } from 'vue';
import { type DashboardApi, dashboardKey, type WidgetRegistration } from '../composables/useDashboard';
import HighchartsChart from './HighchartsChart.vue';

interface FieldInfo {
	toNumber(value: unknown): number;
	toText(value: unknown): string;
	formatAxis?(axis: Record<string, unknown>): void;
	minValue?: number;
	maxValue?: number;
}

interface TimeEntry {
	label: string;
	value: string;
	count: number;
	[key: string]: unknown;
}

const props = defineProps<{
	settings: {
		id: string;
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
};

function findField(name: string): FieldInfo {
	return props.fieldLookup?.(name) ?? defaultFieldInfo;
}

const dashboard = inject<DashboardApi>(dashboardKey)!;
const keyField = 'timestamp';

const times = ref<TimeEntry[] | null>(null);
const timesB = ref<TimeEntry[]>([]);
const chartOptions = ref<Record<string, unknown> | null>(null);

/**
 * Based on https://stackoverflow.com/a/18070247/1144085
 */
function circularAvg(data: TimeEntry[]): number {
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

function addPlotBand(opts: Record<string, unknown>, value: number, max: number, color: string) {
	const xAxis = opts.xAxis as { plotBands: Array<{ color: string; from: number; to: number }> };
	xAxis.plotBands.push({
		color,
		from: value - 0.5,
		to: value + 0.5,
	});
	if (value - 0.5 < 0) {
		xAxis.plotBands.push({
			color,
			from: max - 0.5,
			to: max,
		});
	}
}

function filterByValue(value: string, negated?: boolean) {
	dashboard.addConstraint((props.settings.key_field || keyField) + '.' + props.settings.interval, value, true, negated);
}

function params(): Record<string, unknown> {
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

function update(result: Record<string, unknown>, resultB?: Record<string, unknown>) {
	times.value = (result[props.settings.id] as TimeEntry[]) || [];
	timesB.value = (resultB?.[props.settings.id] as TimeEntry[]) || [];
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

	const options: Record<string, unknown> = {
		chart: {
			type: 'column',
			polar: true,
			animation: false,
		},
		title: { text: null },
		xAxis: {
			categories: [] as string[],
			plotBands: [] as Array<{ color: string; from: number; to: number }>,
		},
		yAxis: {
			title: { text: null },
			floor: field.minValue,
			ceiling: field.maxValue,
		},
		tooltip: {
			shared: false,
			hideDelay: 0,
			formatter: function (this: { x: string; y: number }) {
				return '<b>' + this.x + '</b>: ' + (field.toText(this.y) || this.y) + (props.settings.unit || '');
			},
		},
		series: [
			{
				name: statistic,
				data: [] as number[],
			},
		] as Array<Record<string, unknown>>,
		plotOptions: {
			series: {
				color: 'rgba(47, 126, 216, 0.4)',
				animation: false,
				pointPlacement: 'on',
				cursor: 'pointer',
				events: {
					click: (event: { point: { x: number } }) => {
						filterByValue(times.value![event.point.x].value);
					},
				},
			},
			column: {
				pointPadding: 0,
				groupPadding: 0,
			},
		},
		legend: { enabled: false },
		credits: { enabled: false },
	};

	if (props.settings.mark === 'avg' && times.value?.length) {
		addPlotBand(options, circularAvg(times.value), times.value.length, 'rgba(47, 126, 216, 0.2)');
	}

	if (props.settings.placement === 'top') {
		(options.chart as Record<string, unknown>).height = 150;
	}

	const series = options.series as Array<Record<string, unknown>>;
	const xAxis = options.xAxis as { categories: string[] };
	const series0Data = series[0].data as number[];

	times.value?.forEach((time) => {
		const value = time[statistic];
		xAxis.categories.push(time.label);
		series0Data.push(value !== undefined ? field.toNumber(value) : 0);
	});

	if (timesB.value?.length) {
		series.push({
			name: statistic,
			data: [] as number[],
			color: 'rgba(204, 102, 0, 0.4)',
			events: {
				click: (event: { point: { x: number } }) => {
					filterByValue(timesB.value[event.point.x].value);
				},
			},
		});
		const series1Data = series[1].data as number[];
		timesB.value.forEach((time) => {
			const value = time[statistic];
			xAxis.categories.push(time.label);
			series1Data.push(value !== undefined ? field.toNumber(value) : 0);
		});
		if (props.settings.mark === 'avg') {
			addPlotBand(options, circularAvg(timesB.value), timesB.value.length, 'rgba(204, 102, 0, 0.2)');
		}
	}

	field.formatAxis?.(options.yAxis as Record<string, unknown>);
	chartOptions.value = options;
}

const chartRef = ref<InstanceType<typeof HighchartsChart> | null>(null);

function downloadCSV() {
	if (!times.value?.length) return;
	const statistic = props.settings.statistic || 'count';
	const field = findField(props.settings.value_field);
	const header = statistic + '_' + props.settings.value_field + (props.settings.unit ? '_' + props.settings.unit : '');
	const rows = [[props.settings.interval, header].join(',')];
	for (const time of times.value) {
		const value = time[statistic];
		rows.push([time.value, value !== undefined ? field.toNumber(value as number) : ''].join(','));
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
		<div class="row-fluid" v-show="times?.length || timesB?.length">
			<div class="dropdown pull-right">
				<a class="xbtn dropdown-toggle" data-toggle="dropdown" title="Filter"><i class="fa fa-filter" /><b class="caret" /></a>
				<ul class="dropdown-menu" role="menu">
					<li role="presentation" v-if="settings.interval === 'month_of_year'"><a role="menuitem" @click="filterByValue('[1..3]')">Jan - Mar</a></li>
					<li role="presentation" v-if="settings.interval === 'month_of_year'"><a role="menuitem" @click="filterByValue('[4..6]')">Apr - Jun</a></li>
					<li role="presentation" v-if="settings.interval === 'month_of_year'"><a role="menuitem" @click="filterByValue('[7..9]')">Jul - Sep</a></li>
					<li role="presentation" v-if="settings.interval === 'month_of_year'"><a role="menuitem" @click="filterByValue('[10..12]')">Oct - Dec</a></li>
					<li class="divider" v-if="settings.interval === 'month_of_year'" />
					<li role="presentation" v-if="settings.interval === 'month_of_year'"><a role="menuitem" @click="filterByValue('[4..9]')">Apr - Sep</a></li>
					<li role="presentation" v-if="settings.interval === 'month_of_year'"><a role="menuitem" @click="filterByValue('[4..9]', true)">Oct - Mar</a></li>
					<li role="presentation" v-if="settings.interval === 'day_of_month'"><a role="menuitem" @click="filterByValue('[1..16)')">1st - 15th</a></li>
					<li role="presentation" v-if="settings.interval === 'day_of_month'"><a role="menuitem" @click="filterByValue('[16..*)')">16th - 31st</a></li>
					<li role="presentation" v-if="settings.interval === 'day_of_week'"><a role="menuitem" @click="filterByValue('[1..5]')">Mon - Fri</a></li>
					<li role="presentation" v-if="settings.interval === 'day_of_week'"><a role="menuitem" @click="filterByValue('[6..7]')">Sat - Sun</a></li>
					<li role="presentation" v-if="settings.interval === 'hour_of_day'"><a role="menuitem" @click="filterByValue('[0..12)')">0h - 12h</a></li>
					<li role="presentation" v-if="settings.interval === 'hour_of_day'"><a role="menuitem" @click="filterByValue('[12..*)')">12h - 24h</a></li>
					<li class="divider" v-if="settings.interval === 'hour_of_day'" />
					<li role="presentation" v-if="settings.interval === 'hour_of_day'"><a role="menuitem" @click="filterByValue('[0..3)')">0h - 3h</a></li>
					<li role="presentation" v-if="settings.interval === 'hour_of_day'"><a role="menuitem" @click="filterByValue('[3..6)')">3h - 6h</a></li>
					<li role="presentation" v-if="settings.interval === 'hour_of_day'"><a role="menuitem" @click="filterByValue('[6..9)')">6h - 9h</a></li>
					<li role="presentation" v-if="settings.interval === 'hour_of_day'"><a role="menuitem" @click="filterByValue('[9..12)')">9h - 12h</a></li>
					<li role="presentation" v-if="settings.interval === 'hour_of_day'"><a role="menuitem" @click="filterByValue('[12..15)')">12h - 15h</a></li>
					<li role="presentation" v-if="settings.interval === 'hour_of_day'"><a role="menuitem" @click="filterByValue('[15..18)')">15h - 18h</a></li>
					<li role="presentation" v-if="settings.interval === 'hour_of_day'"><a role="menuitem" @click="filterByValue('[18..21)')">18h - 21h</a></li>
					<li role="presentation" v-if="settings.interval === 'hour_of_day'"><a role="menuitem" @click="filterByValue('[21..*)')">21h - 24h</a></li>
				</ul>
				<a class="xbtn" title="Download" @click="downloadCSV"><i class="fa fa-file-text" /></a>
				<a class="xbtn" title="Snapshot" @click="chartRef?.snapshot()"><i class="fa fa-camera" /></a>
			</div>
		</div>
		<HighchartsChart ref="chartRef" v-if="times?.length || timesB?.length" :options="chartOptions" />
		<p v-if="times === null" class="none">Loading...</p>
		<p v-else-if="times.length === 0 && timesB.length === 0" class="none">None</p>
	</div>
</template>
