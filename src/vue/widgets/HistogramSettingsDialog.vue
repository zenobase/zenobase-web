<script setup lang="ts">
import { computed, inject, watch } from 'vue';
import type { WidgetSettings } from '../../types';
import { type SettingsDialogContext, settingsDialogKey } from '../composables/useSettingsDialog';
import { useWidgetSettings } from '../composables/useWidgetSettings';

const { draft, onInit, onBeforeSave, setCanSubmit } = inject<SettingsDialogContext>(settingsDialogKey)!;
const { numericFieldNames, currentUnits, unitsForField, filterValid } = useWidgetSettings(draft);

watch(
	() => draft.value.field,
	() => {
		const units = unitsForField(draft.value.field);
		if (units.length === 0 ? draft.value.unit !== null : !units.includes(draft.value.unit as string)) {
			draft.value.unit = units.length ? units[0] : null;
		}
	},
);

setCanSubmit(
	computed(() => {
		const interval = Number(draft.value.interval);
		return interval > 0;
	}),
);

onInit((d: WidgetSettings) => {
	if (d.field?.startsWith('duration') && d.interval) {
		d.interval = String(Number(d.interval) / 3_600_000);
	}
});

onBeforeSave((settings: WidgetSettings) => {
	if (settings.field?.startsWith('duration') && settings.interval) {
		settings.interval = String(Number(settings.interval) * 3_600_000);
	}
});
</script>

<template>
	<v-text-field label="Title" required maxlength="20" v-model="draft.label" />
	<div class="d-flex ga-2 align-center">
		<v-select label="Values" :items="numericFieldNames" v-model="draft.field" required />
		<v-text-field label="Per" v-model="draft.interval" style="max-width: 80px" />
		<span v-if="draft.field?.startsWith('duration')">hours</span>
		<v-select label="Unit" v-if="currentUnits.length" :items="currentUnits" v-model="draft.unit" style="max-width: 100px" />
	</div>
	<v-text-field label="Filter" v-model="draft.filter" placeholder="e.g. tag:xyz">
		<template v-if="filterValid !== null" #append-inner>
			<v-icon v-if="filterValid" icon="mdi-check" color="success" />
			<v-icon v-else icon="mdi-exclamation" color="warning" />
		</template>
	</v-text-field>
</template>
