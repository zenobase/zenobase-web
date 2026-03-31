<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue';
import { Constraint } from '../../utils/constraint';
import {
	getNumericAndTimestampFieldNames,
	getNumericFieldNames,
	getStatisticsForField,
	getUnitsForField,
	POLAR_INTERVALS,
	REGRESSION_METHODS,
	TIMELINE_INTERVALS,
	TIMESTAMP_SUBFIELDS,
} from '../utils/fieldRegistry';

export type WidgetType = 'count' | 'list' | 'gantt' | 'ratings' | 'histogram' | 'scoreboard' | 'timeline' | 'polar' | 'scatterplot' | 'map' | 'heatmap';

export interface WidgetSettings {
	id?: string;
	label?: string;
	filter?: string;
	field?: string;
	limit?: number;
	order?: string;
	key_field?: string;
	value_field?: string;
	unit?: string | null;
	interval?: string | number | null;
	statistic?: string;
	statistics?: string[];
	regression?: string;
	mark?: string;
	scale?: string;
	tempo?: number;
	label_x?: string;
	label_y?: string;
	field_x?: string;
	field_y?: string;
	unit_x?: string | null;
	unit_y?: string | null;
	statistic_x?: string;
	statistic_y?: string;
	filter_x?: string;
	filter_y?: string;
	lag?: number;
	[key: string]: unknown;
}

const WIDGET_TITLES: Record<WidgetType, string> = {
	count: 'Count Widget',
	list: 'List Widget',
	gantt: 'Frequency Widget',
	ratings: 'Ratings Widget',
	histogram: 'Histogram Widget',
	scoreboard: 'Scoreboard Widget',
	timeline: 'Timeline Widget',
	polar: 'Time Histogram Widget',
	scatterplot: 'Scatter Plot Widget',
	map: 'Map Widget',
	heatmap: 'Heatmap Widget',
};

const props = defineProps<{
	modelValue: boolean;
	settings: WidgetSettings;
	widgetType: WidgetType;
}>();

const emit = defineEmits<{
	'update:modelValue': [value: boolean];
	save: [settings: WidgetSettings];
	remove: [];
}>();

const visible = ref(false);
const draft = ref<WidgetSettings>({});

// --- Order helpers ---

function getOrderField(): string {
	if (!draft.value.order) return '';
	return draft.value.order.charAt(0) === '-' ? draft.value.order.substring(1) : draft.value.order;
}

function setOrderField(field: string) {
	const isAsc = getIsAsc();
	draft.value.order = isAsc ? field : '-' + field;
}

function getIsAsc(): boolean {
	if (!draft.value.order) return true;
	return draft.value.order.charAt(0) !== '-';
}

function setIsAsc(asc: boolean) {
	const field = getOrderField();
	draft.value.order = asc ? field : '-' + field;
}

const orderField = computed({
	get: () => getOrderField(),
	set: (v: string) => setOrderField(v),
});

const isAsc = computed({
	get: () => getIsAsc(),
	set: (v: boolean) => setIsAsc(v),
});

// --- Order-by options per widget type ---

const orderByOptions = computed<string[]>(() => {
	switch (props.widgetType) {
		case 'count':
			return ['term', 'count'];
		case 'list':
			return ['timestamp', ...getNumericFieldNames()];
		case 'gantt':
			return ['term', 'max'];
		case 'scoreboard':
			return ['term', 'count', 'sum', 'min', 'max', 'avg'];
		default:
			return [];
	}
});

const hasOrder = computed(() => orderByOptions.value.length > 0);

// --- Field options ---

const textFieldNames = computed(() => ['author', 'tag']);
const numericFieldNames = computed(() => getNumericFieldNames());
const numericAndTimestampFieldNames = computed(() => getNumericAndTimestampFieldNames());

// --- Units ---

function unitsForField(fieldName: string | undefined | null): string[] {
	if (!fieldName) return [];
	return getUnitsForField(fieldName);
}

const currentUnits = computed(() => unitsForField(draft.value.field));
const currentValueUnits = computed(() => unitsForField(draft.value.value_field));
const currentUnitsX = computed(() => unitsForField(draft.value.field_x));
const currentUnitsY = computed(() => unitsForField(draft.value.field_y));

