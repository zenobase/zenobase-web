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
	<v-dialog v-model="visible" max-width="500" @update:model-value="!$event && close()">
		<v-card>
			<v-card-title>Create View</v-card-title>
			<v-form @submit.prevent="create()">
				<v-card-text>
					<v-alert v-if="message" type="error" variant="tonal" class="mb-4">{{ message }}</v-alert>
					<v-text-field label="Label" v-model="label" required >
						<template #append-inner>
							<v-icon v-if="label.length > 0" icon="mdi-check" color="success" />
							<v-icon v-else icon="mdi-exclamation" color="warning" />
						</template>
					</v-text-field>
				</v-card-text>
				<v-card-actions>
					<v-spacer />
					<v-btn type="submit" color="primary" :disabled="!label">Create</v-btn>
					<v-btn variant="text" @click="close()">Cancel</v-btn>
				</v-card-actions>
			</v-form>
		</v-card>
	</v-dialog>
</template>
