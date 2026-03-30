<script setup lang="ts">
import { inject, nextTick, onMounted, ref } from 'vue';
import { Interval, type IntervalDef } from '../../utils/interval';
import { statistics } from '../../utils/statistics';
import { type DashboardApi, dashboardKey, type WidgetRegistration } from '../composables/useDashboard';
import type HighchartsChart from './HighchartsChart.vue';

function pad(n: number): string {
	return n < 10 ? `0${n}` : String(n);
}

function formatDate(d: Date, fmt: string): string {
	const y = d.getFullYear();
	const m = d.getMonth() + 1;
	const day = d.getDate();
	switch (fmt) {
		case 'YYYY':
			return String(y);
		case 'YYYY-MM':
			return `${y}-${pad(m)}`;
		case 'YYYY-MM-DD':
			return `${y}-${pad(m)}-${pad(day)}`;
		default:
			return d.toISOString().substring(0, 10);
	}
}

function getISOWeek(d: Date): { year: number; week: number } {
	const tmp = new Date(d.getTime());
	tmp.setHours(0, 0, 0, 0);
	tmp.setDate(tmp.getDate() + 3 - ((tmp.getDay() + 6) % 7));
	const week1 = new Date(tmp.getFullYear(), 0, 4);
	const week = 1 + Math.round(((tmp.getTime() - week1.getTime()) / 86400000 - 3 + ((week1.getDay() + 6) % 7)) / 7);
	return { year: tmp.getFullYear(), week };
}

function formatWeek(d: Date): string {
	const { year, week } = getISOWeek(d);
	return `${year}-W${pad(week)}`;
}

function subtractDate(unit: string, n: number): Date {
	const d = new Date();
	switch (unit) {
		case 'years':
			d.setFullYear(d.getFullYear() - n);
			break;
		case 'months':
			d.setMonth(d.getMonth() - n);
			break;
		case 'weeks':
			d.setDate(d.getDate() - n * 7);
			break;
		case 'days':
			d.setDate(d.getDate() - n);
			break;
	}
	return d;
}

interface FieldInfo {
	toNumber(value: unknown): number;
	toText(value: unknown): string;
	formatAxis(axis: Record<string, unknown>): void;
	minValue?: number;
	maxValue?: number;
}

interface TimeEntry {
	time: number;
	label: string;
	value: string;
	count: number;
	min?: unknown;
	max?: unknown;
	sum?: unknown;
	avg?: unknown;
	[key: string]: unknown;
}

