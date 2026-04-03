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
	<v-dialog v-model="visible" max-width="700" @update:model-value="!$event && close()">
		<v-card>
			<v-card-title>Import</v-card-title>
			<v-form @submit.prevent="submit()">
				<fieldset :disabled="importing" style="border: none; padding: 0; margin: 0">
					<v-card-text>
						<v-alert v-if="message" type="error" variant="tonal" class="mb-4">{{ message }}</v-alert>
						<div class="d-flex ga-2 align-center mb-4">
							<v-select :items="formats" item-title="label" item-value="id" return-object v-model="selectedFormat" :disabled="importing" label="Format" style="max-width: 200px" hide-details />
							<v-btn variant="outlined" @click="fileInput?.click()">Select file</v-btn>
							<input ref="fileInput" type="file" style="display: none" @change="onFileSelected" />
						</div>
						<div class="text-body-2 mb-4" v-html="selectedFormat.description"></div>
						<v-select v-if="events.length === 0 && selectedFormat.settingsType === 'timezone'" :items="timezones" v-model="settings.timezone" label="Timezone *" required hint="The timezone to use." persistent-hint />
						<template v-if="events.length > 0">
							<p v-html="formatEventHtml(events[previewOffset], previewExcludeFields)"></p>
							<div class="d-flex align-center mt-2">
								<v-spacer />
								<v-btn icon variant="text" title="Previous" :disabled="previewOffset === 0" @click="prevPreview()"><v-icon icon="mdi-chevron-left" /></v-btn>
								<span style="color: rgba(0,0,0,0.5)">Preview <b>{{ previewOffset + 1 }}</b> of <b>{{ events.length.toLocaleString() }}</b></span>
								<v-btn icon variant="text" title="Next" :disabled="previewOffset + 1 >= events.length" @click="nextPreview()"><v-icon icon="mdi-chevron-right" /></v-btn>
							</div>
						</template>
					</v-card-text>
					<v-card-actions>
						<v-spacer />
						<v-btn type="submit" color="primary" :disabled="importing || events.length === 0">Import</v-btn>
						<v-btn variant="text" @click="close()" :disabled="importing">Cancel</v-btn>
					</v-card-actions>
				</fieldset>
			</v-form>
		</v-card>
	</v-dialog>
</template>
