<script setup lang="ts">
import { inject } from 'vue';
import { type SettingsDialogContext, settingsDialogKey } from '../composables/useSettingsDialog';

const { draft } = inject<SettingsDialogContext>(settingsDialogKey)!;
</script>

<template>
	<v-text-field label="Title" required maxlength="20" v-model="draft.label" />
</template>
