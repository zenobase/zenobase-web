<script setup lang="ts">
import { computed, inject, nextTick, ref, watch } from 'vue';
import api from '../api';
import { type AlertApi, alertKey } from '../composables/useAlert';
import { getNumericFieldNames, getUnitsForField, TIMESTAMP_SUBFIELDS } from '../utils/fieldRegistry';

const props = defineProps<{
	bucketId: string;
	modelValue: boolean;
}>();

const emit = defineEmits<{
	'update:modelValue': [value: boolean];
	created: [];
}>();

const alertApi = inject<AlertApi>(alertKey)!;

interface FieldOption {
	value: unknown;
	label: string;
}

interface SettingsField {
	key: string;
	label: string;
	type: 'text' | 'date' | 'radio' | 'checkbox' | 'select';
	default: unknown;
	required?: boolean;
	help?: string;
	htmlHelp?: string;
	placeholder?: string;
	options?: FieldOption[] | string;
	checkboxLabel?: string;
}

interface TaskType {
	id: string;
	description: string;
	url?: string;
	fields: SettingsField[];
}

function markerDefault(spec: string): string {
	const now = new Date();
	if (spec.startsWith('months-')) {
		const n = parseInt(spec.substring(7), 10);
		const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - n, 1));
		return d.toISOString().substring(0, 10);
	}
	if (spec.startsWith('weeks-')) {
		const n = parseInt(spec.substring(6), 10);
		const d = new Date(now.getTime() - n * 7 * 24 * 60 * 60 * 1000);
		return d.toISOString().substring(0, 10);
	}
	return spec;
}

const timezones = Intl.supportedValuesOf('timeZone');
const userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

