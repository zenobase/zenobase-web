<script setup lang="ts">
import { inject, watch } from 'vue';
import { type SettingsDialogContext, settingsDialogKey } from '../composables/useSettingsDialog';
import { useWidgetSettings } from '../composables/useWidgetSettings';
import { POLAR_INTERVALS, TIMESTAMP_SUBFIELDS } from '../utils/fieldRegistry';

const { draft } = inject<SettingsDialogContext>(settingsDialogKey)!;
const { numericAndTimestampFieldNames, currentValueUnits, statisticsFor, unitsForField, filterValid, filterRule } = useWidgetSettings(draft);

watch(
	() => draft.value.value_field,
	() => {
		const units = unitsForField(draft.value.value_field);
		if (units.length === 0 ? draft.value.unit !== null : !units.includes(draft.value.unit as string)) {
			draft.value.unit = units.length ? units[0] : null;
		}
		const stats = statisticsFor(draft.value.value_field);
		if (!stats.includes(draft.value.statistic ?? '')) {
			draft.value.statistic = stats[0];
		}
	},
);
</script>

<template>
	<v-text-field label="Title *" required maxlength="20" v-model="draft.label" />
	<div class="d-flex ga-2 align-center">
		<v-select label="Statistic *" :items="statisticsFor(draft.value_field)" v-model="draft.statistic" required style="max-width: 120px" />
		<v-select label="Field" :items="numericAndTimestampFieldNames" v-model="draft.value_field" />
		<template v-if="currentValueUnits.length">
			<v-select label="Unit" :items="currentValueUnits" v-model="draft.unit" style="max-width: 100px" />
		</template>
	</div>
	<v-select label="Interval *" :items="POLAR_INTERVALS" item-title="label" item-value="id" v-model="draft.interval" required />
	<v-checkbox label="highlight average interval" :model-value="draft.mark === 'avg'" @update:model-value="draft.mark = $event ? 'avg' : ''" />
	<v-select label="Timestamp" :items="TIMESTAMP_SUBFIELDS" item-title="label" item-value="value" v-model="draft.key_field" hint="How to handle events with multiple timestamps." persistent-hint />
	<v-text-field label="Filter" v-model="draft.filter" :rules="[filterRule]" placeholder="e.g. tag:xyz">
		<template v-if="filterValid !== null" #append-inner>
			<v-icon v-if="filterValid" icon="mdi-check" color="success" />
			<v-icon v-else icon="mdi-exclamation" color="warning" />
		</template>
	</v-text-field>
</template>
