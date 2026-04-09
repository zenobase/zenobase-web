import type { Component } from 'vue';
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

import CountSettingsDialog from './CountSettingsDialog.vue';
import GanttSettingsDialog from './GanttSettingsDialog.vue';
import HeatmapSettingsDialog from './HeatmapSettingsDialog.vue';
import HistogramSettingsDialog from './HistogramSettingsDialog.vue';
import ListSettingsDialog from './ListSettingsDialog.vue';
import MapSettingsDialog from './MapSettingsDialog.vue';
import PolarSettingsDialog from './PolarSettingsDialog.vue';
import RatingsSettingsDialog from './RatingsSettingsDialog.vue';
import ScatterplotSettingsDialog from './ScatterplotSettingsDialog.vue';
import ScoreboardSettingsDialog from './ScoreboardSettingsDialog.vue';
import TimelineSettingsDialog from './TimelineSettingsDialog.vue';

export const SETTINGS_DIALOGS: Record<WidgetType, Component> = {
	count: CountSettingsDialog,
	list: ListSettingsDialog,
	gantt: GanttSettingsDialog,
	ratings: RatingsSettingsDialog,
	histogram: HistogramSettingsDialog,
	scoreboard: ScoreboardSettingsDialog,
	timeline: TimelineSettingsDialog,
	polar: PolarSettingsDialog,
	scatterplot: ScatterplotSettingsDialog,
	map: MapSettingsDialog,
	heatmap: HeatmapSettingsDialog,
};
