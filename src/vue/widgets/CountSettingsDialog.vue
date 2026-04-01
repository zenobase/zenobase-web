<script setup lang="ts">
import { inject } from 'vue';
import { type SettingsDialogContext, settingsDialogKey } from '../composables/useSettingsDialog';
import { useWidgetSettings } from '../composables/useWidgetSettings';

const { draft } = inject<SettingsDialogContext>(settingsDialogKey)!;
const { textFieldNames, filterValid, orderField, isAsc } = useWidgetSettings(draft);
</script>

<template>
	<v-text-field label="Title" required maxlength="20" v-model="draft.label" />
	<v-select label="Term" :items="textFieldNames" v-model="draft.field" required />
	<v-text-field label="Limit" type="number" required min="1" max="100" v-model.number="draft.limit" style="max-width: 120px" />
	<div class="d-flex ga-2">
		<v-select label="Order" :items="['term', 'count']" v-model="orderField" required />
		<v-select :items="[{ title: 'asc', value: true }, { title: 'desc', value: false }]" v-model="isAsc" required style="max-width: 120px" />
	</div>
	<v-text-field label="Filter" v-model="draft.filter" placeholder="e.g. tag:xyz">
		<template v-if="filterValid !== null" #append-inner>
			<v-icon v-if="filterValid" icon="mdi-check" color="success" />
			<v-icon v-else icon="mdi-exclamation" color="warning" />
		</template>
	</v-text-field>
</template>
