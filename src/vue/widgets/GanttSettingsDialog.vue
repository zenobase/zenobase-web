<script setup lang="ts">
import { inject } from 'vue';
import { type SettingsDialogContext, settingsDialogKey } from '../composables/useSettingsDialog';
import { useWidgetSettings } from '../composables/useWidgetSettings';
import { TIMESTAMP_SUBFIELDS } from '../utils/fieldRegistry';

const { draft } = inject<SettingsDialogContext>(settingsDialogKey)!;
const { textFieldNames, filterValid, filterRule, limitRule, orderField, isAsc } = useWidgetSettings(draft);
</script>

<template>
	<v-text-field label="Title *" required maxlength="20" v-model="draft.label" />
	<v-select label="Field *" :items="textFieldNames" v-model="draft.field" required />
	<v-select label="Timestamp" :items="TIMESTAMP_SUBFIELDS" item-title="label" item-value="value" v-model="draft.key_field" />
	<v-text-field label="Limit *" type="number" required :rules="[limitRule]" v-model.number="draft.limit" style="max-width: 120px" />
	<div class="d-flex ga-2">
		<v-select label="Order *" :items="['term', 'max']" v-model="orderField" required />
		<v-select :items="[{ title: 'asc', value: true }, { title: 'desc', value: false }]" v-model="isAsc" required style="max-width: 120px" />
	</div>
	<v-text-field label="Filter" v-model="draft.filter" :rules="[filterRule]" placeholder="e.g. tag:xyz">
		<template v-if="filterValid !== null" #append-inner>
			<v-icon v-if="filterValid" icon="mdi-check" color="success" />
			<v-icon v-else icon="mdi-exclamation" color="warning" />
		</template>
	</v-text-field>
</template>