const types: TaskType[] = [
	{
		id: 'demo',
		description: 'Creates demo events.',
		fields: [{ key: 'tag', label: 'Tag', type: 'text', default: 'demo', required: true }],
	},
	{
		id: 'fitbit-activities',
		description: 'Creates an event for each activity.',
		url: 'https://www.fitbit.com/',
		fields: [
			{ key: 'autodetected', label: '', type: 'checkbox', default: false, checkboxLabel: 'include autodetected activities' },
			{ key: 'marker', label: 'Starting from', type: 'date', default: 'months-3' },
		],
	},
	{
		id: 'fitbit-burn',
		description: 'Creates an event for the number of calories burned each day or hour.',
		url: 'https://www.fitbit.com/',
		fields: [
			{ key: 'tag', label: 'Tag', type: 'text', default: 'burn', required: true },
			{
				key: 'hourly',
				label: 'Interval',
				type: 'radio',
				default: false,
				options: [
					{ value: false, label: 'day' },
					{ value: true, label: 'hour' },
				],
			},
			{ key: 'marker', label: 'Starting from', type: 'date', default: 'months-3' },
		],
	},
	{
		id: 'fitbit-cardio',
		description: 'Creates an event for the daily resting heart rate, or the average hourly heart rate.',
		url: 'https://www.fitbit.com/',
		fields: [
			{ key: 'tag', label: 'Tag', type: 'text', default: 'heart rate', required: true },
			{
				key: 'hourly',
				label: 'Interval',
				type: 'radio',
				default: false,
				options: [
					{ value: false, label: 'day (resting heart rate)' },
					{ value: true, label: 'hour (average)' },
				],
			},
			{ key: 'marker', label: 'Starting from', type: 'date', default: 'months-3' },
		],
	},
	{
		id: 'fitbit-food',
		description: 'Creates an event for the number of calories consumed each day.',
		url: 'https://www.fitbit.com/',
		fields: [
			{ key: 'tag', label: 'Tag', type: 'text', default: 'food', required: true },
			{ key: 'marker', label: 'Starting from', type: 'date', default: 'months-12' },
		],
	},
	{
		id: 'fitbit-sleep',
		description: 'Creates an event for each period of sleep.',
		url: 'https://www.fitbit.com/',
		fields: [
			{ key: 'tag', label: 'Tag', type: 'text', default: 'sleep', required: true },
			{ key: 'marker', label: 'Starting from', type: 'date', default: 'months-3' },
		],
	},
	{
		id: 'fitbit-steps',
		description: 'Creates an event for the number of steps each day or hour.',
		url: 'https://www.fitbit.com/',
		fields: [
			{ key: 'tag', label: 'Tag', type: 'text', default: 'steps', required: true },
			{
				key: 'hourly',
				label: 'Interval',
				type: 'radio',
				default: false,
				options: [
					{ value: false, label: 'day (steps, distance, elevation gain and calories burned)' },
					{ value: true, label: 'hour (steps only)' },
				],
			},
			{ key: 'marker', label: 'Starting from', type: 'date', default: 'months-3' },
		],
	},
	{
		id: 'fitbit-weight',
		description: 'Creates an event for the body weight each day.',
		url: 'https://www.fitbit.com/',
		fields: [
			{ key: 'tag', label: 'Tag', type: 'text', default: 'body', required: true },
			{ key: 'marker', label: 'Starting from', type: 'date', default: 'months-3' },
		],
	},
	{
		id: 'foursquare',
		description: 'Creates an event for each place visited.',
		url: 'https://foursquare.com/',
		fields: [{ key: 'marker', label: 'Starting from', type: 'date', default: 'months-12' }],
	},
	{
		id: 'goodreads',
		description: 'Creates an event for each book read.',
		url: 'https://www.goodreads.com/',
		fields: [
			{ key: 'tag', label: 'Tag', type: 'text', default: 'Book', required: true },
			{ key: 'shelf', label: 'Shelf', type: 'text', default: 'read', required: true },
			{ key: 'marker', label: 'Starting from', type: 'date', default: '2007-01-01' },
		],
	},
	{
		id: 'google-activities',
		description: 'Creates an event for each activity.',
		url: 'https://fit.google.com/',
		fields: [
			{ key: 'timezone', label: 'Timezone', type: 'select', default: null, options: 'timezone', required: true },
			{
				key: 'derived',
				label: 'Include',
				type: 'radio',
				default: false,
				options: [
					{ value: true, label: 'all activities' },
					{ value: false, label: 'exercise sessions only' },
				],
			},
			{
				key: 'metric',
				label: 'Units',
				type: 'radio',
				default: true,
				options: [
					{ value: true, label: 'metric' },
					{ value: false, label: 'imperial' },
				],
			},
			{ key: 'marker', label: 'Starting from', type: 'date', default: 'months-12' },
		],
	},
	{
		id: 'google-cardio',
		description: 'Creates an event for each heart rate measurement.',
		url: 'https://fit.google.com/',
		fields: [
			{ key: 'timezone', label: 'Timezone', type: 'select', default: null, options: 'timezone', required: true },
			{ key: 'tag', label: 'Tag', type: 'text', default: 'Heart Rate', required: true },
			{ key: 'marker', label: 'Starting from', type: 'date', default: 'months-12' },
		],
	},
	{
		id: 'google-food',
		description: 'Creates an event for each number of calories consumed that was recorded.',
		url: 'https://fit.google.com/',
		fields: [
			{ key: 'timezone', label: 'Timezone', type: 'select', default: null, options: 'timezone', required: true },
			{ key: 'tag', label: 'Tag', type: 'text', default: 'Food', required: true },
			{ key: 'marker', label: 'Starting from', type: 'date', default: 'months-12' },
		],
	},
	{
		id: 'google-weight',
		description: 'Creates an event for each body weight measurement.',
		url: 'https://fit.google.com/',
		fields: [
			{ key: 'timezone', label: 'Timezone', type: 'select', default: null, options: 'timezone', required: true },
			{ key: 'tag', label: 'Tag', type: 'text', default: 'Weight', required: true },
			{
				key: 'metric',
				label: 'Units',
				type: 'radio',
				default: false,
				options: [
					{ value: true, label: 'metric' },
					{ value: false, label: 'imperial' },
				],
			},
			{ key: 'marker', label: 'Starting from', type: 'date', default: 'months-12' },
		],
	},
	{
		id: 'hexoskin-activities',
		description: 'Creates an event for each activity.',
		url: 'https://www.hexoskin.com/',
		fields: [
			{ key: 'tag', label: 'Tag', type: 'text', default: 'Training', required: true },
			{ key: 'timezone', label: 'Timezone', type: 'select', default: null, options: 'timezone', required: true },
			{ key: 'marker', label: 'Starting from', type: 'date', default: 'months-12' },
		],
	},
	{
		id: 'hexoskin-sleep',
		description: 'Creates an event for each period of sleep.',
		url: 'https://www.hexoskin.com/',
		fields: [
			{ key: 'tag', label: 'Tag', type: 'text', default: 'Sleep', required: true },
			{ key: 'timezone', label: 'Timezone', type: 'select', default: null, options: 'timezone', required: true },
			{ key: 'marker', label: 'Starting from', type: 'date', default: 'months-12' },
		],
	},
	{
		id: 'ihealth-activities',
		description: 'Creates an event for each activity.',
		url: 'https://ihealthlabs.com/',
		fields: [
			{ key: 'tag', label: 'Tag', type: 'text', default: 'Activity', required: true },
			{ key: 'timezone', label: 'Timezone', type: 'select', default: null, options: 'timezone', required: true },
			{ key: 'marker', label: 'Starting from', type: 'date', default: 'months-12' },
		],
	},
	{
		id: 'ihealth-cardio',
		description: 'Creates an event for each heart rate or blood pressure measurement.',
		url: 'https://ihealthlabs.com/',
		fields: [
			{ key: 'tag', label: 'Tag', type: 'text', default: 'Heart', required: true },
			{ key: 'timezone', label: 'Timezone', type: 'select', default: null, options: 'timezone', required: true },
			{ key: 'marker', label: 'Starting from', type: 'date', default: 'months-12' },
		],
	},
	{
		id: 'ihealth-food',
		description: 'Creates an event for each meal.',
		url: 'https://ihealthlabs.com/',
		fields: [
			{ key: 'tag', label: 'Tag', type: 'text', default: 'Meal', required: true },
			{ key: 'timezone', label: 'Timezone', type: 'select', default: null, options: 'timezone', required: true },
			{ key: 'marker', label: 'Starting from', type: 'date', default: 'months-12' },
		],
	},
	{
		id: 'ihealth-glucose',
		description: 'Creates an event for each glucose measurement.',
		url: 'https://ihealthlabs.com/',
		fields: [
			{ key: 'tag', label: 'Tag', type: 'text', default: 'Glucose', required: true },
			{ key: 'timezone', label: 'Timezone', type: 'select', default: null, options: 'timezone', required: true },
			{ key: 'marker', label: 'Starting from', type: 'date', default: 'months-12' },
		],
	},
	{
		id: 'ihealth-sleep',
		description: 'Creates an event for each period of sleep.',
		url: 'https://ihealthlabs.com/',
		fields: [
			{ key: 'tag', label: 'Tag', type: 'text', default: 'Sleep', required: true },
			{ key: 'timezone', label: 'Timezone', type: 'select', default: null, options: 'timezone', required: true },
			{ key: 'marker', label: 'Starting from', type: 'date', default: 'months-12' },
		],
	},
	{
		id: 'ihealth-steps',
		description: 'Creates an event for the number of steps logged.',
		url: 'https://ihealthlabs.com/',
		fields: [
			{ key: 'tag', label: 'Tag', type: 'text', default: 'Steps', required: true },
			{ key: 'timezone', label: 'Timezone', type: 'select', default: null, options: 'timezone', required: true },
			{ key: 'marker', label: 'Starting from', type: 'date', default: 'months-12' },
		],
	},
	{
		id: 'ihealth-weight',
		description: 'Creates an event for each body weight measurement.',
		url: 'https://ihealthlabs.com/',
		fields: [
			{ key: 'tag', label: 'Tag', type: 'text', default: 'Body', required: true },
			{ key: 'timezone', label: 'Timezone', type: 'select', default: null, options: 'timezone', required: true },
			{ key: 'marker', label: 'Starting from', type: 'date', default: 'months-12' },
		],
	},
	{
		id: 'lastfm-tracks',
		description: 'Creates an event for each track played.',
		url: 'https://www.last.fm/',
		fields: [
			{ key: 'tag', label: 'Tag', type: 'text', default: 'track', required: true },
			{ key: 'timezone', label: 'Timezone', type: 'select', default: null, options: 'timezone', required: true },
			{ key: 'marker', label: 'Starting from', type: 'date', default: 'months-3' },
		],
	},
	{
		id: 'mapmyfitness-activities',
		description: 'Creates an event for each activity.',
		url: 'https://www.mapmyfitness.com/',
		fields: [{ key: 'marker', label: 'Starting from', type: 'date', default: 'months-12' }],
	},
	{
		id: 'mapmyfitness-sleep',
		description: 'Creates an event for each period of sleep.',
		url: 'https://www.mapmyfitness.com/',
		fields: [
			{ key: 'tag', label: 'Tag', type: 'text', default: 'Sleep', required: true },
			{ key: 'marker', label: 'Starting from', type: 'date', default: 'months-12' },
		],
	},
	{
		id: 'mapmyfitness-weight',
		description: 'Creates an event for each body weight measurement.',
		url: 'https://www.mapmyfitness.com/',
		fields: [
			{ key: 'tag', label: 'Tag', type: 'text', default: 'Body', required: true },
			{ key: 'marker', label: 'Starting from', type: 'date', default: 'months-12' },
		],
	},
	{
		id: 'netatmo',
		description: 'Creates events for weather station measurements.',
		url: 'https://www.netatmo.com/',
		fields: [
			{ key: 'modules', label: 'Modules', type: 'checkbox', default: true, checkboxLabel: 'include data from modules, not just the main station' },
			{
				key: 'hourly',
				label: 'Interval',
				type: 'radio',
				default: true,
				options: [
					{ value: false, label: '5 min' },
					{ value: true, label: '1 h' },
				],
			},
			{ key: 'marker', label: 'Starting from', type: 'date', default: 'months-3' },
		],
	},
	{
		id: 'oura-steps',
		description: 'Creates an event for the number of steps and calories burned each day.',
		url: 'https://ouraring.com/',
		fields: [
			{ key: 'tag', label: 'Tag', type: 'text', default: 'Steps', required: true },
			{ key: 'marker', label: 'Starting from', type: 'date', default: 'months-6' },
			{ key: 'timezone', label: 'Timezone', type: 'select', default: null, options: 'timezone', required: true },
		],
	},
	{
		id: 'oura-sleep',
		description: 'Creates an event for each period of sleep.',
		url: 'https://ouraring.com/',
		fields: [
			{ key: 'tag', label: 'Tag', type: 'text', default: 'Sleep', required: true },
			{ key: 'marker', label: 'Starting from', type: 'date', default: 'months-6' },
		],
	},
	{
		id: 'oura-readiness',
		description: 'Creates an event for the readiness score for each day.',
		url: 'https://ouraring.com/',
		fields: [
			{ key: 'tag', label: 'Tag', type: 'text', default: 'Readiness', required: true },
			{ key: 'marker', label: 'Starting from', type: 'date', default: 'months-6' },
			{ key: 'timezone', label: 'Timezone', type: 'select', default: null, options: 'timezone', required: true },
		],
	},
	{
		id: 'reporter-questions',
		description: 'Creates an event for each question answered.',
		url: 'http://www.reporter-app.com/',
		fields: [
			{
				key: 'folder',
				label: 'Folder',
				type: 'text',
				default: 'Apps/Reporter-App',
				required: true,
				htmlHelp:
					'The name of the Dropbox folder the data is being exported to. Before proceeding, please add a configuration file to that folder, <a href="https://blog.zenobase.com/post/77238240850" target="_blank">as described here</a>.',
			},
		],
	},
	{
		id: 'rescuetime-productivity',
		description: 'Creates an event for every hour the computer was used.',
		url: 'https://www.rescuetime.com/',
		fields: [
			{ key: 'tag', label: 'Tag', type: 'text', default: '', placeholder: 'optional tag' },
			{
				key: 'kind',
				label: 'Break down by',
				type: 'select',
				default: 'efficiency',
				required: true,
				options: [
					{ value: 'efficiency', label: 'None' },
					{ value: 'overview', label: 'Category' },
					{ value: 'category', label: 'Sub-Category' },
				],
			},
			{
				key: 'source',
				label: 'Source',
				type: 'select',
				default: '',
				options: [
					{ value: '', label: 'All' },
					{ value: 'computers', label: 'Computers' },
					{ value: 'mobile', label: 'Mobile' },
					{ value: 'offline', label: 'Offline' },
				],
			},
			{ key: 'timezone', label: 'Timezone', type: 'select', default: null, options: 'timezone', required: true },
			{ key: 'marker', label: 'Starting from', type: 'date', default: 'months-3', help: 'Only data older than 30 days can be retrieved from free RescueTime accounts.' },
		],
	},
	{
		id: 'sleepcloud',
		description: 'Creates an event for each period of sleep.',
		url: 'https://sites.google.com/site/sleepasandroid/sleepcloud',
		fields: [{ key: 'tag', label: 'Tag', type: 'text', default: 'sleep', required: true }],
	},
	{
		id: 'strava-activities',
		description: 'Creates an event for each activity.',
		url: 'https://www.strava.com/',
		fields: [
			{ key: 'metric', label: '', type: 'checkbox', default: false, checkboxLabel: 'use metric units' },
			{ key: 'marker', label: 'Starting from', type: 'date', default: 'months-12' },
		],
	},
	{
		id: 'trakt',
		description: 'Creates an event for each movie or episode watched.',
		url: 'https://trakt.tv/',
		fields: [{ key: 'marker', label: 'Starting from', type: 'date', default: 'months-12' }],
	},
	{
		id: 'wakatime',
		description: 'Creates an event for every period of time logged for a project.',
		url: 'https://wakatime.com/',
		fields: [
			{ key: 'tag', label: 'Tag', type: 'text', default: 'project', required: true },
			{ key: 'marker', label: 'Starting from', type: 'date', default: 'weeks-2', help: 'Must be no more than two weeks in the past for free WakaTime accounts.' },
		],
	},
	{
		id: 'withings-cardio',
		description: 'Creates an event for each heart rate or blood pressure measurement.',
		url: 'https://www.withings.com/',
		fields: [
			{ key: 'tag', label: 'Tag', type: 'text', default: 'heart rate', required: true },
			{ key: 'timezone', label: 'Timezone', type: 'select', default: null, options: 'timezone', required: true },
			{ key: 'marker', label: 'Starting from', type: 'date', default: 'months-12' },
		],
	},
	{
		id: 'withings-sleep',
		description: 'Creates an event for each period of sleep.',
		url: 'https://www.withings.com/',
		fields: [
			{ key: 'tag', label: 'Tag', type: 'text', default: 'sleep', required: true },
			{ key: 'timezone', label: 'Timezone', type: 'select', default: null, options: 'timezone', required: true },
			{ key: 'marker', label: 'Starting from', type: 'date', default: 'months-3' },
		],
	},
	{
		id: 'withings-steps',
		description: 'Creates an event for the number of steps each day.',
		url: 'https://www.withings.com/',
		fields: [
			{ key: 'tag', label: 'Tag', type: 'text', default: 'steps', required: true },
			{ key: 'unit', label: 'Unit', type: 'select', default: 'mi', required: true, options: 'units:distance' },
			{ key: 'marker', label: 'Starting from', type: 'date', default: 'months-12' },
		],
	},
	{
		id: 'withings-weight',
		description: 'Creates an event for each body weight measurement.',
		url: 'https://www.withings.com/',
		fields: [
			{ key: 'tag', label: 'Tag', type: 'text', default: 'body', required: true },
			{ key: 'unit', label: 'Unit', type: 'select', default: 'lb', required: true, options: 'units:weight' },
			{ key: 'timezone', label: 'Timezone', type: 'select', default: null, options: 'timezone', required: true },
			{ key: 'marker', label: 'Starting from', type: 'date', default: 'months-12' },
		],
	},
	{
		id: 'withings-temperature',
		description: 'Creates an event for each body temperature measurement.',
		url: 'https://www.withings.com/',
		fields: [
			{ key: 'tag', label: 'Tag', type: 'text', default: 'body', required: true },
			{ key: 'unit', label: 'Unit', type: 'select', default: 'C', required: true, options: 'units:temperature' },
			{ key: 'timezone', label: 'Timezone', type: 'select', default: null, options: 'timezone', required: true },
			{ key: 'marker', label: 'Starting from', type: 'date', default: 'months-12' },
		],
	},
];

