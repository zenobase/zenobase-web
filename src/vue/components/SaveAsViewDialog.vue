<script setup lang="ts">
import { inject, nextTick, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import type { Bucket } from '../../types';
import type { Constraint } from '../../utils/constraint';
import api from '../api';
import { type AlertApi, alertKey } from '../composables/useAlert';

const props = defineProps<{
	bucketId: string;
	bucket: Bucket;
	constraints: Constraint[];
	modelValue: boolean;
}>();

const emit = defineEmits<{
	'update:modelValue': [value: boolean];
	created: [];
}>();

const alertApi = inject<AlertApi>(alertKey)!;
const router = useRouter();

const visible = ref(false);
const message = ref('');
const label = ref('');

function init() {
	label.value = props.bucket.label || '';
	message.value = '';
}

function getConstraintsString(): string | null {
	if (props.constraints.length > 0) {
		return props.constraints.map((c) => c.toString()).join('|');
	}
	return null;
}

async function create() {
	alertApi.clear();
	message.value = '';
	const data = {
		label: label.value,
		widgets: props.bucket.widgets,
		aliases: [
			{
				'@id': props.bucket['@id'],
				filter: getConstraintsString(),
			},
		],
	};
	try {
		const response = await api.post('/buckets/', data);
		const location = response.headers('Location');
		close();
		if (location) {
			router.push(location);
		}
		emit('created');
	} catch (e: unknown) {
		const status = (e as { status?: number }).status;
		if (status === 400) {
			message.value = "Can't create view.";
		} else {
			message.value = "Couldn't create view. Please try again later or contact support.";
		}
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
	<div v-if="visible" class="modal-backdrop fade in" @click="close()" />
	<div class="modal" :class="{ hide: !visible, in: visible, fade: true }" :style="visible ? { display: 'block', top: '10%' } : {}">
		<form class="modal-form" @submit.prevent="create()">
			<div class="modal-header">
				<a class="close" @click="close()">&times;</a>
				<h4>Create View</h4>
			</div>
			<div class="modal-body">
				<div class="alert alert-error" v-if="message">{{ message }}</div>
				<div class="control-group">
					<label><strong>Label</strong></label>
					<div class="input-append">
						<input type="text" class="xlarge" required minlength="1" maxlength="30" v-model="label" />
						<span class="add-on">
							<i class="fa fa-check" title="valid" v-if="label.length > 0" />
							<i class="fa fa-exclamation" title="not valid" v-else />
						</span>
					</div>
				</div>
			</div>
			<div class="modal-footer">
				<button type="submit" class="btn btn-primary" :disabled="!label">Create</button>
				<button type="button" class="btn" @click="close()">Cancel</button>
			</div>
		</form>
	</div>
</template>