const props = defineProps<{
	settings: {
		id: string;
		key_field?: string;
		field: string;
		unit?: string;
		interval?: string;
		statistic?: string;
		regression?: string;
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

const times = ref<TimeEntry[] | null>(null);
const timesB = ref<TimeEntry[]>([]);
const chartOptions = ref<Record<string, unknown> | null>(null);
const effectSizeOptions = ref<Record<string, unknown> | null>(null);

let interval: IntervalDef = Interval.VALUES[1];

function commonPrefix(a: string, b: string): string {
	if (!a) return '';
	if (!b) return a;
	let i = 0;
	const at = a.split(/(?=[-T:Z]+)/);
	const bt = b.split(/(?=[-T:Z]+)/);
	while (i < at.length && i < bt.length) {
		if (at[i] !== bt[i]) break;
		++i;
	}
	return at.slice(0, i).join('');
}

function filterByValue(value: string) {
	dashboard.addConstraint(props.settings.key_field || keyField, value, true);
}

function isPaired(a: TimeEntry[], b: TimeEntry[]): boolean {
	for (let i = 0, j = 0; b && i < a.length && j < b.length; ) {
		if (a[i].time === b[j].time) {
			if (a[i].count * b[j].count === 0) {
				++i;
				++j;
			} else {
				return true;
			}
		} else if (a[i].time < b[j].time) {
			++i;
		} else {
			++j;
		}
	}
	return false;
}

function toXY(entries: TimeEntry[]): number[][] {
	const xy: number[][] = [];
	const field = findField(props.settings.field);
	entries.forEach((time) => {
		const value = time[props.settings.statistic || 'count'];
		if (value !== undefined) {
			xy.push([time.time, field.toNumber(value)]);
		}
	});
	return xy;
}

function toRanges(entries: { value: string; count: number }[]): string[] {
	const ranges: string[] = [];
	let begin: string | null = null;
	let end: string | null = null;
	let length = 0;
	entries.forEach((time) => {
		if (time.count > 0) {
			begin = begin || time.value;
			++length;
		} else {
			if (begin !== null) {
				ranges.push(length === 1 ? begin : '[' + begin + '..' + time.value + ')');
				begin = null;
				length = 0;
			}
		}
		end = time.value;
	});
	if (begin !== null) {
		ranges.push(length === 1 ? begin : '[' + begin + '..' + end + ']');
	}
	return ranges;
}

const filters = {
	thisYear: () => filterByValue(formatDate(new Date(), 'YYYY')),
	lastYear: () => filterByValue(formatDate(subtractDate('years', 1), 'YYYY')),
	thisMonth: () => filterByValue(formatDate(new Date(), 'YYYY-MM')),
	lastMonth: () => filterByValue(formatDate(subtractDate('months', 1), 'YYYY-MM')),
	lastMonths: (n: number) => filterByValue(`[${formatDate(subtractDate('months', n), 'YYYY-MM')}..${formatDate(new Date(), 'YYYY-MM')})`),
	thisWeek: () => filterByValue(formatWeek(new Date())),
	lastWeek: () => filterByValue(formatWeek(subtractDate('weeks', 1))),
	today: () => filterByValue(formatDate(new Date(), 'YYYY-MM-DD')),
	yesterday: () => filterByValue(formatDate(subtractDate('days', 1), 'YYYY-MM-DD')),
	lastHours: (n: number) => filterByValue('[-' + n + 'h..*)'),
	select: (offset: number) => {
		const entries: { value: string; count: number }[] = [];
		if (!times.value) return;
		for (let i = 0; i < times.value.length; ++i) {
			if (i + offset >= 0 && i + offset < times.value.length) {
				entries.push({
					value: times.value[i + offset].label,
					count: times.value[i].count,
				});
			}
		}
		const ranges = toRanges(entries);
		if (ranges.length) {
			filterByValue(ranges.join(' OR '));
		}
	},
};

function computeEffectSize() {
	effectSizeOptions.value = null;
	if (!times.value?.length || !timesB.value?.length) return;

	const field = findField(props.settings.field);
	const statistic = props.settings.statistic || 'count';

	function toNumbers(items: TimeEntry[]): number[] {
		return items.map((item) => field.toNumber(item[statistic] as number)).filter((n) => !Number.isNaN(n));
	}

	function computeStats(values: number[]) {
		if (!values.length) return null;
		const count = values.length;
		let sum = 0;
		for (let i = 0; i < count; i++) sum += values[i];
		const avg = sum / count;
		let variance = 0;
		for (let i = 0; i < count; i++) variance += (values[i] - avg) ** 2;
		const stdev = Math.sqrt(variance / count);
		return { avg, stdev, count };
	}

	let statsA: { avg: number; stdev: number; count: number } | null;
	let statsB: { avg: number; stdev: number; count: number } | null;

	if (statistic === 'avg') {
		// For avg statistic, request stats from server via search
		// For now, compute from the timeline data we already have
		statsA = computeStats(toNumbers(times.value));
		statsB = computeStats(toNumbers(timesB.value));
	} else {
		statsA = computeStats(toNumbers(times.value));
		statsB = computeStats(toNumbers(timesB.value));
	}

	if (!statsA || statsA.avg === undefined || !statsB || statsB.avg === undefined) return;

	const avgAB = statsB.avg - statsA.avg;
	const z = 1.96;
	const d = z * Math.sqrt((statsA.stdev * statsA.stdev) / statsA.count + (statsB.stdev * statsB.stdev) / statsB.count);
	const lower = avgAB - d;
	const upper = avgAB + d;

	const color = lower <= 0 && upper >= 0 ? '#C0C0C0' : '#555';

	const opts: Record<string, unknown> = {
		chart: {
			type: 'line',
			inverted: true,
			height: 75,
			plotBorderWidth: 1,
			plotBackgroundColor: '#fafafa',
			marginLeft: 45,
			marginRight: 25,
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
			labels: { autoRotation: false },
			lineWidth: 0,
			tickColor: '#C0C0C0',
			tickWidth: 1,
			tickLength: 5,
			tickPosition: 'inside',
			gridLineWidth: 0,
		},
		tooltip: { enabled: false },
		series: [
			{
				data: [[0, avgAB]],
				color,
				animation: false,
				marker: { radius: 5, symbol: 'circle' },
				states: { hover: { enabled: false } },
			},
		] as Array<Record<string, unknown>>,
		legend: { enabled: false },
		credits: { enabled: false },
	};

	if (d > 0) {
		(opts.series as Array<Record<string, unknown>>).push({
			type: 'errorbar',
			data: [[0, avgAB - d, avgAB + d]],
			lineWidth: 2,
			color,
			animation: false,
			states: { hover: { enabled: false } },
		});
	}

	field.formatAxis(opts.yAxis as Record<string, unknown>);
	effectSizeOptions.value = opts;
}

function params(): Record<string, unknown> {
	interval = Interval.valueOf(props.settings.interval || '') || Interval.VALUES[1];
	let range = '';
	let q = '';
	dashboard.getConstraints(keyField).forEach((constraint) => {
		q = constraint.value;
	});
	let r = '';
	dashboard.getConstraintsB(keyField).forEach((constraint) => {
		r = constraint.value;
	});
	const prefix = commonPrefix(q, r);
	if (prefix) {
		const matched = Interval.match(prefix) || Interval.matchRange(prefix) || Interval.matchSymbol(prefix);
		if (matched) {
			interval = matched;
		}
	}
	return {
		id: props.settings.id,
		type: 'timeline',
		key_field: props.settings.key_field || keyField,
		field: props.settings.field,
		unit: props.settings.unit,
		interval: interval.name,
		range,
		filter: props.settings.filter,
	};
}

function update(result: Record<string, unknown>, resultB?: Record<string, unknown>) {
	times.value = (result[props.settings.id] as TimeEntry[]) || [];
	timesB.value = (resultB?.[props.settings.id] as TimeEntry[]) || [];
	nextTick(() => {
		draw();
		computeEffectSize();
	});
}

function init() {
	times.value = null;
	timesB.value = [];
	chartOptions.value = null;
	effectSizeOptions.value = null;
}

function draw() {
	if (!times.value?.length && !timesB.value?.length) return;

	const statistic = props.settings.statistic || 'count';
	const type = statistic === 'count' || statistic === 'sum' ? 'column' : 'line';
	const field = findField(props.settings.field);

	const options: Record<string, unknown> = {
		chart: {
			animation: false,
			zoomType: 'x',
			events: {
				selection: (event: { xAxis: Array<{ min: number; max: number }> }) => {
					let from: string | null = null;
					let to: string | null = null;
					times.value!.forEach((time) => {
						from = from || time.label;
						to = time.label;
					});
					for (let ti = 0; ti < times.value!.length; ti++) {
						if (times.value![ti].time >= event.xAxis[0].min) {
							from = times.value![ti].label;
							break;
						}
					}
					times.value!.forEach((time) => {
						if (time.time <= event.xAxis[0].max) {
							to = time.label;
						}
					});
					if (from !== null && to !== null) {
						const range = from === to ? from : '[' + from + '..' + to + ']';
						filterByValue(range);
					}
					return false;
				},
			},
		},
		title: { text: null },
		xAxis: {
			type: 'datetime',
			labels: { overflow: 'justify' },
			minTickInterval: interval.minTickInterval,
			tickLength: 5,
			tickWidth: 1,
			lineWidth: 1,
			gridLineWidth: 0,
		},
		yAxis: {
			title: { text: null },
			tickLength: 5,
			tickWidth: 1,
			lineWidth: 0,
			gridLineWidth: 0,
			startOnTick: false,
			floor: field.minValue,
			ceiling: field.maxValue,
		},
		tooltip: {
			crosshairs: false,
			shared: false,
			hideDelay: 0,
		},
		series: [
			{
				name: statistic,
				type,
				data: [] as unknown[],
				color: 'rgba(47, 126, 216, 0.4)',
				lineColor: 'rgb(47, 126, 216)',
				marker: {
					symbol: 'circle',
					fillColor: 'white',
					lineWidth: 2,
					lineColor: 'rgb(47, 126, 216)',
				},
				borderRadius: 5,
				borderWidth: 2,
				zIndex: 1,
			},
			{
				name: 'range',
				data: [] as unknown[],
				type: 'arearange',
				lineWidth: 0,
				linkedTo: ':previous',
				fillColor: 'rgba(47, 126, 216, 0.1)',
				zIndex: 0,
			},
		],
		plotOptions: {
			series: {
				animation: false,
				tooltip: {
					headerFormat: '<b>{point.key}:</b> ',
					pointFormat: '{point.tooltip}',
				},
			} as Record<string, unknown>,
		},
		legend: { enabled: false },
		credits: { enabled: false },
		playable: true,
	};

	const series = options.series as Array<Record<string, unknown>>;
	const plotSeries = (options.plotOptions as Record<string, unknown>).series as Record<string, unknown>;

	if (interval !== Interval.VALUES[Interval.VALUES.length - 1]) {
		plotSeries.cursor = 'pointer';
		plotSeries.events = {
			click: (event: { point: { options: { filter: string } } }) => {
				filterByValue(event.point.options.filter);
			},
		};
	}

	if (props.settings.placement === 'top') {
		(options.chart as Record<string, unknown>).height = 150;
	}

	const series0Data = series[0].data as unknown[];
	const series1Data = series[1].data as unknown[];

	times.value!.forEach((time) => {
		const value = time[statistic];
		if (value !== undefined) {
			series0Data.push({ x: time.time, y: field.toNumber(value), filter: time.label, tooltip: field.toText(value) });
			if (statistic === 'avg') {
				series1Data.push({
					x: time.time,
					low: field.toNumber(time['min']),
					high: field.toNumber(time['max']),
					filter: time.label,
					tooltip: field.toText(time['min']) + '..' + field.toText(time['max']),
				});
			}
		} else {
			series0Data.push({ x: time.time, y: null });
			if (statistic === 'avg') {
				series1Data.push({ x: time.time, low: null, high: null });
			}
		}
	});

	if (timesB.value?.length) {
		const seriesB: Record<string, unknown> = {
			name: statistic,
			type,
			data: [],
			color: 'rgba(204, 102, 0, 0.4)',
			lineColor: 'rgb(204, 102, 0)',
			marker: {
				symbol: 'circle',
				fillColor: 'white',
				lineWidth: 2,
				lineColor: 'rgb(204, 102, 0)',
			},
			borderRadius: 5,
			borderWidth: 2,
			zIndex: 1,
		};
		const seriesBRange: Record<string, unknown> = {
			name: 'range',
			data: [],
			type: 'arearange',
			lineWidth: 0,
			linkedTo: ':previous',
			fillColor: 'rgba(204, 102, 0, 0.1)',
			zIndex: 0,
		};
		series.push(seriesB);
		series.push(seriesBRange);

		const seriesBData = seriesB.data as unknown[];
		const seriesBRangeData = seriesBRange.data as unknown[];

		timesB.value.forEach((time) => {
			const value = time[statistic];
			if (value !== undefined) {
				seriesBData.push({ x: time.time, y: field.toNumber(value), filter: time.label, tooltip: field.toText(value) });
				if (statistic === 'avg') {
					seriesBRangeData.push([time.time, field.toNumber(time['min']), field.toNumber(time['max'])]);
				}
			} else {
				seriesBData.push({ x: time.time, y: null });
				if (statistic === 'avg') {
					seriesBRangeData.push([time.time, null, null]);
				}
			}
		});
	}

	if (times.value!.length > 1 && props.settings.regression === 'linear') {
		const regression = statistics.regression(toXY(times.value!));
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

	if (timesB.value && timesB.value.length > 1 && props.settings.regression === 'linear') {
		const regressionB = statistics.regression(toXY(timesB.value));
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

	field.formatAxis(options.yAxis as Record<string, unknown>);
	chartOptions.value = options;
}

const chartRef = ref<InstanceType<typeof HighchartsChart> | null>(null);

function downloadCSV() {
	if (!times.value?.length) return;
	const statistic = props.settings.statistic || 'count';
	const rows = [['time', statistic].join(',')];
	const field = findField(props.settings.field);
	for (const entry of times.value) {
		const value = entry[statistic];
		rows.push([entry.label, value !== undefined ? field.toText(value) : ''].join(','));
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
	filters,
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
			<div class="pull-right dropdown">
				<a class="xbtn dropdown-toggle" data-toggle="dropdown" title="Filter"><i class="fa fa-filter" /><b class="caret" /></a>
				<ul class="dropdown-menu" role="menu">
					<li role="presentation"><a role="menuitem" @click="filters.thisYear()">this year</a></li>
					<li role="presentation"><a role="menuitem" @click="filters.lastYear()">last year</a></li>
					<li class="divider" />
					<li role="presentation"><a role="menuitem" @click="filters.thisMonth()">this month</a></li>
					<li role="presentation"><a role="menuitem" @click="filters.lastMonth()">last month</a></li>
					<li role="presentation"><a role="menuitem" @click="filters.lastMonths(3)">last 3 months</a></li>
					<li class="divider" />
					<li role="presentation"><a role="menuitem" @click="filters.thisWeek()">this week</a></li>
					<li role="presentation"><a role="menuitem" @click="filters.lastWeek()">last week</a></li>
					<li class="divider" />
					<li role="presentation"><a role="menuitem" @click="filters.today()">today</a></li>
					<li role="presentation"><a role="menuitem" @click="filters.yesterday()">yesterday</a></li>
					<li role="presentation"><a role="menuitem" @click="filters.lastHours(24)">last 24 hours</a></li>
					<li class="divider" />
					<li role="presentation"><a role="menuitem" @click="filters.select(0)">select {{ interval.name }}s</a></li>
					<li role="presentation"><a role="menuitem" @click="filters.select(-1)">select previous {{ interval.name }}s</a></li>
					<li role="presentation"><a role="menuitem" @click="filters.select(1)">select following {{ interval.name }}s</a></li>
				</ul>
				<a class="xbtn" title="Download" @click="downloadCSV"><i class="fa fa-file-text" /></a>
				<a class="xbtn" title="Snapshot" @click="chartRef?.snapshot()"><i class="fa fa-camera" /></a>
			</div>
		</div>

		<HighchartsChart ref="chartRef" v-if="times?.length || timesB?.length" :options="chartOptions" :playable="true" />
		<HighchartsChart v-if="effectSizeOptions" :options="effectSizeOptions" />
		<p v-if="times === null" class="none">Loading...</p>
		<p v-else-if="times.length === 0 && timesB.length === 0" class="none">None</p>

		<div class="btn-toolbar">
			<div class="btn-group" />
		</div>
	</div>
</template>
