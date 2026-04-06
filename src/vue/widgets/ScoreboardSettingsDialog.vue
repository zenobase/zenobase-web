<script setup lang="ts">
import { inject, watch } from 'vue';
import type { WidgetSettings } from '../../types';
import { type SettingsDialogContext, settingsDialogKey } from '../composables/useSettingsDialog';
import { useWidgetSettings } from '../composables/useWidgetSettings';

const { draft, onInit } = inject<SettingsDialogContext>(settingsDialogKey)!;
const { textFieldNames, numericFieldNames, currentValueUnits, unitsForField, isStatisticSelected, toggleStatistic, filterValid, filterRule, limitRule, orderField, isAsc } = useWidgetSettings(draft);

watch(
	() => draft.value.value_field,
	() => {
		const units = unitsForField(draft.value.value_field);
		if (units.length === 0 ? draft.value.unit !== null : !units.includes(draft.value.unit as string)) {
			draft.value.unit = units.length ? units[0] : null;
		}
	},
);

onInit((d: WidgetSettings) => {
	if (!d.statistics) {
		d.statistics = ['count', 'sum', 'avg'];
	}
});
</script>

<template>
	<v-text-field label="Title *" required maxlength="20" v-model="draft.label" />
	<v-select label="Term *" :items="textFieldNames" v-model="draft.key_field" required />
	<div class="d-flex ga-2 align-center">
		<v-select label="Values *" :items="numericFieldNames" v-model="draft.value_field" required />
		<template v-if="currentValueUnits.length">
			<v-select label="Unit" :items="currentValueUnits" v-model="draft.unit" style="max-width: 100px" />
		</template>
	</div>
	<v-text-field label="Limit *" type="number" required :rules="[limitRule]" v-model.number="draft.limit" style="max-width: 120px" />
	<div class="d-flex ga-2">
		<v-select label="Order *" :items="['term', 'count', 'sum', 'min', 'max', 'avg']" v-model="orderField" required />
		<v-select :items="[{ title: 'asc', value: true }, { title: 'desc', value: false }]" v-model="isAsc" required style="max-width: 120px" />
	</div>
	<div class="text-subtitle-2 mb-2">Statistics</div>
	<v-sheet class="pa-4 mb-4" border rounded>
		<v-checkbox label="Count" :model-value="isStatisticSelected('count')" @update:model-value="toggleStatistic('count')" hide-details />
		<v-checkbox label="Min" :model-value="isStatisticSelected('min')" @update:model-value="toggleStatistic('min')" hide-details />
		<v-checkbox label="Max" :model-value="isStatisticSelected('max')" @update:model-value="toggleStatistic('max')" hide-details />
		<v-checkbox label="Sum" :model-value="isStatisticSelected('sum')" @update:model-value="toggleStatistic('sum')" hide-details />
		<v-checkbox label="Avg" :model-value="isStatisticSelected('avg')" @update:model-value="toggleStatistic('avg')" hide-details />
	</v-sheet>
	<v-text-field label="Filter" v-model="draft.filter" :rules="[filterRule]" placeholder="e.g. tag:xyz">
		<template v-if="filterValid !== null" #append-inner>
			<v-icon v-if="filterValid" icon="mdi-check" color="success" />
			<v-icon v-else icon="mdi-exclamation" color="warning" />
		</template>
	</v-text-field>
</template>
