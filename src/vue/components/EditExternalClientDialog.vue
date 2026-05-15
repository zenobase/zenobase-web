<script setup lang="ts">
import { computed, inject, nextTick, ref, watch } from 'vue';
import type { ExternalClient } from '../../types';
import api from '../api';
import { type AlertApi, alertKey } from '../composables/useAlert';

const props = defineProps<{
	userId: string;
	app: ExternalClient;
	buckets: Array<{ '@id': string; label?: string }>;
	modelValue: boolean;
}>();

const emit = defineEmits<{
	'update:modelValue': [value: boolean];
	saved: [app: ExternalClient];
}>();

const alertApi = inject<AlertApi>(alertKey)!;

const visible = ref(false);
const saving = ref(false);
const message = ref('');
const selected = ref<Set<string>>(new Set());

const displayName = computed(() => props.app.client_name || props.app.client_id);
const isPending = computed(() => props.app.readable_buckets.length === 0);
const isDirty = computed(() => {
	const current = new Set(props.app.readable_buckets);
	if (current.size !== selected.value.size) return true;
	for (const id of selected.value) {
		if (!current.has(id)) return true;
	}
	return false;
});

const sortedBuckets = computed(() => {
	const copy = [...props.buckets];
	copy.sort((a, b) => (a.label || a['@id']).localeCompare(b.label || b['@id']));
	return copy;
});

function toggle(bucketId: string) {
	const next = new Set(selected.value);
	if (next.has(bucketId)) {
		next.delete(bucketId);
	} else {
		next.add(bucketId);
	}
	selected.value = next;
}

function isChecked(bucketId: string): boolean {
	return selected.value.has(bucketId);
}

async function save() {
	if (saving.value) return;
	saving.value = true;
	message.value = '';
	alertApi.clear();
	try {
		const response = await api.put<ExternalClient>(
			`/users/${props.userId}/external-clients/${encodeURIComponent(props.app.client_id)}`,
			{ readable_buckets: Array.from(selected.value) },
		);
		alertApi.show(`Updated ${displayName.value}.`, 'success', '');
		close();
		emit('saved', response.data);
	} catch (e: unknown) {
		const status = (e as { status?: number }).status;
		message.value = status && status < 500 ? "Can't update this app." : "Couldn't update this app. Try again later or contact support.";
	} finally {
		saving.value = false;
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
			message.value = '';
			selected.value = new Set(props.app.readable_buckets);
			nextTick(() => {
				visible.value = true;
			});
		} else {
			visible.value = false;
		}
	},
	{ immediate: true },
);
</script>

<template>
	<v-dialog v-model="visible" max-width="600" @update:model-value="!$event && close()">
		<v-card>
			<v-card-title class="d-flex align-center">
				<span>{{ displayName }}</span>
				<v-chip v-if="isPending" color="warning" size="small" variant="tonal" class="ml-2">Pending</v-chip>
				<v-spacer />
				<v-btn icon="mdi-close" variant="text" density="compact" @click="close()" />
			</v-card-title>
			<v-form @submit.prevent="save()">
				<v-card-text>
					<v-alert v-if="message" type="error" variant="tonal" class="mb-4">{{ message }}</v-alert>
					<p class="text-body-2 mb-3" style="color: rgba(0, 0, 0, 0.6)">
						<template v-if="isPending">
							This app is waiting to be granted access. Choose which buckets it may read.
						</template>
						<template v-else>
							Choose which buckets this app may read.
						</template>
					</p>
					<div v-if="sortedBuckets.length === 0">
						<i>You don't have any buckets yet.</i>
					</div>
					<v-list v-else density="compact" class="connected-app-buckets" max-height="400">
						<v-list-item
							v-for="b in sortedBuckets"
							:key="b['@id']"
							class="px-2"
							@click="toggle(b['@id'])"
						>
							<template v-slot:prepend>
								<v-checkbox-btn :model-value="isChecked(b['@id'])" @click.stop="toggle(b['@id'])" />
							</template>
							<v-list-item-title>{{ b.label || b['@id'] }}</v-list-item-title>
						</v-list-item>
					</v-list>
				</v-card-text>
				<v-card-actions class="ps-4">
					<v-spacer />
					<v-btn variant="text" @click="close()">Cancel</v-btn>
					<v-btn type="submit" color="primary" :disabled="!isDirty || saving" :loading="saving">Save</v-btn>
				</v-card-actions>
			</v-form>
		</v-card>
	</v-dialog>
</template>

<style scoped>
.connected-app-buckets {
	overflow-y: auto;
}
</style>
