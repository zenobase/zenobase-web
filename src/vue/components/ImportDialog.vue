<script setup lang="ts">
import { computed, inject, nextTick, ref, watch } from 'vue';
import { parseBasis } from '../../utils/importers/basis';
import { parseCSV } from '../../utils/importers/csv';
import { parseHabitBull } from '../../utils/importers/habitbull';
import { parseHealthKit } from '../../utils/importers/healthkit';
import { parseLibreView } from '../../utils/importers/libreview';
import { parseMoodPanda } from '../../utils/importers/moodpanda';
import { parseNomie } from '../../utils/importers/nomie';
import { parseNomie5 } from '../../utils/importers/nomie5';
import { parseSleepCycle } from '../../utils/importers/sleepcycle';
import { parseSleepyHead } from '../../utils/importers/sleepyhead';
import { parseSunSprite } from '../../utils/importers/sunsprite';
import { parseTapLog } from '../../utils/importers/taplog';
import api from '../api';
import { type AlertApi, alertKey } from '../composables/useAlert';
import { dateParser } from '../utils/dateParser';
import { formatEventHtml } from '../utils/eventFormatter';
import { getUnitsForField, NUMERIC_FIELDS } from '../utils/fieldRegistry';

const props = defineProps<{
	bucketId: string;
	modelValue: boolean;
}>();

const emit = defineEmits<{
	'update:modelValue': [value: boolean];
	imported: [];
}>();

const alertApi = inject<AlertApi>(alertKey)!;

type SettingsType = 'field-unit' | 'tag-timezone' | 'timezone';

interface ImportFormat {
	id: string;
	label: string;
	description: string;
	settingsType?: SettingsType;
	defaultSettings?: Record<string, unknown>;
	parse: (data: string, settings: Record<string, unknown>) => Record<string, unknown>[];
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
					return Array.isArray(events.events) ? events.events : [];
				}
				return Array.isArray(events) ? events : [];
			}
			return parseCSV(data).data as unknown as Record<string, unknown>[];
		},
	},
	{
		id: 'basis',
		label: 'Basis',
		description: 'Import a <b>.csv</b> file from <a href="https://www.mybasis.com/" target="_blank">Basis</a>.',
		parse: (data: string) => parseBasis(data, { tag: 'Basis' }, dateParser),
	},
	{
		id: 'habitbull',
		label: 'HabitBull',
		description: 'Import a <b>.csv</b> file from <a href="http://www.habitbull.com/" target="_blank">HabitBull</a>.',
		parse: (data: string) => parseHabitBull(data, dateParser),
	},
	{
		id: 'healthkit',
		label: 'HealthKit',
		description: 'Import HealthKit data from a <b>.csv</b> file exported with the <a href="http://quantifiedself.com/access-app/app" target="_blank">QS Access</a> app.',
		parse: (data: string) => parseHealthKit(data, dateParser),
	},
	{
		id: 'libreview',
		label: 'LibreView',
		description: 'Import a <b>.csv</b> file containing blood sugar readings and notes from <a href="https://www.libreview.com/" target="_blank">LibreView</a>.',
		settingsType: 'timezone',
		defaultSettings: { timezone: 'UTC', encoding: 'UTF-16LE' },
		parse: (data: string, settings: Record<string, unknown>) => parseLibreView(data, { tag: 'Glucose', timezone: (settings.timezone as string) || 'UTC' }, dateParser),
	},
	{
		id: 'nomie',
		label: 'Nomie',
		description: 'Import a <b>.json</b> or <b>.csv</b> file from <a href="https://nomie.io/" target="_blank">Nomie</a>.',
		settingsType: 'field-unit',
		parse: (data: string, settings: Record<string, unknown>) => parseNomie(data, { field: settings.field as string, unit: settings.unit as string }, dateParser),
	},
	{
		id: 'nomie5',
		label: 'Nomie 5',
		description: 'Import a <b>.csv</b> file from <a href="https://nomie.io/" target="_blank">Nomie</a>.',
		settingsType: 'field-unit',
		parse: (data: string, settings: Record<string, unknown>) => parseNomie5(data, { field: settings.field as string, unit: settings.unit as string }, dateParser),
	},
	{
		id: 'moodpanda',
		label: 'MoodPanda',
		description: 'Import a <b>.csv</b> file from <a href="https://moodpanda.com/" target="_blank">MoodPanda</a>.',
		settingsType: 'tag-timezone',
		defaultSettings: { tag: 'Mood', timezone: 'UTC' },
		parse: (data: string, settings: Record<string, unknown>) => parseMoodPanda(data, { tag: (settings.tag as string) || 'Mood', timezone: (settings.timezone as string) || 'UTC' }, dateParser),
	},
	{
		id: 'sleepcycle',
		label: 'SleepCycle',
		description: 'Import a <b>.csv</b> file from <a href="https://www.sleepcycle.com/" target="_blank">SleepCycle</a>.',
		parse: (data: string) => parseSleepCycle(data, dateParser),
	},
	{
		id: 'sleepyhead',
		label: 'SleepyHead',
		description: 'Import a <b>.csv</b> file from <a href="https://sleepyhead.jedimark.net/" target="_blank">SleepyHead</a>.',
		settingsType: 'tag-timezone',
		defaultSettings: { tag: 'sleep', timezone: 'UTC' },
		parse: (data: string, settings: Record<string, unknown>) => parseSleepyHead(data, { tag: (settings.tag as string) || 'sleep', timezone: (settings.timezone as string) || 'UTC' }, dateParser),
	},
	{
		id: 'sunsprite',
		label: 'SunSprite',
		description: 'Import a <b>.csv</b> file from <a href="https://www.sunsprite.com/" target="_blank">SunSprite</a>.',
		settingsType: 'tag-timezone',
		defaultSettings: { tag: 'Sunlight', timezone: 'UTC' },
		parse: (data: string, settings: Record<string, unknown>) => parseSunSprite(data, { tag: (settings.tag as string) || 'Sunlight', timezone: (settings.timezone as string) || 'UTC' }, dateParser),
	},
	{
		id: 'taplog',
		label: 'TapLog',
		description: 'Import a <b>.csv</b> file from <a href="https://welcome.taplog.info/" target="_blank">TapLog</a>.',
		settingsType: 'field-unit',
		parse: (data: string, settings: Record<string, unknown>) => parseTapLog(data, { field: settings.field as string, unit: settings.unit as string }),
	},
];

