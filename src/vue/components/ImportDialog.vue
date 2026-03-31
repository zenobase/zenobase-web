<script setup lang="ts">
import { inject, nextTick, ref, watch } from 'vue';
import type { ZenoEvent } from '../../types';
import { parseLibreView, parseSleepCycle } from '../../utils/importers';
import { parseCSV } from '../../utils/importers/csv';
import api from '../api';
import { type AlertApi, alertKey } from '../composables/useAlert';
import { dateParser } from '../utils/dateParser';
import { formatEventHtml } from '../utils/eventFormatter';

const props = defineProps<{
	bucketId: string;
	modelValue: boolean;
}>();

const emit = defineEmits<{
	'update:modelValue': [value: boolean];
	imported: [];
}>();

const alertApi = inject<AlertApi>(alertKey)!;

type SettingsType = 'timezone';

interface ImportSettings {
	field?: string;
	unit?: string;
	tag?: string;
	timezone?: string;
	encoding?: string;
	[key: string]: unknown;
}

interface ImportFormat {
	id: string;
	label: string;
	description: string;
	settingsType?: SettingsType;
	defaultSettings?: ImportSettings;
	parse: (data: string, settings: ImportSettings) => ZenoEvent[];
}

const formats: ImportFormat[] = [
	{
		id: 'zenobase',
		label: 'Zenobase',
		description: 'Import a <b>.json</b> or <b>.csv</b> file exported from another bucket.<br/>The fields are described in the <a href="/#/api/events" target="_blank">API docs</a>.',
		parse: (data: string) => {
			if (data.charAt(0) === '{' || data.charAt(0) === '[') {
				const events = JSON.parse(data);
				if (events?.events) {
					return Array.isArray(events.events) ? (events.events as ZenoEvent[]) : [];
				}
				return Array.isArray(events) ? (events as ZenoEvent[]) : [];
			}
			return parseCSV(data).data as unknown as ZenoEvent[];
		},
	},
	{
		id: 'libreview',
		label: 'LibreView',
		description: 'Import a <b>.csv</b> file containing blood sugar readings and notes from <a href="https://www.libreview.com/" target="_blank">LibreView</a>.',
		settingsType: 'timezone',
		defaultSettings: { timezone: 'UTC', encoding: 'UTF-16LE' },
		parse: (data: string, settings: ImportSettings) => parseLibreView(data, { tag: 'Glucose', timezone: settings.timezone || 'UTC' }, dateParser),
	},
	{
		id: 'sleepcycle',
		label: 'SleepCycle',
		description: 'Import a <b>.csv</b> file from <a href="https://www.sleepcycle.com/" target="_blank">SleepCycle</a>.',
		parse: (data: string) => parseSleepCycle(data, dateParser),
	},
];

const timezones = (() => {
	try {
		return Intl.supportedValuesOf('timeZone');
	} catch {
		return ['UTC'];
	}
})();

const previewExcludeFields = new Set(['author']);

const visible = ref(false);
const message = ref('');
const importing = ref(false);
const selectedFormat = ref<ImportFormat>(formats[0]);
const settings = ref<ImportSettings>({});
const events = ref<ZenoEvent[]>([]);
const previewOffset = ref(0);
const fileInput = ref<HTMLInputElement | null>(null);

function initSettings() {
	if (selectedFormat.value.defaultSettings) {
		settings.value = { ...selectedFormat.value.defaultSettings };
	} else {
		settings.value = {};
	}
}

function init(formatId?: string) {
	importing.value = false;
	message.value = '';
	events.value = [];
	previewOffset.value = 0;
	selectedFormat.value = formats[0];
	if (formatId) {
		const found = formats.find((f) => f.id === formatId);
		if (found) {
			selectedFormat.value = found;
		}
	}
	initSettings();
}

function onFormatChange() {
	message.value = '';
	events.value = [];
	previewOffset.value = 0;
	initSettings();
	if (fileInput.value) {
		fileInput.value.value = '';
	}
}

