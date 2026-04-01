import type { Component } from 'vue';
import { defineAsyncComponent } from 'vue';
import type { WidgetType } from '../../types';

export { default as CountWidget } from './CountWidget.vue';
export { default as GanttWidget } from './GanttWidget.vue';
export { default as HeatmapWidget } from './HeatmapWidget.vue';
export { default as ListWidget } from './ListWidget.vue';
export { default as MapWidget } from './MapWidget.vue';
export { default as PolarWidget } from './PolarWidget.vue';
export { default as RatingsWidget } from './RatingsWidget.vue';
export { default as ScatterPlotWidget } from './ScatterPlotWidget.vue';
export { default as ScoreboardWidget } from './ScoreboardWidget.vue';
export { default as TimelineWidget } from './TimelineWidget.vue';

export const SETTINGS_DIALOGS: Record<WidgetType, Component> = {
	count: defineAsyncComponent(() => import('./CountSettingsDialog.vue')),
	list: defineAsyncComponent(() => import('./ListSettingsDialog.vue')),
	gantt: defineAsyncComponent(() => import('./GanttSettingsDialog.vue')),
	ratings: defineAsyncComponent(() => import('./RatingsSettingsDialog.vue')),
	histogram: defineAsyncComponent(() => import('./HistogramSettingsDialog.vue')),
	scoreboard: defineAsyncComponent(() => import('./ScoreboardSettingsDialog.vue')),
	timeline: defineAsyncComponent(() => import('./TimelineSettingsDialog.vue')),
	polar: defineAsyncComponent(() => import('./PolarSettingsDialog.vue')),
	scatterplot: defineAsyncComponent(() => import('./ScatterplotSettingsDialog.vue')),
	map: defineAsyncComponent(() => import('./MapSettingsDialog.vue')),
	heatmap: defineAsyncComponent(() => import('./HeatmapSettingsDialog.vue')),
};
