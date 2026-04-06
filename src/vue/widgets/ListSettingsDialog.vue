<script setup lang="ts">
import { inject } from 'vue';
import { type SettingsDialogContext, settingsDialogKey } from '../composables/useSettingsDialog';
import { useWidgetSettings } from '../composables/useWidgetSettings';
import { getNumericFieldNames } from '../utils/fieldRegistry';

const { draft } = inject<SettingsDialogContext>(settingsDialogKey)!;
const { limitRule, orderField, isAsc } = useWidgetSettings(draft);

const orderByOptions = ['timestamp', ...getNumericFieldNames()];
</script>

<template>
	<v-text-field label="Title *" required maxlength="20" v-model="draft.label" />
	<v-text-field label="Limit *" type="number" required :rules="[limitRule]" v-model.number="draft.limit" style="max-width: 120px" />
	<div class="d-flex ga-2">
		<v-select label="Order *" :items="orderByOptions" v-model="orderField" required />
		<v-select :items="[{ title: 'asc', value: true }, { title: 'desc', value: false }]" v-model="isAsc" required style="max-width: 120px" />
	</div>
</template>
