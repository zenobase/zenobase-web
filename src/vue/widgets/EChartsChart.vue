<script setup lang="ts">
import { BarChart, CustomChart, LineChart, ScatterChart } from 'echarts/charts';
import { BrushComponent, DataZoomComponent, GridComponent, LegendComponent, PolarComponent, ToolboxComponent, TooltipComponent } from 'echarts/components';
import * as echarts from 'echarts/core';
import { CanvasRenderer } from 'echarts/renderers';
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';

echarts.use([BarChart, CustomChart, LineChart, ScatterChart, BrushComponent, DataZoomComponent, GridComponent, LegendComponent, PolarComponent, ToolboxComponent, TooltipComponent, CanvasRenderer]);

export type { ECharts } from 'echarts/core';

const props = defineProps<{
	options: Record<string, unknown> | null;
	height?: number;
}>();

const emit = defineEmits<{
	snapshot: [];
	ready: [instance: echarts.ECharts];
	updated: [instance: echarts.ECharts];
}>();

const chartEl = ref<HTMLDivElement | null>(null);
let chart: echarts.ECharts | null = null;
let resizeObserver: ResizeObserver | null = null;

function render(options: Record<string, unknown> | null) {
	if (chartEl.value) {
		if (props.height) {
			chartEl.value.style.height = `${props.height}px`;
		} else if (!chartEl.value.style.height) {
			chartEl.value.style.height = '300px';
		}
		if (!chartEl.value.clientWidth || !chartEl.value.clientHeight) {
			requestAnimationFrame(() => render(options));
			return;
		}
	}
	if (chart) {
		if (options) {
			chart.setOption(options, { notMerge: true });
			emit('updated', chart);
		} else {
			chart.dispose();
			chart = null;
		}
	} else if (options && chartEl.value) {
		chart = echarts.init(chartEl.value);
		chart.setOption(options);
		emit('ready', chart);
	}
}

watch(
	() => props.options,
	(options) => nextTick(() => render(options)),
	{ deep: true },
);

watch(
	() => props.height,
	() => nextTick(() => render(props.options)),
);

function snapshot() {
	if (chart) {
		const url = chart.getDataURL({ type: 'png', backgroundColor: '#fff' });
		const a = document.createElement('a');
		a.href = url;
		a.download = 'chart.png';
		document.body.appendChild(a);
		a.click();
		document.body.removeChild(a);
	}
	emit('snapshot');
}

function reflow() {
	chart?.resize();
}

function selectPoint(seriesIndex: number, dataIndex: number, active: boolean) {
	if (chart) {
		chart.dispatchAction({
			type: active ? 'select' : 'unselect',
			seriesIndex,
			dataIndex,
		});
	}
}

function getInstance(): echarts.ECharts | null {
	return chart;
}

const focused = ref(false);
let focusTimeout: ReturnType<typeof setTimeout> | null = null;
let justFocused = false;

function focus() {
	justFocused = true;
	focused.value = true;
	resetFocusTimeout();
	requestAnimationFrame(() => { justFocused = false; });
}

function resetFocusTimeout() {
	if (focusTimeout) clearTimeout(focusTimeout);
	focusTimeout = setTimeout(() => { focused.value = false; }, 5000);
}

function onClickOutside() {
	if (justFocused) return;
	focused.value = false;
}

onMounted(() => {
	if (chartEl.value) {
		resizeObserver = new ResizeObserver(() => chart?.resize());
		resizeObserver.observe(chartEl.value);
	}
	document.addEventListener('click', onClickOutside);
});

onBeforeUnmount(() => {
	resizeObserver?.disconnect();
	resizeObserver = null;
	if (chart) {
		chart.dispose();
		chart = null;
	}
	if (focusTimeout) clearTimeout(focusTimeout);
	document.removeEventListener('click', onClickOutside);
});

defineExpose({ snapshot, reflow, selectPoint, getInstance });
</script>

<template>
	<div class="echarts-chart-container" :class="{ 'echarts-chart-container--focused': focused }" @click="focus">
		<div ref="chartEl" class="echarts-chart" />
		<div v-if="!focused" class="echarts-chart-overlay" />
	</div>
</template>

<style>
.echarts-chart-container {
	position: relative;
}

.echarts-chart [style*="crosshair"] {
	cursor: pointer;
}

.echarts-chart-overlay {
	display: none;
}

@media (hover: none) {
	.echarts-chart-overlay {
		display: block;
		position: absolute;
		inset: 0;
		z-index: 1;
		touch-action: pan-y;
	}

	.echarts-chart-container--focused {
		outline: 2px solid rgb(var(--v-theme-primary));
		outline-offset: -2px;
		box-shadow: 0 0 8px rgba(var(--v-theme-primary), 0.4);
	}
}
</style>
