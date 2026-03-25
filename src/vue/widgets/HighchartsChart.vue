<script setup lang="ts">
import { onBeforeUnmount, ref, watch } from 'vue';
import { deepExtend } from '../../utils/helpers';

declare const Highcharts: {
	Chart: new (options: Record<string, unknown>) => HighchartsChartInstance;
};

interface HighchartsChartInstance {
	destroy(): void;
	reflow(): void;
	series: Array<{ data: Array<{ select(active: boolean): void }> }>;
	exportChart(options: Record<string, unknown>): void;
}

const props = defineProps<{
	options: Record<string, unknown> | null;
	playable?: boolean;
}>();

const emit = defineEmits<{
	snapshot: [];
}>();

const chartEl = ref<HTMLDivElement | null>(null);
let chart: HighchartsChartInstance | null = null;

function render(options: Record<string, unknown> | null) {
	if (chart) {
		chart.destroy();
		chart = null;
	}
	if (options && chartEl.value) {
		const merged = deepExtend({}, options, {
			chart: { renderTo: chartEl.value },
			exporting: { enabled: false },
		});
		chart = new Highcharts.Chart(merged as Record<string, unknown>);
	}
}

watch(() => props.options, render, { deep: true });

function snapshot() {
	if (chart) {
		chart.exportChart({ type: 'image/png' });
	}
	emit('snapshot');
}

function reflow() {
	chart?.reflow();
}

function selectPoint(index: number, active: boolean) {
	if (chart?.series[0]?.data) {
		const data = chart.series[0].data;
		data[index % data.length]?.select(active);
	}
}

onBeforeUnmount(() => {
	if (chart) {
		chart.destroy();
		chart = null;
	}
});

defineExpose({ snapshot, reflow, selectPoint });
</script>

<template>
	<div ref="chartEl" />
</template>
