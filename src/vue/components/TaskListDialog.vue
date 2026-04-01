<script setup lang="ts">
import { inject, nextTick, ref, watch } from 'vue';
import type { WidgetSettings } from '../../types';
import { param } from '../../utils/helpers';
import api from '../api';
import { type AlertApi, alertKey } from '../composables/useAlert';

const props = defineProps<{
	bucketId: string;
	modelValue: boolean;
}>();

const emit = defineEmits<{
	'update:modelValue': [value: boolean];
	'open-create-task': [];
}>();

const alertApi = inject<AlertApi>(alertKey)!;

interface Task {
	'@id': string;
	type: string;
	status?: string;
	completed?: string;
	settings?: WidgetSettings;
}

const visible = ref(false);
const message = ref('');
const offset = ref(0);
const limit = ref(10);
const total = ref(0);
const tasks = ref<Task[] | null>(null);

async function refresh(params?: { offset?: number }) {
	if (params?.offset !== undefined) {
		offset.value = params.offset;
	}
	const queryParams = param({ offset: offset.value, limit: limit.value });
	try {
		const response = await api.get<{ total: number; tasks: Task[] }>(`/buckets/${props.bucketId}/tasks/?${queryParams}`);
		total.value = response.data.total;
		tasks.value = response.data.tasks;
	} catch (e: unknown) {
		const status = (e as { status?: number }).status;
		if (status && status < 500) {
			message.value = "Can't retrieve any tasks.";
		} else {
			message.value = "Couldn't retrieve any tasks. Try again later or contact support.";
		}
	}
}

function hasPrev(): boolean {
	return offset.value > 0;
}

function hasNext(): boolean {
	return offset.value + limit.value < total.value;
}

function prev() {
	refresh({ offset: offset.value - limit.value });
}

function next() {
	refresh({ offset: offset.value + limit.value });
}

async function remove(taskId: string) {
	message.value = '';
	try {
		await api.del(`/tasks/${taskId}`);
		setTimeout(() => refresh(), 500);
	} catch (e: unknown) {
		const status = (e as { status?: number }).status;
		if (status && status < 500) {
			message.value = "Can't delete the task.";
		} else {
			message.value = "Couldn't delete the task. Try again later or contact support.";
		}
	}
}

function formatTooltip(task: Task): string {
	if (task.settings) {
		return Object.entries(task.settings)
			.map(([field, value]) => `${field}: ${value}`)
			.join('\n');
	}
	return '(no settings)';
}

function formatAge(dateStr: string | undefined): string {
	if (!dateStr) return '';
	const date = new Date(dateStr);
	const now = new Date();
	const diffMs = now.getTime() - date.getTime();
	const diffMinutes = Math.floor(diffMs / 60000);
	if (diffMinutes < 1) return 'just now';
	if (diffMinutes < 60) return `${diffMinutes}m ago`;
	const diffHours = Math.floor(diffMinutes / 60);
	if (diffHours < 24) return `${diffHours}h ago`;
	const diffDays = Math.floor(diffHours / 24);
	return `${diffDays}d ago`;
}

function openCreateTask() {
	close();
	emit('open-create-task');
}

function init() {
	message.value = '';
	offset.value = 0;
	total.value = 0;
	tasks.value = null;
	refresh();
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
	<v-dialog v-model="visible" max-width="600" @update:model-value="!$event && close()">
		<v-card>
			<v-card-title>Tasks</v-card-title>
			<v-card-text>
				<v-alert v-if="message" type="error" variant="tonal" class="mb-4">{{ message }}</v-alert>
				<v-table>
					<tbody>
						<tr v-if="tasks === null">
							<td colspan="3"><em>Loading...</em></td>
						</tr>
						<tr v-if="tasks && tasks.length === 0">
							<td colspan="3"><em>None</em></td>
						</tr>
						<tr v-for="task in tasks" :key="task['@id']">
							<td><abbr :title="formatTooltip(task)">{{ task.type }}</abbr></td>
							<td>
								<span v-if="task.status">ran {{ formatAge(task.completed) }}</span>
							</td>
							<td class="text-right">
								<v-btn variant="text" size="small" class="action" @click="remove(task['@id'])">
									<v-icon icon="mdi-delete-outline" title="Delete" />
								</v-btn>
							</td>
						</tr>
					</tbody>
				</v-table>
				<div class="d-flex align-center mt-2">
					<v-btn variant="text" size="small" title="Create Task..." @click="openCreateTask()">
						<v-icon icon="mdi-plus" />
					</v-btn>
					<v-spacer />
					<v-btn v-if="tasks && tasks.length" icon variant="text" title="Previous" :disabled="!hasPrev()" @click="prev()"><v-icon icon="mdi-chevron-left" /></v-btn>
					<span v-if="tasks && tasks.length" style="color: rgba(0,0,0,0.5)"><b>{{ offset + 1 }}</b>&ndash;<b>{{ offset + tasks.length }}</b> of <b>{{ total }}</b></span>
					<v-btn v-if="tasks && tasks.length" icon variant="text" title="Next" :disabled="!hasNext()" @click="next()"><v-icon icon="mdi-chevron-right" /></v-btn>
				</div>
			</v-card-text>
			<v-card-actions>
				<v-spacer />
				<v-btn variant="text" @click="close()">Close</v-btn>
			</v-card-actions>
		</v-card>
	</v-dialog>
</template>
