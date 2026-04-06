<script setup lang="ts">
import { inject, watch } from 'vue';
import { type SettingsDialogContext, settingsDialogKey } from '../composables/useSettingsDialog';
import { useWidgetSettings } from '../composables/useWidgetSettings';
import { REGRESSION_METHODS, TIMELINE_INTERVALS, TIMESTAMP_SUBFIELDS } from '../utils/fieldRegistry';

const { draft } = inject<SettingsDialogContext>(settingsDialogKey)!;
const { numericAndTimestampFieldNames, currentUnitsX, currentUnitsY, statisticsFor, unitsForField, filterXValid, filterYValid, filterRule } = useWidgetSettings(draft);

function swapAxes() {
	const s = draft.value;
	const tmp = (p1: string, p2: string) => {
		const t = (s as Record<string, unknown>)[p1];
		(s as Record<string, unknown>)[p1] = (s as Record<string, unknown>)[p2];
		(s as Record<string, unknown>)[p2] = t;
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

watch(
	() => draft.value.field_x,
	() => {
		const units = unitsForField(draft.value.field_x);
		if (units.length === 0 ? draft.value.unit_x !== null : !units.includes(draft.value.unit_x as string)) {
			draft.value.unit_x = units.length ? units[0] : null;
		}
	},
);

watch(
	() => draft.value.field_y,
	() => {
		const units = unitsForField(draft.value.field_y);
		if (units.length === 0 ? draft.value.unit_y !== null : !units.includes(draft.value.unit_y as string)) {
			draft.value.unit_y = units.length ? units[0] : null;
		}
	},
);
</script>

<template>
	<v-text-field label="Title *" required maxlength="20" v-model="draft.label" />
	<v-sheet class="pa-4 mb-2" border rounded>
		<v-text-field label="X Axis" v-model="draft.label_x" placeholder="Title" />
		<div class="d-flex ga-2 align-center">
			<v-select label="Statistic *" :items="statisticsFor(draft.field_x)" v-model="draft.statistic_x" required style="max-width: 120px" />
			<v-select label="Field" :items="numericAndTimestampFieldNames" v-model="draft.field_x" />
			<template v-if="currentUnitsX.length">
				<v-select label="Unit" :items="currentUnitsX" v-model="draft.unit_x" style="max-width: 100px" />
			</template>
		</div>
		<v-text-field label="Filter" v-model="draft.filter_x" :rules="[filterRule]" placeholder="e.g. tag:xyz">
			<template v-if="filterXValid !== null" #append-inner>
				<v-icon v-if="filterXValid" icon="mdi-check" color="success" />
				<v-icon v-else icon="mdi-exclamation" color="warning" />
			</template>
		</v-text-field>
	</v-sheet>
	<div class="text-center my-2">
		<v-btn variant="text" size="small" title="Swap X and Y" @click="swapAxes()"><v-icon icon="mdi-swap-horizontal" /></v-btn>
	</div>
	<v-sheet class="pa-4 mb-4" border rounded>
		<v-text-field label="Y Axis" v-model="draft.label_y" placeholder="Title" />
		<div class="d-flex ga-2 align-center">
			<v-select label="Statistic *" :items="statisticsFor(draft.field_y)" v-model="draft.statistic_y" required style="max-width: 120px" />
			<v-select label="Field" :items="numericAndTimestampFieldNames" v-model="draft.field_y" />
			<template v-if="currentUnitsY.length">
				<v-select label="Unit" :items="currentUnitsY" v-model="draft.unit_y" style="max-width: 100px" />
			</template>
		</div>
		<v-text-field label="Filter" v-model="draft.filter_y" :rules="[filterRule]" placeholder="e.g. tag:xyz">
			<template v-if="filterYValid !== null" #append-inner>
				<v-icon v-if="filterYValid" icon="mdi-check" color="success" />
				<v-icon v-else icon="mdi-exclamation" color="warning" />
			</template>
		</v-text-field>
	</v-sheet>
	<v-select label="Interval" :items="TIMELINE_INTERVALS" item-title="name" item-value="name" v-model="draft.interval" hint="The interval at which values are aggregated." persistent-hint />
	<v-text-field label="Lag" type="number" v-model.number="draft.lag" placeholder="0" hint="The number of time units (see interval) by which to offset the y series values from the x series values." persistent-hint />
	<v-select label="Regression" :items="[{ title: 'None', value: '' }, ...REGRESSION_METHODS.map(m => ({ title: m, value: m }))]" v-model="draft.regression" hint="Optional method for drawing a regression line." persistent-hint />
	<v-select label="Timestamp" :items="TIMESTAMP_SUBFIELDS" item-title="label" item-value="value" v-model="draft.key_field" hint="How to handle events with multiple timestamps." persistent-hint />
</template>
