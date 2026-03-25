<script setup lang="ts">
import { inject, nextTick, ref, watch } from 'vue';
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
	settings?: Record<string, unknown>;
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

const visible2 = visible;

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
		<div class="modal-header">
			<a class="close" @click="close()">&times;</a>
			<h4 class="alert-heading">Tasks</h4>
		</div>
		<div class="modal-body">
			<div class="alert alert-error" v-if="message">{{ message }}</div>
			<div class="control-group">
				<table class="table table-borderless">
					<tr v-if="tasks === null">
						<td colspan="3"><i>Loading...</i></td>
					</tr>
					<tr v-if="tasks && tasks.length === 0">
						<td colspan="3"><i>None</i></td>
					</tr>
					<tr v-for="task in tasks" :key="task['@id']">
						<td><abbr :title="formatTooltip(task)">{{ task.type }}</abbr></td>
						<td>
							<span v-if="task.status">ran {{ formatAge(task.completed) }}</span>
						</td>
						<td style="text-align: right">
							<a class="action" @click="remove(task['@id'])"><i class="fa fa-trash-o" title="Delete" /></a>
						</td>
					</tr>
				</table>
				<div class="btn-toolbar">
					<div class="btn-group pull-left">
						<button title="Create Task..." class="btn" @click="openCreateTask()"><i class="fa fa-plus" /></button>
					</div>
					<div class="btn-group pull-right" v-if="tasks && tasks.length">
						<button class="btn" title="Previous" @click="prev()" :disabled="!hasPrev()"><i class="fa fa-chevron-left" /></button>
						<button class="btn" title="Next" @click="next()" :disabled="!hasNext()"><i class="fa fa-chevron-right" /></button>
					</div>
					<div class="btn-group pull-right" v-if="tasks && tasks.length">
						<button class="btn disabled zeno-paging"><b>{{ offset + 1 }}</b> &ndash; <b>{{ offset + tasks.length }}</b> of <b>{{ total }}</b></button>
					</div>
				</div>
			</div>
		</div>
		<div class="modal-footer">
			<button class="btn" @click="close()">Close</button>
		</div>
	</div>
</template>
