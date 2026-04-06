<script setup lang="ts">
import { inject, watch } from 'vue';
import type { WidgetSettings } from '../../types';
import { type SettingsDialogContext, settingsDialogKey } from '../composables/useSettingsDialog';
import { useWidgetSettings } from '../composables/useWidgetSettings';
import { REGRESSION_METHODS, TIMELINE_INTERVALS, TIMESTAMP_SUBFIELDS } from '../utils/fieldRegistry';

const { draft, onInit } = inject<SettingsDialogContext>(settingsDialogKey)!;
const { numericAndTimestampFieldNames, currentUnits, statisticsFor, unitsForField, filterValid, filterRule } = useWidgetSettings(draft);

watch(
	() => draft.value.field,
	() => {
		const units = unitsForField(draft.value.field);
		if (units.length === 0 ? draft.value.unit !== null : !units.includes(draft.value.unit as string)) {
			draft.value.unit = units.length ? units[0] : null;
		}
		const stats = statisticsFor(draft.value.field);
		if (!stats.includes(draft.value.statistic ?? '')) {
			draft.value.statistic = stats[0];
		}
	},
);

onInit((d: WidgetSettings) => {
	if (!d.interval) {
		d.interval = 'month';
	}
});
</script>

<template>
	<v-text-field label="Title *" required maxlength="20" v-model="draft.label" />
	<div class="d-flex ga-2 align-center">
		<v-select label="Statistic *" :items="statisticsFor(draft.field)" v-model="draft.statistic" required style="max-width: 120px" />
		<v-select label="Field" :items="numericAndTimestampFieldNames" v-model="draft.field" />
		<template v-if="currentUnits.length">
			<v-select label="Unit" :items="currentUnits" v-model="draft.unit" style="max-width: 100px" />
		</template>
	</div>
	<v-select label="Default Interval" :items="TIMELINE_INTERVALS" item-title="name" item-value="name" v-model="draft.interval" />
	<v-select label="Regression" :items="[{ title: 'None', value: '' }, ...REGRESSION_METHODS.map(m => ({ title: m, value: m }))]" v-model="draft.regression" hint="Optional method for drawing a regression line." persistent-hint />
	<v-select label="Timestamp" :items="TIMESTAMP_SUBFIELDS" item-title="label" item-value="value" v-model="draft.key_field" />
	<v-text-field label="Filter" v-model="draft.filter" :rules="[filterRule]" placeholder="e.g. tag:xyz">
		<template v-if="filterValid !== null" #append-inner>
			<v-icon v-if="filterValid" icon="mdi-check" color="success" />
			<v-icon v-else icon="mdi-exclamation" color="warning" />
		</template>
	</v-text-field>
</template>
