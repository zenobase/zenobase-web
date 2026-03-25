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

const CSV_LIMIT = 16000;

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
	const token = api.getToken();
	if (token) {
		params['code'] = token;
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

function submit() {
	alertApi.clear();
	close();
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
	<div v-if="visible" class="modal-backdrop fade in" @click="close()" />
	<div class="modal" :class="{ hide: !visible, in: visible, fade: true }" :style="visible ? { display: 'block', top: '10%' } : {}">
		<form class="modal-form">
			<div class="modal-header">
				<a class="close" @click="close()">&times;</a>
				<h4>Export</h4>
			</div>
			<div class="modal-body">
				<div class="alert alert-info" v-if="infoMessage">{{ infoMessage }}</div>
				<div class="control-group">
					<label class="radio">
						<input type="radio" name="media" value="json" v-model="media" /> as <strong>json</strong>
					</label>
					<label class="radio" :class="{ muted: total > CSV_LIMIT }">
						<input type="radio" name="media" value="csv" v-model="media" :disabled="total > CSV_LIMIT" /> as <strong>csv</strong>
					</label>
				</div>
			</div>
			<div class="modal-footer">
				<a class="btn btn-primary" :href="exportUrl" :download="exportFile" @click="submit()">Export</a>
				<a class="btn" @click="close()">Cancel</a>
			</div>
		</form>
	</div>
</template>