// --- Statistics ---

function statisticsFor(fieldName: string | undefined | null): string[] {
	if (!fieldName) return ['count'];
	return getStatisticsForField(fieldName);
}

// --- Scoreboard statistics checkboxes ---

function isStatisticSelected(stat: string): boolean {
	return draft.value.statistics?.includes(stat) ?? false;
}

function toggleStatistic(stat: string) {
	if (!draft.value.statistics) {
		draft.value.statistics = [];
	}
	const idx = draft.value.statistics.indexOf(stat);
	if (idx !== -1) {
		draft.value.statistics.splice(idx, 1);
	} else {
		draft.value.statistics.push(stat);
	}
}

// --- Scatterplot swap ---

function swapAxes() {
	const s = draft.value;
	const tmp = (p1: string, p2: string) => {
		const t = s[p1];
		s[p1] = s[p2];
		s[p2] = t;
	};
	tmp('label_x', 'label_y');
	tmp('statistic_x', 'statistic_y');
	tmp('field_x', 'field_y');
	tmp('unit_x', 'unit_y');
	tmp('filter_x', 'filter_y');
	if (s.lag) {
		s.lag = -(s.lag as number);
	}
}

// --- Filter validation ---

function isFilterValid(filter: string | undefined | null): boolean | null {
	if (!filter) return null;
	try {
		for (const part of filter.split('|')) Constraint.parse(part.trim());
		return true;
	} catch {
		return false;
	}
}

const filterValid = computed(() => isFilterValid(draft.value.filter));
const filterXValid = computed(() => isFilterValid(draft.value.filter_x));
const filterYValid = computed(() => isFilterValid(draft.value.filter_y));

// --- Submit validation ---

const canSubmit = computed(() => {
	if (props.widgetType === 'histogram') {
		const interval = Number(draft.value.interval);
		if (!interval || interval <= 0) return false;
	}
	return true;
});

// --- Watchers for unit/statistic validity ---

watch(
	() => draft.value.field,
	() => {
		if (props.widgetType === 'histogram' || props.widgetType === 'timeline') {
			const units = unitsForField(draft.value.field);
			if (units.length === 0 ? draft.value.unit !== null : !units.includes(draft.value.unit as string)) {
				draft.value.unit = null;
			}
		}
		if (props.widgetType === 'timeline') {
			const stats = statisticsFor(draft.value.field);
			if (!stats.includes(draft.value.statistic ?? '')) {
				draft.value.statistic = stats[0];
			}
		}
	},
);

watch(
	() => draft.value.value_field,
	() => {
		if (props.widgetType === 'scoreboard' || props.widgetType === 'polar') {
			const units = unitsForField(draft.value.value_field);
			if (units.length === 0 ? draft.value.unit !== null : !units.includes(draft.value.unit as string)) {
				draft.value.unit = null;
			}
		}
		if (props.widgetType === 'polar') {
			const stats = statisticsFor(draft.value.value_field);
			if (!stats.includes(draft.value.statistic ?? '')) {
				draft.value.statistic = stats[0];
			}
		}
		if (props.widgetType === 'heatmap') {
			const units = unitsForField(draft.value.value_field);
			draft.value.unit = units.length ? units[0] : '';
		}
	},
);

watch(
	() => draft.value.field_x,
	() => {
		if (props.widgetType === 'scatterplot') {
			const units = unitsForField(draft.value.field_x);
			if (units.length === 0 ? draft.value.unit_x !== null : !units.includes(draft.value.unit_x as string)) {
				draft.value.unit_x = null;
			}
		}
	},
);

watch(
	() => draft.value.field_y,
	() => {
		if (props.widgetType === 'scatterplot') {
			const units = unitsForField(draft.value.field_y);
			if (units.length === 0 ? draft.value.unit_y !== null : !units.includes(draft.value.unit_y as string)) {
				draft.value.unit_y = null;
			}
		}
	},
);

// --- Dialog open/close ---

function close() {
	visible.value = false;
	emit('update:modelValue', false);
}

function save() {
	emit('save', JSON.parse(JSON.stringify(draft.value)) as WidgetSettings);
	close();
}