const visible = ref(false);
const message = ref('');
const selectedType = ref<TaskType>(types[0]);
const settings = ref<Record<string, unknown>>({});

function getSelectOptions(field: SettingsField): FieldOption[] {
	if (Array.isArray(field.options)) return field.options;
	if (field.options === 'timezone') return timezones.map((tz) => ({ value: tz, label: tz }));
	if (field.options === 'numeric-fields') return getNumericFieldNames().map((name) => ({ value: name, label: name }));
	if (field.options === 'timestamp-subfields') return TIMESTAMP_SUBFIELDS.map((sf) => ({ value: sf.value, label: sf.label }));
	if (typeof field.options === 'string' && field.options.startsWith('units:')) {
		const fieldName = field.options.substring(6);
		return getUnitsForField(fieldName).map((u) => ({ value: u, label: u }));
	}
	return [];
}

function resolveDefault(field: SettingsField): unknown {
	if (field.type === 'date' && typeof field.default === 'string') return markerDefault(field.default);
	if (field.options === 'timezone' && field.default === null) return userTimezone;
	return field.default;
}

function initSettings(taskType: TaskType) {
	const s: Record<string, unknown> = {};
	for (const field of taskType.fields) {
		s[field.key] = resolveDefault(field);
	}
	settings.value = s;
}