const timezones = (() => {
	try {
		return Intl.supportedValuesOf('timeZone');
	} catch {
		return ['UTC'];
	}
})();

const numericFields = NUMERIC_FIELDS.map((f) => f.name);
const previewExcludeFields = new Set(['author']);

const visible = ref(false);
const message = ref('');
const importing = ref(false);
const selectedFormat = ref<ImportFormat>(formats[0]);
const settings = ref<Record<string, unknown>>({});
const events = ref<Record<string, unknown>[]>([]);
const previewOffset = ref(0);
const fileInput = ref<HTMLInputElement | null>(null);

const availableUnits = computed(() => {
	const field = settings.value.field as string;
	return field ? getUnitsForField(field) : [];
});

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

watch(
	() => settings.value.field,
	() => {
		const units = availableUnits.value;
		settings.value.unit = units.length ? units[0] : null;
	},
);
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
				<div class="modal-body modal-append" v-if="events.length === 0 && selectedFormat.settingsType === 'field-unit'">
					<div class="controls form-horizontal">
						<select name="field" class="input-medium" v-model="settings.field">
							<option value="">N/A</option>
							<option v-for="f in numericFields" :key="f" :value="f">{{ f }}</option>
						</select>
						<span v-if="availableUnits.length"> in
							<select name="unit" class="input-small" v-model="settings.unit">
								<option v-for="u in availableUnits" :key="u" :value="u">{{ u }}</option>
							</select>
						</span>
					</div>
					<div class="control-group">
						<p class="help-block">The field to map {{ selectedFormat.id === 'taplog' ? 'numbers' : 'values' }} to.</p>
					</div>
				</div>
				<div class="modal-body modal-append" v-if="events.length === 0 && selectedFormat.settingsType === 'tag-timezone'">
					<div class="control-group">
						<input name="tag" type="text" required v-model="settings.tag" />
						<p class="help-block">A tag to add to every event.</p>
					</div>
					<div class="control-group">
						<select name="timezone" v-model="settings.timezone" required>
							<option v-for="tz in timezones" :key="tz" :value="tz">{{ tz }}</option>
						</select>
						<p class="help-block">The timezone to use.</p>
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