function remove() {
	emit('remove');
	close();
}

watch(
	() => props.modelValue,
	(open) => {
		if (open) {
			draft.value = JSON.parse(JSON.stringify(props.settings)) as WidgetSettings;
			if (props.widgetType === 'timeline' && !draft.value.interval) {
				draft.value.interval = 'month';
			}
			if (props.widgetType === 'scoreboard' && !draft.value.statistics) {
				draft.value.statistics = ['count', 'sum', 'avg'];
			}
			nextTick(() => {
				visible.value = true;
			});
		} else {
			visible.value = false;
		}
	},
	{ immediate: true },
);
</script>

<template>
	<div v-if="visible" class="modal-backdrop fade in" @click="close()" />
	<div class="modal" :class="{ hide: !visible, in: visible, fade: true }" :style="visible ? { display: 'block', top: '10%' } : {}">
		<form class="modal-form" @submit.prevent="save()">
			<div class="modal-header">
				<a class="close" @click="close()">&times;</a>
				<h4>{{ WIDGET_TITLES[widgetType] }}</h4>
			</div>
			<div class="modal-body">
				<!-- Label (all widgets) -->
				<div class="control-group">
					<label class="control-label">Title</label>
					<div class="controls form-horizontal">
						<input type="text" required maxlength="20" v-model="draft.label" />
					</div>
				</div>

				<!-- Count: field (text fields dropdown) -->
				<div v-if="widgetType === 'count'" class="control-group">
					<label class="control-label">Term</label>
					<div class="controls form-horizontal">
						<select required v-model="draft.field" class="input-medium">
							<option v-for="f in textFieldNames" :key="f" :value="f">{{ f }}</option>
						</select>
					</div>
				</div>

				<!-- Gantt: field (text fields) -->
				<div v-if="widgetType === 'gantt'" class="control-group">
					<label class="control-label">Field</label>
					<div class="controls">
						<select required v-model="draft.field">
							<option v-for="f in textFieldNames" :key="f" :value="f">{{ f }}</option>
						</select>
						<p class="help-block">The field containing the values to aggregate.</p>
					</div>
				</div>

				<!-- Gantt: key_field (timestamp subfields) -->
				<div v-if="widgetType === 'gantt'" class="control-group">
					<label class="control-label">Timestamp</label>
					<div class="controls form-horizontal">
						<select class="input-small" v-model="draft.key_field">
							<option v-for="sf in TIMESTAMP_SUBFIELDS" :key="sf.value" :value="sf.value">{{ sf.label }}</option>
						</select>
						<p class="help-block">How to handle events with multiple timestamps.</p>
					</div>
				</div>

				<!-- Histogram: field + interval + unit -->
				<div v-if="widgetType === 'histogram'" class="control-group">
					<label class="control-label">Values</label>
					<div class="controls form-horizontal">
						<select class="input-medium" required v-model="draft.field">
							<option v-for="f in numericFieldNames" :key="f" :value="f">{{ f }}</option>
						</select>
						by <input class="input-mini" type="text" v-model="draft.interval" />
						<select v-if="currentUnits.length" class="input-small" v-model="draft.unit">
							<option v-for="u in currentUnits" :key="u" :value="u">{{ u }}</option>
						</select>
					</div>
				</div>

				<!-- Scoreboard: key_field (text fields) -->
				<div v-if="widgetType === 'scoreboard'" class="control-group">
					<label class="control-label">Term</label>
					<div class="controls form-horizontal">
						<select required v-model="draft.key_field">
							<option v-for="f in textFieldNames" :key="f" :value="f">{{ f }}</option>
						</select>
					</div>
				</div>

				<!-- Scoreboard: value_field + unit -->
				<div v-if="widgetType === 'scoreboard'" class="control-group">
					<label class="control-label">Values</label>
					<div class="controls form-horizontal">
						<select class="input-medium" required v-model="draft.value_field">
							<option v-for="f in numericFieldNames" :key="f" :value="f">{{ f }}</option>
						</select>
						<span v-if="currentValueUnits.length">
							in
							<select class="input-small" v-model="draft.unit">
								<option v-for="u in currentValueUnits" :key="u" :value="u">{{ u }}</option>
							</select>
						</span>
					</div>
				</div>

				<!-- Timeline: statistic + field + unit -->
				<div v-if="widgetType === 'timeline'" class="control-group">
					<label class="control-label">Values</label>
					<div class="controls form-horizontal">
						<select class="input-small" required v-model="draft.statistic">
							<option v-for="s in statisticsFor(draft.field)" :key="s" :value="s">{{ s }}</option>
						</select>
						of
						<select class="input-medium" v-model="draft.field">
							<option v-for="f in numericAndTimestampFieldNames" :key="f" :value="f">{{ f }}</option>
						</select>
						<span v-if="currentUnits.length">
							in
							<select class="input-small" v-model="draft.unit">
								<option v-for="u in currentUnits" :key="u" :value="u">{{ u }}</option>
							</select>
						</span>
					</div>
				</div>

				<!-- Timeline: default interval -->
				<div v-if="widgetType === 'timeline'" class="control-group">
					<label class="control-label">Default Interval</label>
					<div class="controls form-horizontal">
						<select v-model="draft.interval">
							<option v-for="i in TIMELINE_INTERVALS" :key="i.name" :value="i.name">{{ i.name }}</option>
						</select>
					</div>
				</div>

				<!-- Timeline: regression -->
				<div v-if="widgetType === 'timeline'" class="control-group">
					<label class="control-label">Regression</label>
					<div class="controls">
						<select v-model="draft.regression">
							<option value="">None</option>
							<option v-for="m in REGRESSION_METHODS" :key="m" :value="m">{{ m }}</option>
						</select>
						<p class="help-block">Optional method for drawing a regression line.</p>
					</div>
				</div>

				<!-- Timeline: key_field (timestamp subfields) -->
				<div v-if="widgetType === 'timeline'" class="control-group">
					<label class="control-label">Timestamp</label>
					<div class="controls form-horizontal">
						<select class="input-small" v-model="draft.key_field">
							<option v-for="sf in TIMESTAMP_SUBFIELDS" :key="sf.value" :value="sf.value">{{ sf.label }}</option>
						</select>
						<p class="help-block">How to handle events with multiple timestamps.</p>
					</div>
				</div>

				<!-- Polar: statistic + value_field + unit -->
				<div v-if="widgetType === 'polar'" class="control-group">
					<label class="control-label">Values</label>
					<div class="controls form-horizontal">
						<select class="input-small" required v-model="draft.statistic">
							<option v-for="s in statisticsFor(draft.value_field)" :key="s" :value="s">{{ s }}</option>
						</select>
						of
						<select class="input-medium" v-model="draft.value_field">
							<option v-for="f in numericAndTimestampFieldNames" :key="f" :value="f">{{ f }}</option>
						</select>
						<span v-if="currentValueUnits.length">
							in
							<select class="input-small" v-model="draft.unit">
								<option v-for="u in currentValueUnits" :key="u" :value="u">{{ u }}</option>
							</select>
						</span>
					</div>
				</div>

				<!-- Polar: interval -->
				<div v-if="widgetType === 'polar'" class="control-group">
					<label class="control-label">Interval</label>
					<div class="controls form-horizontal">
						<select required v-model="draft.interval">
							<option v-for="i in POLAR_INTERVALS" :key="i.id" :value="i.id">{{ i.label }}</option>
						</select>
					</div>
				</div>

				<!-- Polar: mark (highlight average) -->
				<div v-if="widgetType === 'polar'" class="control-group">
					<div class="controls form-horizontal">
						<label class="checkbox">
							<input type="checkbox" :checked="draft.mark === 'avg'" @change="draft.mark = ($event.target as HTMLInputElement).checked ? 'avg' : ''" />
							highlight average interval
						</label>
					</div>
				</div>

				<!-- Polar: key_field (timestamp subfields) -->
				<div v-if="widgetType === 'polar'" class="control-group">
					<label class="control-label">Timestamp</label>
					<div class="controls form-horizontal">
						<select class="input-small" v-model="draft.key_field">
							<option v-for="sf in TIMESTAMP_SUBFIELDS" :key="sf.value" :value="sf.value">{{ sf.label }}</option>
						</select>
						<p class="help-block">How to handle events with multiple timestamps.</p>
					</div>
				</div>

				<!-- Scatter Plot: X Axis -->
				<blockquote v-if="widgetType === 'scatterplot'" style="margin-bottom: 0">
					<div class="control-group">
						<label class="control-label">X Axis</label>
						<div class="controls form-horizontal">
							<input type="text" v-model="draft.label_x" placeholder="Title" />
						</div>
					</div>
					<div class="control-group">
						<label class="control-label">Values</label>
						<div class="controls form-horizontal">
							<select class="input-small" required v-model="draft.statistic_x">
								<option v-for="s in statisticsFor(draft.field_x)" :key="s" :value="s">{{ s }}</option>
							</select>
							of
							<select class="input-medium" v-model="draft.field_x">
								<option v-for="f in numericAndTimestampFieldNames" :key="f" :value="f">{{ f }}</option>
							</select>
							<span v-if="currentUnitsX.length">
								in
								<select class="input-small" v-model="draft.unit_x">
									<option v-for="u in currentUnitsX" :key="u" :value="u">{{ u }}</option>
								</select>
							</span>
						</div>
					</div>
					<div class="control-group">
						<label class="control-label">Filter</label>
						<div class="controls form-horizontal input-append">
							<input type="text" v-model="draft.filter_x" placeholder="e.g. tag:xyz" />
							<span v-if="filterXValid !== null" class="add-on">
								<i v-if="filterXValid" class="fa fa-check" title="valid" />
								<i v-else class="fa fa-exclamation" title="not valid" />
							</span>
						</div>
					</div>
				</blockquote>

				<!-- Scatter Plot: Swap button -->
				<div v-if="widgetType === 'scatterplot'" class="control-group">
					<a title="Swap X and Y" @click="swapAxes()"><i class="fa fa-exchange"></i></a>
				</div>

				<!-- Scatter Plot: Y Axis -->
				<blockquote v-if="widgetType === 'scatterplot'">
					<div class="control-group">
						<label class="control-label">Y Axis</label>
						<div class="controls form-horizontal">
							<input type="text" v-model="draft.label_y" placeholder="Title" />
						</div>
					</div>
					<div class="control-group">
						<label class="control-label">Values</label>
						<div class="controls form-horizontal">
							<select class="input-small" required v-model="draft.statistic_y">
								<option v-for="s in statisticsFor(draft.field_y)" :key="s" :value="s">{{ s }}</option>
							</select>
							of
							<select class="input-medium" v-model="draft.field_y">
								<option v-for="f in numericAndTimestampFieldNames" :key="f" :value="f">{{ f }}</option>
							</select>
							<span v-if="currentUnitsY.length">
								in
								<select class="input-small" v-model="draft.unit_y">
									<option v-for="u in currentUnitsY" :key="u" :value="u">{{ u }}</option>
								</select>
							</span>
						</div>
					</div>
					<div class="control-group">
						<label class="control-label">Filter</label>
						<div class="controls form-horizontal input-append">
							<input type="text" v-model="draft.filter_y" placeholder="e.g. tag:xyz" />
							<span v-if="filterYValid !== null" class="add-on">
								<i v-if="filterYValid" class="fa fa-check" title="valid" />
								<i v-else class="fa fa-exclamation" title="not valid" />
							</span>
						</div>
					</div>
				</blockquote>

				<!-- Scatter Plot: interval -->
				<div v-if="widgetType === 'scatterplot'" class="control-group">
					<label class="control-label">Interval</label>
					<div class="controls">
						<select v-model="draft.interval">
							<option v-for="i in TIMELINE_INTERVALS" :key="i.name" :value="i.name">{{ i.name }}</option>
						</select>
						<p class="help-block">The interval at which values are aggregated.</p>
					</div>
				</div>

				<!-- Scatter Plot: lag -->
				<div v-if="widgetType === 'scatterplot'" class="control-group">
					<label class="control-label">Lag</label>
					<div class="controls">
						<input type="number" v-model.number="draft.lag" placeholder="0" />
						<p class="help-block">The number of time units (see <i>interval</i>) by which to offset the y series values from the x series values.</p>
					</div>
				</div>

				<!-- Scatter Plot: regression -->
				<div v-if="widgetType === 'scatterplot'" class="control-group">
					<label class="control-label">Regression</label>
					<div class="controls">
						<select v-model="draft.regression">
							<option value="">None</option>
							<option v-for="m in REGRESSION_METHODS" :key="m" :value="m">{{ m }}</option>
						</select>
						<p class="help-block">Optional method for drawing a regression line.</p>
					</div>
				</div>

				<!-- Scatter Plot: key_field (timestamp subfields) -->
				<div v-if="widgetType === 'scatterplot'" class="control-group">
					<label class="control-label">Timestamp</label>
					<div class="controls form-horizontal">
						<select class="input-small" v-model="draft.key_field">
							<option v-for="sf in TIMESTAMP_SUBFIELDS" :key="sf.value" :value="sf.value">{{ sf.label }}</option>
						</select>
						<p class="help-block">How to handle events with multiple timestamps.</p>
					</div>
				</div>

				<!-- Heatmap: value_field + unit -->
				<div v-if="widgetType === 'heatmap'" class="control-group">
					<label class="control-label">Values</label>
					<div class="controls form-horizontal">
						<select class="input-medium" v-model="draft.value_field">
							<option value="">None</option>
							<option v-for="f in numericFieldNames" :key="f" :value="f">{{ f }}</option>
						</select>
						<p class="help-block">Optional field to use for calculating the weight of each point.</p>
					</div>
				</div>

				<!-- Limit (count, list, gantt, scoreboard) -->
				<div v-if="widgetType === 'count' || widgetType === 'list' || widgetType === 'gantt' || widgetType === 'scoreboard'" class="control-group">
					<label class="control-label">Limit</label>
					<div class="controls form-horizontal">
						<input type="number" required min="1" max="100" v-model.number="draft.limit" class="input-mini" />
					</div>
				</div>

				<!-- Order (count, list, gantt, scoreboard) -->
				<div v-if="hasOrder" class="control-group">
					<label class="control-label">Order</label>
					<div class="controls form-horizontal">
						<select required v-model="orderField" class="input-small">
							<option v-for="o in orderByOptions" :key="o" :value="o">{{ o }}</option>
						</select>
						<select required v-model="isAsc" class="input-small">
							<option :value="true">asc</option>
							<option :value="false">desc</option>
						</select>
					</div>
				</div>

				<!-- Scoreboard: statistics checkboxes -->
				<div v-if="widgetType === 'scoreboard'" class="control-group">
					<label class="control-label">Statistics</label>
					<div class="well">
						<label class="checkbox">
							<input type="checkbox" :checked="isStatisticSelected('count')" @change="toggleStatistic('count')" /> Count
						</label>
						<label class="checkbox">
							<input type="checkbox" :checked="isStatisticSelected('min')" @change="toggleStatistic('min')" /> Min
						</label>
						<label class="checkbox">
							<input type="checkbox" :checked="isStatisticSelected('max')" @change="toggleStatistic('max')" /> Max
						</label>
						<label class="checkbox">
							<input type="checkbox" :checked="isStatisticSelected('sum')" @change="toggleStatistic('sum')" /> Sum
						</label>
						<label class="checkbox">
							<input type="checkbox" :checked="isStatisticSelected('avg')" @change="toggleStatistic('avg')" /> Avg
						</label>
					</div>
				</div>

				<!-- Filter (most widgets except list, map) -->
				<div v-if="widgetType !== 'list' && widgetType !== 'map'" class="control-group">
					<label class="control-label">Filter</label>
					<div class="controls form-horizontal input-append">
						<input type="text" v-model="draft.filter" placeholder="e.g. tag:xyz" />
						<span v-if="filterValid !== null" class="add-on">
							<i v-if="filterValid" class="fa fa-check" title="valid" />
							<i v-else class="fa fa-exclamation" title="not valid" />
						</span>
					</div>
				</div>
			</div>
			<div class="modal-footer">
				<a class="pull-left" @click="remove()">Remove</a>
				<button type="submit" class="btn btn-primary" :disabled="!canSubmit">Update</button>
				<button type="button" class="btn" @click="close()">Cancel</button>
			</div>
		</form>
	</div>
</template>