function init() {
	message.value = '';
	selectedType.value = types[0];
	initSettings(types[0]);
}

watch(
	() => selectedType.value,
	(newType) => {
		initSettings(newType);
	},
);

async function create() {
	alertApi.clear();
	message.value = '';
	const filteredSettings: Record<string, unknown> = {};
	for (const [key, value] of Object.entries(settings.value)) {
		if (value !== null && value !== undefined && value !== '') {
			filteredSettings[key] = value;
		}
	}
	try {
		await api.post('/tasks/', {
			type: selectedType.value.id,
			bucket: props.bucketId,
			settings: Object.keys(filteredSettings).length > 0 ? filteredSettings : undefined,
		});
		close();
		emit('created');
	} catch {
		message.value = "Couldn't create task. Try again later or contact support.";
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
				<h4 class="alert-heading">Create Task</h4>
			</div>
			<div class="modal-body">
				<div class="alert alert-error" v-if="message">{{ message }}</div>
				<div>
					<p class="alert alert-info">This task runs incrementally when the bucket is refreshed.</p>
				</div>
				<div class="control-group">
					<label class="control-label" for="task-type">Type</label>
					<div class="controls">
						<select v-model="selectedType">
							<option v-for="t in types" :key="t.id" :value="t">{{ t.id }}</option>
						</select>
						<p class="help-block">
							{{ selectedType.description }}
							{{ ' ' }}
							<a v-if="selectedType.url" :href="selectedType.url" target="_blank">Source&hellip;</a>
						</p>
					</div>
				</div>
				<template v-for="field in selectedType.fields" :key="field.key">
					<div class="control-group" v-if="field.type === 'text'">
						<label class="control-label" :for="field.key">{{ field.label }}</label>
						<input :name="field.key" type="text" v-model="settings[field.key]" :required="field.required" :placeholder="field.placeholder" />
						<p class="help-block" v-if="field.htmlHelp" v-html="field.htmlHelp"></p>
						<p class="help-block" v-else-if="field.help">{{ field.help }}</p>
					</div>
					<div class="control-group" v-else-if="field.type === 'date'">
						<label class="control-label" :for="field.key">{{ field.label }}</label>
						<input class="input-small" type="date" v-model="settings[field.key]" />
						<p class="help-block" v-if="field.help">{{ field.help }}</p>
					</div>
					<div class="control-group" v-else-if="field.type === 'radio' && Array.isArray(field.options)">
						<label class="control-label">{{ field.label }}</label>
						<label class="radio" v-for="opt in (field.options as FieldOption[])" :key="String(opt.value)">
							<input type="radio" :name="field.key" :value="opt.value" v-model="settings[field.key]" /> {{ opt.label }}
						</label>
					</div>
					<div class="control-group" v-else-if="field.type === 'checkbox'">
						<label class="control-label">{{ field.label }}</label>
						<label class="checkbox">
							<input type="checkbox" v-model="(settings[field.key] as boolean)" /> {{ field.checkboxLabel }}
						</label>
					</div>
					<div class="control-group" v-else-if="field.type === 'select'">
						<label class="control-label" :for="field.key">{{ field.label }}</label>
						<select :name="field.key" v-model="settings[field.key]" :required="field.required">
							<option v-if="!field.required" :value="null"></option>
							<option v-for="opt in getSelectOptions(field)" :key="String(opt.value)" :value="opt.value">{{ opt.label }}</option>
						</select>
						<p class="help-block" v-if="field.help">{{ field.help }}</p>
					</div>
				</template>
			</div>
			<div class="modal-footer">
				<button type="submit" class="btn btn-primary">Save</button>
				<button type="button" class="btn" @click="close()">Cancel</button>
			</div>
		</form>
	</div>
</template>
