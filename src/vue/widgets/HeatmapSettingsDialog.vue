<script setup lang="ts">
import { inject, watch } from 'vue';
import { type SettingsDialogContext, settingsDialogKey } from '../composables/useSettingsDialog';
import { useWidgetSettings } from '../composables/useWidgetSettings';

const { draft } = inject<SettingsDialogContext>(settingsDialogKey)!;
const { numericFieldNames, unitsForField, filterValid } = useWidgetSettings(draft);

watch(
	() => draft.value.value_field,
	() => {
		const units = unitsForField(draft.value.value_field);
		draft.value.unit = units.length ? units[0] : '';
	},
);
</script>

<template>
	<v-text-field label="Title *" required maxlength="20" v-model="draft.label" />
	<v-select label="Values" :items="[{ title: 'None', value: '' }, ...numericFieldNames.map(f => ({ title: f, value: f }))]" v-model="draft.value_field" hint="Optional field to use for calculating the weight of each point." persistent-hint />
	<v-text-field label="Filter" v-model="draft.filter" placeholder="e.g. tag:xyz">
		<template v-if="filterValid !== null" #append-inner>
			<v-icon v-if="filterValid" icon="mdi-check" color="success" />
			<v-icon v-else icon="mdi-exclamation" color="warning" />
		</template>
	</v-text-field>
</template>
