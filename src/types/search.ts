/** Base interface for all widget search params */
export interface BaseWidgetParams {
	id: string;
	type: string;
	filter?: string;
}

/**
 * The search result is a heterogeneous object keyed by widget ID.
 * Each widget knows its own result shape and extracts it via
 * result[settings.id]. The 'total' key is always present.
 */
export interface SearchResult {
	total?: number;
	[widgetId: string]: unknown;
}

// --- Count Widget ---

export interface CountParams extends BaseWidgetParams {
	type: 'count';
	field: string;
	offset: number;
	limit: number;
	order?: string;
}

export interface CountTerm {
	label: string;
	count: number;
}

// --- Scoreboard Widget ---

export interface ScoreboardParams extends BaseWidgetParams {
	type: 'scoreboard';
	key_field: string;
	value_field: string;
	unit?: string;
	order?: string;
	limit: number;
}

export interface ScoreboardTerm {
	label: string;
	count: number;
	min?: number;
	max?: number;
	sum?: number;
	avg?: number;
}

// --- Ratings Widget ---

export interface RatingsParams extends BaseWidgetParams {
	type: 'ratings';
}

export interface Rating {
	from: number | null;
	to: number | null;
	count: number;
}

// --- List Widget ---

export interface ListParams extends BaseWidgetParams {
	type: 'list';
	offset: number;
	limit: number;
	order?: string;
}

// --- Gantt Widget ---

export interface GanttParams extends BaseWidgetParams {
	type: 'gantt';
	key_field?: string;
	field: string;
	order?: string;
	limit: number;
}

export interface GanttTerm {
	label: string;
	first: string;
	last: string;
	count: number;
	freq?: number;
}

// --- Heatmap Widget ---

export interface HeatmapParams extends BaseWidgetParams {
	type: 'heatmap' | 'geobounds';
	precision?: number;
	value_field?: string;
	unit?: string;
}

export interface HeatmapPoint {
	lat: number;
	lon: number;
	count: number;
	sum?: unknown;
}

export interface GeoBounds {
	lat_min: number;
	lon_min: number;
	lat_max: number;
	lon_max: number;
}

// --- Timeline Widget ---

export interface TimelineParams extends BaseWidgetParams {
	type: 'timeline';
	key_field?: string;
	field: string;
	unit?: string;
	interval: string;
	range?: string;
}

export interface TimeEntry {
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

// --- Histogram Widget ---

export interface HistogramParams extends BaseWidgetParams {
	type: 'histogram';
	field: string;
	interval: number;
	unit?: string;
}

export interface HistogramInterval {
	from: unknown;
	to: unknown;
	count: number;
}

// --- Polar Widget ---

export interface PolarParams extends BaseWidgetParams {
	type: 'polar';
	key_field?: string;
	value_field: string;
	unit?: string;
	interval: string;
}

export interface PolarEntry {
	label: string;
	value: string;
	count: number;
	[key: string]: unknown;
}

// --- ScatterPlot Widget ---

export interface ScatterPlotParams extends BaseWidgetParams {
	type: 'scatterplot';
	field_x: string;
	unit_x?: string;
	statistic_x?: string;
	filter_x?: string;
	field_y: string;
	unit_y?: string;
	statistic_y?: string;
	filter_y?: string;
	key_field?: string;
	interval?: string;
	lag?: number;
}

// --- Map Widget ---

export interface MapParams extends BaseWidgetParams {
	type: 'geobounds' | 'map';
	precision?: number;
}

export interface MapPoint {
	lat: number;
	lon: number;
	count: number;
	lat_min: number;
	lat_max: number;
	lon_min: number;
	lon_max: number;
}

// --- Shared ---

export interface FieldInfo {
	toNumber(value: unknown): number;
	toText(value: unknown): string;
	formatAxis(axis: Record<string, unknown>): void;
	minValue?: number;
	maxValue?: number;
}
