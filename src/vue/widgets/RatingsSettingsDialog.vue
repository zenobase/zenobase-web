<script setup lang="ts">
import { inject } from 'vue';
import { type SettingsDialogContext, settingsDialogKey } from '../composables/useSettingsDialog';
import { useWidgetSettings } from '../composables/useWidgetSettings';

const { draft } = inject<SettingsDialogContext>(settingsDialogKey)!;
const { filterValid, filterRule } = useWidgetSettings(draft);
</script>

<template>
	<v-text-field label="Title *" required maxlength="20" v-model="draft.label" />
	<v-text-field label="Filter" v-model="draft.filter" :rules="[filterRule]" placeholder="e.g. tag:xyz">
		<template v-if="filterValid !== null" #append-inner>
			<v-icon v-if="filterValid" icon="mdi-check" color="success" />
			<v-icon v-else icon="mdi-exclamation" color="warning" />
		</template>
	</v-text-field>
</template>
