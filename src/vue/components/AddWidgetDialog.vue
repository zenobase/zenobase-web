<script setup lang="ts">
import { inject, nextTick, ref, watch } from 'vue';
import type { Bucket, WidgetSettings } from '../../types';
import { deepExtend } from '../../utils/helpers';
import api from '../api';
import { type AlertApi, alertKey } from '../composables/useAlert';

const props = defineProps<{
	bucketId: string;
	bucket: Bucket;
	placement: string;
	modelValue: boolean;
}>();

const emit = defineEmits<{
	'update:modelValue': [value: boolean];
	added: [settings: WidgetSettings];
}>();

const alertApi = inject<AlertApi>(alertKey)!;

interface WidgetTemplate {
	type: string;
	label: string;
	description: string;
	thumbnail: string;
	settings: Partial<WidgetSettings>;
	singleton?: boolean;
}

const templates: WidgetTemplate[] = [
	{
		type: 'timeline',
		label: 'Timeline',
		description: 'Plots values on a timeline.',
		thumbnail: '/img/widgets/timeline.png',
		settings: { field: 'timestamp', statistic: 'count' },
	},
	{
		type: 'list',
		label: 'List',
		description: 'Shows all matching events, pageable.',
		thumbnail: '/img/widgets/list.png',
		settings: { limit: 10, order: '-timestamp' },
		singleton: true,
	},
	{
		type: 'count',
		label: 'Count',
		description: 'Counts events by tag or author.',
		thumbnail: '/img/widgets/count.png',
		settings: { field: 'tag', order: '-count', limit: 5 },
	},
	{
		type: 'map',
		label: 'Map',
		description: 'Shows clusters of events on a map.',
		thumbnail: '/img/widgets/map.png',
		settings: {},
	},
	{
		type: 'heatmap',
		label: 'Heatmap',
		description: 'Shows the density of events on a map.',
		thumbnail: '/img/widgets/heatmap.png',
		settings: {},
	},
	{
		type: 'ratings',
		label: 'Ratings',
		description: 'Counts events by their rating.',
		thumbnail: '/img/widgets/ratings.png',
		settings: {},
	},
	{
		type: 'histogram',
		label: 'Histogram',
		description: 'Shows the distribution of values in a field.',
		thumbnail: '/img/widgets/histogram.png',
		settings: { field: 'distance', interval: 10, unit: 'mi' },
	},
	{
		type: 'scoreboard',
		label: 'Scoreboard',
		description: 'Statistics for the values in a field.',
		thumbnail: '/img/widgets/scoreboard.png',
		settings: { key_field: 'author', value_field: 'distance', unit: 'mi', order: '-sum', limit: 10 },
	},
	{
		type: 'gantt',
		label: 'Frequency',
		description: 'Shows how long ago and how often events occur.',
		thumbnail: '/img/widgets/gantt.png',
		settings: { field: 'tag', order: '-max', limit: 10 },
	},
	{
		type: 'polar',
		label: 'Polar Chart',
		description: 'Plots by month of year, day of week, or hour of day.',
		thumbnail: '/img/widgets/polar.png',
		settings: { interval: 'day_of_week', value_field: 'timestamp' },
	},
	{
		type: 'scatterplot',
		label: 'Scatter Plot',
		description: 'Correlates values from two fields.',
		thumbnail: '/img/widgets/scatterplot.png',
		settings: { field_x: 'count', field_y: 'count' },
	},
];

function generateId(): string {
	return 'w' + Math.random().toString(36).substring(2, 10);
}

function exists(template: WidgetTemplate): boolean {
	return props.bucket.widgets?.some((w) => w.type === template.type) ?? false;
}

function findTemplates(): WidgetTemplate[] {
	return templates.filter((t) => !t.singleton || !exists(t));
}

function add(template: WidgetTemplate) {
	const settings: WidgetSettings = {
		id: generateId(),
		type: template.type,
		label: template.label,
		placement: props.placement,
	};
	deepExtend(settings, template.settings);
	close();
	emit('added', settings);
}

const visible = ref(false);

function close() {
	visible.value = false;
	emit('update:modelValue', false);
}

watch(
	() => props.modelValue,
	(open) => {
		if (open) {
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
	<v-dialog v-model="visible" max-width="900" @update:model-value="!$event && close()">
		<v-card>
			<v-card-title class="d-flex align-center">
				Add Widget
				<v-spacer />
				<v-btn icon="mdi-close" variant="text" density="compact" @click="close()" />
			</v-card-title>
			<v-card-text>
				<v-row>
					<v-col v-for="template in findTemplates()" :key="template.type" cols="12" sm="6">
						<v-card variant="outlined" hover style="cursor: pointer" @click="add(template)">
							<v-card-text class="text-center">
								<strong>{{ template.label }}</strong>
							</v-card-text>
							<v-img :src="template.thumbnail" :alt="template.label" width="300" height="200" class="mx-auto" />
							<v-card-text class="text-body-2 text-center">{{ template.description }}</v-card-text>
						</v-card>
					</v-col>
				</v-row>
			</v-card-text>
			<v-card-actions>
				<v-spacer />
				<v-btn variant="text" @click="close()">Cancel</v-btn>
			</v-card-actions>
		</v-card>
	</v-dialog>
</template>
