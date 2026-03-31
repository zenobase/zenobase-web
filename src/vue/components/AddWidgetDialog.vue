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
		label: 'Map',
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
		description: 'Shows how long ago and how often certain events occur.',
		thumbnail: '/img/widgets/gantt.png',
		settings: { field: 'tag', order: '-max', limit: 10 },
	},
	{
		type: 'polar',
		label: 'Polar Chart',
		description: 'Plots values by month of year, day of week, or hour of day.',
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
	<template v-if="visible">
	<div class="modal-backdrop fade in" @click="close()" />
	<div id="add-widget-dialog" class="modal fade in" style="display: block; top: 10%">
		<form class="modal-form">
			<div class="modal-header">
				<a class="close" @click="close()">&times;</a>
				<h4>Add Widget</h4>
			</div>
			<div class="modal-body">
				<div class="control-group">
					<ul class="thumbnails">
						<li class="span3" v-for="template in findTemplates()" :key="template.type">
							<div class="thumbnail" style="cursor: pointer" @click="add(template)">
								<p><strong>{{ template.label }}</strong></p>
								<img width="300" height="200" :src="template.thumbnail" alt="Preview" />
								<p>{{ template.description }}</p>
							</div>
						</li>
					</ul>
				</div>
			</div>
			<div class="modal-footer">
				<button type="button" class="btn" @click="close()">Cancel</button>
			</div>
		</form>
	</div>
	</template>
</template>
