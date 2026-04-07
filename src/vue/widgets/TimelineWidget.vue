<script setup lang="ts">
import type { ECharts } from 'echarts/core';
import { inject, nextTick, onMounted, ref } from 'vue';
import type { FieldInfo, SearchResult, TimeEntry, TimelineParams } from '../../types/search';
import { compactDuration, compactNumber } from '../../utils/helpers';
import { Interval, type IntervalDef } from '../../utils/interval';
import { statistics } from '../../utils/statistics';
import { type DashboardApi, dashboardKey, type WidgetRegistration } from '../composables/useDashboard';
import { BRAND_BLUE_RGB } from '../plugins/vuetify';
import { downloadCsv, toFilename, unwrapValue } from './csv';
import EChartsChart from './EChartsChart.vue';

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

const props = defineProps<{
	settings: {
		id: string;
		label?: string;
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
const chartHeight = ref<number | undefined>();
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

function _isPaired(a: TimeEntry[], b: TimeEntry[]): boolean {
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
		animation: false,
		grid: {
			left: 45,
			right: 25,
			top: 10,
			bottom: 10,
		},
		xAxis: {
			type: 'value',
			show: false,
		},
		yAxis: {
			type: 'value',
			axisLine: { show: false },
			axisTick: { show: false },
			splitLine: { show: false },
		},
		tooltip: { show: false },
		series: [
			{
				type: 'scatter',
				data: [[0, avgAB]],
				symbolSize: 10,
				itemStyle: { color },
			},
		] as unknown[],
		legend: { show: false },
	};

	if (d > 0) {
		(opts.series as unknown[]).push({
			type: 'custom',
			data: [[0, lower, upper]],
			renderItem: (_params: unknown, api: { coord: (val: number[]) => number[]; style: (opts: Record<string, unknown>) => Record<string, unknown> }) => {
				const lowPt = api.coord([0, lower]);
				const highPt = api.coord([0, upper]);
				return {
					type: 'group',
					children: [
						{
							type: 'line',
							shape: { x1: lowPt[0], y1: lowPt[1], x2: highPt[0], y2: highPt[1] },
							style: { stroke: color, lineWidth: 2 },
						},
						{
							type: 'line',
							shape: { x1: lowPt[0] - 4, y1: lowPt[1], x2: lowPt[0] + 4, y2: lowPt[1] },
							style: { stroke: color, lineWidth: 2 },
						},
						{
							type: 'line',
							shape: { x1: highPt[0] - 4, y1: highPt[1], x2: highPt[0] + 4, y2: highPt[1] },
							style: { stroke: color, lineWidth: 2 },
						},
					],
				};
			},
		});
	}

	effectSizeOptions.value = opts;
}

function params(): TimelineParams {
	interval = Interval.findByName(props.settings.interval || '') || Interval.VALUES[1];
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

function update(result: SearchResult, resultB?: SearchResult) {
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
	const type = statistic === 'count' || statistic === 'sum' ? 'bar' : 'line';
	const field = findField(props.settings.field);
	const isDuration = props.settings.field.startsWith('duration');

	const canDrillDown = interval !== Interval.VALUES[Interval.VALUES.length - 1];

	const seriesA: Record<string, unknown> = {
		name: statistic,
		type,
		data: [] as unknown[],
		cursor: canDrillDown ? 'pointer' : 'default',
		z: 2,
		...(type === 'bar'
			? {
					itemStyle: { color: `rgba(${BRAND_BLUE_RGB}, 0.4)`, borderWidth: 0, borderRadius: 5 },
				}
			: {
					lineStyle: { color: `rgb(${BRAND_BLUE_RGB})`, width: 2 },
					symbol: 'circle',
					symbolSize: 8,
					itemStyle: { color: '#fff', borderColor: `rgb(${BRAND_BLUE_RGB})`, borderWidth: 2 },
				}),
	};

	const seriesRange: Record<string, unknown> = {
		name: 'range-upper',
		type: 'line',
		data: [] as unknown[],
		lineStyle: { opacity: 0 },
		areaStyle: { color: `rgba(${BRAND_BLUE_RGB}, 0.1)` },
		symbol: 'none',
		stack: 'range-a',
		z: 1,
		silent: true,
	};

	const seriesRangeLower: Record<string, unknown> = {
		name: 'range-lower',
		type: 'line',
		data: [] as unknown[],
		lineStyle: { opacity: 0 },
		areaStyle: { opacity: 0 },
		symbol: 'none',
		stack: 'range-a',
		z: 1,
		silent: true,
	};

	const allSeries: Record<string, unknown>[] = [seriesA];

	const seriesAData = seriesA.data as unknown[];
	const rangeUpperData = seriesRange.data as unknown[];
	const rangeLowerData = seriesRangeLower.data as unknown[];

	const labelMap: Record<number, string> = {};

	times.value!.forEach((time) => {
		const value = time[statistic];
		labelMap[time.time] = time.label;
		if (value !== undefined) {
			seriesAData.push([time.time, field.toNumber(value)]);
			if (statistic === 'avg') {
				rangeLowerData.push([time.time, field.toNumber(time['min'])]);
				rangeUpperData.push([time.time, field.toNumber(time['max']) - field.toNumber(time['min'])]);
			}
		} else {
			seriesAData.push([time.time, null]);
			if (statistic === 'avg') {
				rangeLowerData.push([time.time, null]);
				rangeUpperData.push([time.time, null]);
			}
		}
	});

	if (statistic === 'avg') {
		allSeries.push(seriesRangeLower, seriesRange);
	}

	if (timesB.value?.length) {
		const seriesB: Record<string, unknown> = {
			name: statistic + '-B',
			type,
			data: [] as unknown[],
			z: 2,
			...(type === 'bar'
				? {
						itemStyle: { color: 'rgba(204, 102, 0, 0.4)', borderWidth: 0, borderRadius: 5 },
					}
				: {
						lineStyle: { color: 'rgb(204, 102, 0)', width: 2 },
						symbol: 'circle',
						symbolSize: 8,
						itemStyle: { color: '#fff', borderColor: 'rgb(204, 102, 0)', borderWidth: 2 },
					}),
		};
		const seriesBData = seriesB.data as unknown[];

		timesB.value.forEach((time) => {
			const value = time[statistic];
			labelMap[time.time] = time.label;
			if (value !== undefined) {
				seriesBData.push([time.time, field.toNumber(value)]);
			} else {
				seriesBData.push([time.time, null]);
			}
		});
		allSeries.push(seriesB);

		if (statistic === 'avg') {
			const seriesBRangeLower: Record<string, unknown> = {
				name: 'range-lower-B',
				type: 'line',
				data: [] as unknown[],
				lineStyle: { opacity: 0 },
				areaStyle: { opacity: 0 },
				symbol: 'none',
				stack: 'range-b',
				z: 1,
				silent: true,
			};
			const seriesBRange: Record<string, unknown> = {
				name: 'range-upper-B',
				type: 'line',
				data: [] as unknown[],
				lineStyle: { opacity: 0 },
				areaStyle: { color: 'rgba(204, 102, 0, 0.1)' },
				symbol: 'none',
				stack: 'range-b',
				z: 1,
				silent: true,
			};
			const bRangeLowerData = seriesBRangeLower.data as unknown[];
			const bRangeUpperData = seriesBRange.data as unknown[];
			timesB.value.forEach((time) => {
				const value = time[statistic];
				if (value !== undefined) {
					bRangeLowerData.push([time.time, field.toNumber(time['min'])]);
					bRangeUpperData.push([time.time, field.toNumber(time['max']) - field.toNumber(time['min'])]);
				} else {
					bRangeLowerData.push([time.time, null]);
					bRangeUpperData.push([time.time, null]);
				}
			});
			allSeries.push(seriesBRangeLower, seriesBRange);
		}
	}

	if (times.value!.length > 1 && props.settings.regression === 'linear') {
		const regression = statistics.regression(toXY(times.value!));
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

	if (timesB.value && timesB.value.length > 1 && props.settings.regression === 'linear') {
		const regressionB = statistics.regression(toXY(timesB.value));
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
		grid: { left: 50, right: 20, top: 10, bottom: 30 },
		xAxis: {
			type: 'time',
			splitNumber: 10,
			axisLabel: { hideOverlap: true },
			axisLine: { lineStyle: { color: '#ccc' } },
			axisTick: { lineStyle: { color: '#ccc' } },
			minInterval: interval.minTickInterval,
			splitLine: { show: false },
		},
		yAxis: {
			type: 'value',
			splitNumber: 4,
			axisLine: { show: false },
			axisTick: { show: true, lineStyle: { color: '#ccc' } },
			axisLabel: { formatter: isDuration ? compactDuration : compactNumber },
			splitLine: { show: false },
			min: field.minValue,
			max: field.maxValue,
		},
		tooltip: {
			trigger: 'item',
			formatter: (params: { value: unknown[] }) => {
				if (!params?.value) return '';
				const v = params.value[1];
				return `<b>${labelMap[params.value[0] as number] ?? ''}</b>: ${isDuration ? compactDuration(v as number) : field.toText(v)}`;
			},
		},
		dataZoom: [{ type: 'inside', xAxisIndex: 0, moveOnMouseMove: false, moveOnMouseWheel: false }],
		toolbox: { show: false, feature: { brush: { type: ['lineX'] } } },
		brush: {
			xAxisIndex: 0,
			brushType: 'lineX',
			throttleType: 'fixRate',
			throttleDelay: 0,
		},
		series: allSeries,
		legend: { show: false },
	};

	chartOptions.value = options;
}

const chartRef = ref<InstanceType<typeof EChartsChart> | null>(null);

function onChartReady(instance: ECharts) {
	const drillDown = interval !== Interval.VALUES[Interval.VALUES.length - 1];
	if (drillDown) {
		instance.on('click', (params: unknown) => {
			const p = params as Record<string, unknown>;
			const value = p.value as unknown[] | undefined;
			if (value) {
				const time = value[0] as number;
				const label = times.value?.find((t) => t.time === time)?.label ?? timesB.value?.find((t) => t.time === time)?.label;
				if (label) filterByValue(label);
			}
		});
	}
	activateBrush(instance);
	let pendingRange: number[] | null = null;
	instance.on('brushSelected', (params: unknown) => {
		const p = params as Record<string, unknown>;
		const batch = p.batch as Array<{ areas: Array<{ coordRange: number[] }> }> | undefined;
		if (!batch?.length || !batch[0].areas?.length) {
			pendingRange = null;
			return;
		}
		pendingRange = batch[0].areas[0].coordRange;
	});
	instance.on('brushEnd', () => {
		if (!pendingRange || !times.value) return;
		let from: string | null = null;
		let to: string | null = null;
		for (const time of times.value) {
			if (time.time >= pendingRange[0] && time.time <= pendingRange[1]) {
				from = from || time.label;
				to = time.label;
			}
		}
		pendingRange = null;
		if (from !== null && to !== null) {
			const value = from === to ? from : '[' + from + '..' + to + ']';
			filterByValue(value);
		}
		// Re-activate brush for next selection
		activateBrush(instance);
	});
}

function activateBrush(instance: ECharts) {
	instance.dispatchAction({
		type: 'takeGlobalCursor',
		key: 'brush',
		brushOption: { brushType: 'lineX', brushMode: 'single' },
	});
}

function downloadCSV() {
	if (!times.value?.length) return;
	const statistic = props.settings.statistic || 'count';
	const unit = unwrapValue(times.value[0][statistic]).unit;
	const header = unit ? `${statistic}_${unit}` : statistic;
	const rows = [['time', header]];
	for (const entry of times.value) {
		rows.push([entry.label, unwrapValue(entry[statistic]).value]);
	}
	downloadCsv(rows, `${toFilename(props.settings.label || props.settings.id)}.csv`);
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
		<v-row v-show="times?.length || timesB?.length">
			<v-spacer />
			<div class="d-flex ga-1">
				<v-menu>
					<template #activator="{ props: menuProps }">
						<v-btn variant="text" size="small" class="xbtn" title="Filter" v-bind="menuProps"><v-icon icon="mdi-filter" size="small" /><v-icon icon="mdi-menu-down" size="small" /></v-btn>
					</template>
					<v-list>
						<v-list-item @click="filters.thisYear()">this year</v-list-item>
						<v-list-item @click="filters.lastYear()">last year</v-list-item>
						<v-divider />
						<v-list-item @click="filters.thisMonth()">this month</v-list-item>
						<v-list-item @click="filters.lastMonth()">last month</v-list-item>
						<v-list-item @click="filters.lastMonths(3)">last 3 months</v-list-item>
						<v-divider />
						<v-list-item @click="filters.thisWeek()">this week</v-list-item>
						<v-list-item @click="filters.lastWeek()">last week</v-list-item>
						<v-divider />
						<v-list-item @click="filters.today()">today</v-list-item>
						<v-list-item @click="filters.yesterday()">yesterday</v-list-item>
						<v-list-item @click="filters.lastHours(24)">last 24 hours</v-list-item>
						<v-divider />
						<v-list-item @click="filters.select(0)">select {{ interval.name }}s</v-list-item>
						<v-list-item @click="filters.select(-1)">select previous {{ interval.name }}s</v-list-item>
						<v-list-item @click="filters.select(1)">select following {{ interval.name }}s</v-list-item>
					</v-list>
				</v-menu>
				<v-btn variant="text" size="small" class="xbtn" title="Download" @click="downloadCSV"><v-icon icon="mdi-download" size="small" /></v-btn>
				<v-btn variant="text" size="small" class="xbtn" title="Snapshot" @click="chartRef?.snapshot()"><v-icon icon="mdi-camera" size="small" /></v-btn>
			</div>
		</v-row>

		<EChartsChart ref="chartRef" v-if="times?.length || timesB?.length" :options="chartOptions" :height="chartHeight" @ready="onChartReady" @updated="activateBrush" />
		<EChartsChart v-if="effectSizeOptions" :options="effectSizeOptions" />
		<p v-if="times === null" class="none">Loading...</p>
		<p v-else-if="times.length === 0 && timesB.length === 0" class="none">None</p>
	</div>
</template>

<style scoped>
:deep(.echarts-chart div[style*="cursor"]) {
	cursor: pointer !important;
}
</style>
