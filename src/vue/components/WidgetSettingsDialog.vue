<script setup lang="ts">
import { type ComputedRef, computed, nextTick, provide, ref, shallowRef, watch } from 'vue';
import type { WidgetSettings } from '../../types';
import { type SettingsDialogContext, settingsDialogKey } from '../composables/useSettingsDialog';

const props = defineProps<{
	modelValue: boolean;
	settings: WidgetSettings;
	title: string;
	isNew?: boolean;
}>();

const emit = defineEmits<{
	'update:modelValue': [value: boolean];
	save: [settings: WidgetSettings];
	remove: [];
}>();

const visible = ref(false);
const formValid = ref<boolean | null>(null);
const draft = ref<WidgetSettings>({} as WidgetSettings);
const originalJson = ref('');
const dirty = computed(() => JSON.stringify(draft.value) !== originalJson.value);

const initFn = shallowRef<((draft: WidgetSettings) => void) | null>(null);
const beforeSaveFn = shallowRef<((settings: WidgetSettings) => void) | null>(null);
const canSubmitRef = shallowRef<ComputedRef<boolean> | null>(null);

const canSubmit = computed(() => canSubmitRef.value?.value ?? true);

provide(settingsDialogKey, {
	draft,
	onInit: (fn: (draft: WidgetSettings) => void) => {
		initFn.value = fn;
		if (props.modelValue) {
			fn(draft.value);
			originalJson.value = JSON.stringify(draft.value);
		}
	},
	onBeforeSave: (fn: (settings: WidgetSettings) => void) => {
		beforeSaveFn.value = fn;
	},
	setCanSubmit: (value: ComputedRef<boolean>) => {
		canSubmitRef.value = value;
	},
} satisfies SettingsDialogContext);

function close() {
	visible.value = false;
	emit('update:modelValue', false);
}

function save() {
	const settings = JSON.parse(JSON.stringify(draft.value)) as WidgetSettings;
	beforeSaveFn.value?.(settings);
	emit('save', settings);
	close();
}

function remove() {
	emit('remove');
	close();
}

watch(
	() => props.modelValue,
	(open) => {
		if (open) {
			draft.value = JSON.parse(JSON.stringify(props.settings)) as WidgetSettings;
			originalJson.value = JSON.stringify(draft.value);
			nextTick(() => {
				visible.value = true;
			});
		} else {
			visible.value = false;
			initFn.value = null;
			beforeSaveFn.value = null;
			canSubmitRef.value = null;
		}
	},
	{ immediate: true },
);
</script>

<template>
	<v-dialog v-model="visible" max-width="700" @update:model-value="!$event && close()">
		<v-card>
			<v-card-title class="d-flex align-center">
				{{ title }}
				<v-spacer />
				<v-btn icon="mdi-close" variant="text" density="compact" @click="close()" />
			</v-card-title>
			<v-form v-model="formValid" @submit.prevent="save()">
				<v-card-text>
					<slot />
				</v-card-text>
				<v-card-actions>
					<v-btn variant="text" color="error" @click="remove()">Remove</v-btn>
					<v-spacer />
					<v-btn type="submit" color="primary" :disabled="(!dirty && !isNew) || formValid === false || !canSubmit">Save</v-btn>
					<v-btn variant="text" @click="close()">Cancel</v-btn>
				</v-card-actions>
			</v-form>
		</v-card>
	</v-dialog>
</template>