function onFileSelected(e: Event) {
	const target = e.target as HTMLInputElement;
	const files = target.files;
	if (!files || files.length === 0) return;
	message.value = '';
	events.value = [];
	previewOffset.value = 0;
	const reader = new FileReader();
	reader.onload = (ev) => {
		try {
			const data = ev.target?.result as string;
			events.value = selectedFormat.value.parse(data, settings.value);
		} catch (error: unknown) {
			message.value = (error as Error).message || 'Failed to parse file.';
			events.value = [];
			settings.value = {};
		}
	};
	const encoding = (settings.value.encoding as string) || undefined;
	reader.readAsText(files[0], encoding);
}

function prevPreview() {
	if (previewOffset.value > 0) previewOffset.value--;
}

function nextPreview() {
	if (previewOffset.value + 1 < events.value.length) previewOffset.value++;
}

async function submit() {
	alertApi.clear();
	importing.value = true;
	message.value = '';
	try {
		const response = await api.post(`/buckets/${props.bucketId}/`, { events: events.value });
		alertApi.show('Imported events.', 'success', response.headers('X-Command-ID') || '');
		events.value = [];
		previewOffset.value = 0;
		close();
		emit('imported');
	} catch (e: unknown) {
		const data = (e as { data?: { message?: string } }).data;
		message.value = data?.message || "Couldn't import the file. Try again later, or contact support.";
		settings.value = {};
		events.value = [];
		previewOffset.value = 0;
		if (fileInput.value) {
			fileInput.value.value = '';
		}
	} finally {
		importing.value = false;
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

watch(selectedFormat, () => {
	onFormatChange();
});
</script>

<template>
	<div v-if="visible" class="modal-backdrop fade in" @click="close()" />
	<div class="modal" :class="{ hide: !visible, in: visible, fade: true }" :style="visible ? { display: 'block', top: '10%' } : {}">
		<form class="modal-form" @submit.prevent="submit()">
			<fieldset :disabled="importing">
				<div class="modal-header">
					<a class="close" @click="close()">&times;</a>
					<h4>Import</h4>
				</div>
				<div class="modal-body">
					<div class="alert alert-error" v-if="message">{{ message }}</div>
					<div class="control-group form-horizontal">
						<select class="input-medium" v-model="selectedFormat" :disabled="importing">
							<option v-for="f in formats" :key="f.id" :value="f">{{ f.label }}</option>
						</select>
						{{ ' ' }}
						<span class="btn btn-file">
							<span>Select file</span>
							<input ref="fileInput" type="file" @change="onFileSelected" />
						</span>
					</div>
					<div class="controls">
						<span class="help-block" v-html="selectedFormat.description"></span>
					</div>
				</div>
				<div class="modal-body modal-append" v-if="events.length === 0 && selectedFormat.settingsType === 'timezone'">
					<div class="control-group">
						<select name="timezone" v-model="settings.timezone" required>
							<option v-for="tz in timezones" :key="tz" :value="tz">{{ tz }}</option>
						</select>
						<p class="help-block">The timezone to use.</p>
					</div>
				</div>
				<div class="modal-body modal-append" v-if="events.length > 0">
					<p v-html="formatEventHtml(events[previewOffset], previewExcludeFields)"></p>
					<div class="btn-group pull-right">
						<button type="button" class="btn disabled zeno-paging">Preview <b>{{ previewOffset + 1 }}</b> of <b>{{ events.length.toLocaleString() }}</b></button>
						<button type="button" class="btn" title="Previous" @click="prevPreview()" :disabled="previewOffset === 0"><i class="fa fa-chevron-left" /></button>
						<button type="button" class="btn" title="Next" @click="nextPreview()" :disabled="previewOffset + 1 >= events.length"><i class="fa fa-chevron-right" /></button>
					</div>
				</div>
				<div class="modal-footer">
					<button type="submit" class="btn btn-primary" :disabled="importing || events.length === 0">Import</button>
					<button type="button" class="btn" @click="close()" :disabled="importing">Cancel</button>
				</div>
			</fieldset>
		</form>
	</div>
</template>
