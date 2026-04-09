<script setup lang="ts">
import { computed, inject, nextTick, ref, watch } from 'vue';
import type { Constraint } from '../../utils/constraint';
import { param } from '../../utils/helpers';
import api from '../api';
import { type AlertApi, alertKey } from '../composables/useAlert';

const props = defineProps<{
	bucketId: string;
	total: number;
	constraints: Constraint[];
	modelValue: boolean;
}>();

const emit = defineEmits<{
	'update:modelValue': [value: boolean];
}>();

const alertApi = inject<AlertApi>(alertKey)!;

const CSV_LIMIT = 10000;

const visible = ref(false);
const media = ref('json');
const infoMessage = ref('');

function init() {
	media.value = 'json';
	if (props.total > CSV_LIMIT) {
		infoMessage.value = `csv export is limited to ${CSV_LIMIT} events; add one or more constraints to enable.`;
	} else if (props.constraints.length > 0) {
		infoMessage.value = 'Only events matching the current constraints will be exported.';
	} else {
		infoMessage.value = '';
	}
}

const exportUrl = computed(() => {
	let url = `/buckets/${props.bucketId}/`;
	const params: Record<string, unknown> = {};
	if (props.constraints.length > 0) {
		params['q'] = props.constraints.map((c) => c.toString());
	}
	if (media.value === 'csv') {
		params['accept'] = 'text/plain';
	}
	if (Object.keys(params).length > 0) {
		url += '?' + param(params, true);
	}
	return url;
});

const exportFile = computed(() => `${props.bucketId}.${media.value}`);

async function submit() {
	alertApi.clear();
	try {
		await api.download(exportUrl.value, exportFile.value);
		close();
	} catch (e) {
		alertApi.show(e instanceof Error ? e.message : 'Export failed', 'error');
	}
}

function close() {
	visible.value = false;
	emit('update:modelValue', false);
}

watch(
	() => props.modelValue,
	(open) => {
		if (open) {
			init();
			nextTick(() => {
				visible.value = true;
			});
		} else {
			visible.value = false;
		}
	},
);
</script>

<template>
	<v-dialog v-model="visible" max-width="500" @update:model-value="!$event && close()">
		<v-card>
			<v-card-title class="d-flex align-center">
				Export
				<v-spacer />
				<v-btn icon="mdi-close" variant="text" density="compact" @click="close()" />
			</v-card-title>
			<v-card-text>
				<v-alert v-if="infoMessage" type="info" variant="tonal" class="mb-4">{{ infoMessage }}</v-alert>
				<v-radio-group v-model="media">
					<v-radio label="as json" value="json" />
					<v-radio label="as csv" value="csv" :disabled="total > CSV_LIMIT" />
				</v-radio-group>
			</v-card-text>
			<v-card-actions>
				<v-spacer />
				<v-btn color="primary" @click="submit()">Export</v-btn>
				<v-btn variant="text" @click="close()">Cancel</v-btn>
			</v-card-actions>
		</v-card>
	</v-dialog>
</template>
