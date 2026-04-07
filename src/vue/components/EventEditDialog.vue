<script setup lang="ts">
import { computed, inject, nextTick, ref, watch } from 'vue';
import type { ZenoEvent } from '../../types';
import api from '../api';
import { type AlertApi, alertKey } from '../composables/useAlert';
import { loadGoogleMaps } from '../composables/useGoogleMaps';
import { formatDuration, getFieldIcon, locationText } from '../utils/eventFormatter';
import { getNumericFieldNames, getTextFieldNames, getUnitsForField } from '../utils/fieldRegistry';
import { formatAge } from '../utils/formatAge';

let maps: typeof google.maps;

const props = defineProps<{
	bucketId: string;
	modelValue: boolean;
	event: ZenoEvent | null;
}>();

const emit = defineEmits<{
	'update:modelValue': [value: boolean];
	saved: [];
	deleted: [eventId: string];
}>();

const alertApi = inject<AlertApi>(alertKey)!;

const modalEl = ref<HTMLElement | null>(null);
const message = ref('');
const entries = ref<Array<{ field: string; value: string; stars?: number }>>([]);
const newField = ref('');

const COMMON_FIELDS = ['tag', 'timestamp'];
const OTHER_FIELDS = [...getTextFieldNames().filter((f) => f !== 'author' && f !== 'source' && f !== 'tag'), 'location', ...getNumericFieldNames().filter((f) => f !== 'timestamp')].sort();
const ALL_FIELD_NAMES = [...COMMON_FIELDS, ...OTHER_FIELDS];
const FIELD_SELECT_ITEMS = [...COMMON_FIELDS, ...OTHER_FIELDS];

const newValue = ref('');
const newNumValue = ref<number | null>(null);
const newUnit = ref('');
const newDays = ref(0);
const newHours = ref(0);
const newMinutes = ref(0);
const newSeconds = ref(0);
const newUrl = ref('');
const newTitle = ref('');
const resourceLoading = ref(false);
const newStars = ref(0);
const highlightedStars = ref(0);
const newLat = ref<number | null>(null);
const newLon = ref<number | null>(null);
const newDate = ref('');
const newTime = ref('');
const newTimezone = ref('');

const locationSearchEl = ref<HTMLInputElement | null>(null);
const locationMapEl = ref<HTMLElement | null>(null);

let map: google.maps.Map | null = null;
let marker: google.maps.Marker | null = null;

const tags = ref<string[]>([]);

const isNew = ref(true);
const eventData = ref<ZenoEvent>({});
const visible = ref(false);

const TIMEZONE_OFFSETS = [
	'-12:00',
	'-11:00',
	'-10:00',
	'-09:30',
	'-09:00',
	'-08:00',
	'-07:00',
	'-06:00',
	'-05:00',
	'-04:30',
	'-04:00',
	'-03:00',
	'-02:00',
	'-01:00',
	'Z',
	'+01:00',
	'+02:00',
	'+03:00',
	'+04:00',
	'+04:30',
	'+05:00',
	'+05:30',
	'+05:45',
	'+06:00',
	'+06:30',
	'+07:00',
	'+08:00',
	'+08:45',
	'+09:00',
	'+09:30',
	'+10:00',
	'+11:00',
	'+11:30',
	'+12:00',
	'+12:45',
	'+13:00',
	'+14:00',
];

function getLocalTimezoneOffset(): string {
	const offset = new Date().getTimezoneOffset();
	if (offset === 0) return 'Z';
	const sign = offset < 0 ? '+' : '-';
	const abs = Math.abs(offset);
	const hours = String(Math.floor(abs / 60)).padStart(2, '0');
	const minutes = String(abs % 60).padStart(2, '0');
	return `${sign}${hours}:${minutes}`;
}

type FieldCategory = 'tag' | 'note' | 'text' | 'resource' | 'location' | 'timestamp' | 'unit' | 'duration' | 'pace' | 'count' | 'rating' | 'percent' | 'currency';

const UNIT_FIELDS = ['distance', 'distance/volume', 'height', 'weight', 'volume', 'concentration', 'pressure', 'velocity', 'frequency', 'bits', 'sound', 'energy', 'light', 'temperature'];
const PERCENT_FIELDS = ['percentage', 'moon', 'humidity'];

function getFieldCategory(field: string): FieldCategory {
	if (field === 'tag') return 'tag';
	if (field === 'note') return 'note';
	if (field === 'resource') return 'resource';
	if (field === 'location') return 'location';
	if (field === 'timestamp') return 'timestamp';
	if (field === 'duration') return 'duration';
	if (field === 'pace') return 'pace';
	if (field === 'count') return 'count';
	if (field === 'rating') return 'rating';
	if (field === 'currency') return 'currency';
	if (PERCENT_FIELDS.includes(field)) return 'percent';
	if (UNIT_FIELDS.includes(field)) return 'unit';
	return 'text';
}

const fieldCategory = computed(() => (newField.value ? getFieldCategory(newField.value) : null));

const fieldUnits = computed(() => {
	if (!newField.value) return [];
	if (fieldCategory.value === 'pace') {
		return getUnitsForField(newField.value).map((u) => u.substring(2));
	}
	return getUnitsForField(newField.value);
});

const isValid = computed(() => {
	const cat = fieldCategory.value;
	if (!cat) return false;
	switch (cat) {
		case 'tag':
		case 'text':
		case 'note':
			return !!newValue.value;
		case 'resource':
			return !!newUrl.value && !!newTitle.value;
		case 'location':
			return newLat.value !== null && newLon.value !== null && newLat.value >= -90 && newLat.value <= 90 && newLon.value >= -180 && newLon.value <= 180;
		case 'timestamp':
			return !!newDate.value && !!newTime.value && !!newTimezone.value && !Number.isNaN(new Date(`${newDate.value}T${newTime.value}${newTimezone.value}`).getTime());
		case 'unit':
			return Number.isFinite(Number(newNumValue.value)) && !!newUnit.value;
		case 'duration':
			return ((newDays.value * 24 + newHours.value) * 60 + newMinutes.value) * 60 + newSeconds.value > 0;
		case 'pace':
			return newMinutes.value + newSeconds.value > 0 && !!newUnit.value;
		case 'count':
			return newNumValue.value !== null && /^\d+$/.test(String(newNumValue.value));
		case 'rating':
			return newStars.value > 0;
		case 'percent':
		case 'currency':
			return Number.isFinite(Number(newNumValue.value));
		default:
			return false;
	}
});

function resetInputs() {
	newValue.value = '';
	newNumValue.value = null;
	newUnit.value = '';
	newDays.value = 0;
	newHours.value = 0;
	newMinutes.value = 0;
	newSeconds.value = 0;
	newUrl.value = '';
	newTitle.value = '';
	resourceLoading.value = false;
	newStars.value = 0;
	highlightedStars.value = 0;
	newLat.value = null;
	newLon.value = null;
	newDate.value = '';
	newTime.value = '';
	newTimezone.value = '';
	map = null;
	marker = null;
}

function resetField() {
	newField.value = '';
	resetInputs();
}

function init(event: ZenoEvent | null) {
	message.value = '';
	resetField();
	if (event && Object.keys(event).length > 0) {
		isNew.value = false;
		eventData.value = JSON.parse(JSON.stringify(event));
	} else {
		isNew.value = true;
		eventData.value = {};
	}
	rebuildEntries();
}

function rebuildEntries() {
	const result: Array<{ field: string; value: string; stars?: number }> = [];
	for (const field of ALL_FIELD_NAMES) {
		const value = eventData.value[field];
		if (value === undefined || value === null) continue;
		const values = Array.isArray(value) ? value : [value];
		for (const v of values) {
			if (field === 'timestamp') {
				result.push({ field, value: formatAge(String(v)) });
			} else if (field === 'duration') {
				result.push({ field, value: formatDuration(Number(v)) });
			} else if (field === 'rating') {
				result.push({ field, value: `${v}%`, stars: Math.round((Number(v) || 0) / 20) });
			} else if (typeof v === 'object' && v !== null) {
				if ('@value' in v) {
					result.push({ field, value: `${v['@value']} ${v['unit'] || ''}`.trim() });
				} else if ('lat' in v && 'lon' in v) {
					result.push({ field, value: locationText(v as { lat: number; lon: number }) });
				} else if ('url' in v && 'title' in v) {
					result.push({ field, value: `${v['title']}` });
				} else {
					result.push({ field, value: JSON.stringify(v) });
				}
			} else {
				result.push({ field, value: String(v) });
			}
		}
	}
	entries.value = result;
}

function buildValue(): unknown {
	const cat = fieldCategory.value!;
	switch (cat) {
		case 'tag':
		case 'text':
		case 'note':
			return newValue.value;
		case 'resource':
			return { url: newUrl.value, title: newTitle.value };
		case 'location':
			return { lat: newLat.value, lon: newLon.value };
		case 'timestamp':
			return `${newDate.value}T${newTime.value}:00.000${newTimezone.value}`;
		case 'unit':
			return { '@value': Number(newNumValue.value), unit: newUnit.value };
		case 'duration':
			return (((newDays.value * 24 + newHours.value) * 60 + newMinutes.value) * 60 + newSeconds.value) * 1000;
		case 'pace':
			return { '@value': newMinutes.value * 60 + newSeconds.value, unit: 's/' + newUnit.value };
		case 'count':
		case 'percent':
		case 'currency':
			return Number(newNumValue.value);
		case 'rating':
			return newStars.value * 20;
		default:
			return newValue.value;
	}
}

function addEntry() {
	if (!newField.value || !isValid.value) return;
	const field = newField.value;
	const value = buildValue();
	const existing = eventData.value[field];
	if (existing !== undefined) {
		if (Array.isArray(existing)) {
			existing.push(value);
		} else {
			eventData.value[field] = [existing, value];
		}
	} else {
		eventData.value[field] = value;
	}
	resetField();
	rebuildEntries();
}

function removeEntry(index: number) {
	const entry = entries.value[index];
	const field = entry.field;
	const values = eventData.value[field];
	if (Array.isArray(values)) {
		const filtered = values.filter((_: unknown, i: number) => {
			let count = 0;
			for (let j = 0; j < entries.value.length; j++) {
				if (entries.value[j].field === field) {
					if (j === index) return count !== i;
					count++;
				}
			}
			return true;
		});
		if (filtered.length === 0) {
			delete eventData.value[field];
		} else if (filtered.length === 1) {
			eventData.value[field] = filtered[0];
		} else {
			eventData.value[field] = filtered;
		}
	} else {
		delete eventData.value[field];
	}
	rebuildEntries();
}

async function save() {
	message.value = '';
	alertApi.clear();
	try {
		if (isNew.value) {
			if (!eventData.value['timestamp']) {
				eventData.value['timestamp'] = new Date().toISOString();
			}
			await api.post(`/buckets/${props.bucketId}/`, eventData.value);
		} else {
			const response = await api.put(`/buckets/${props.bucketId}/${eventData.value['@id']}`, eventData.value);
			alertApi.show('Updated an event.', 'success', response.headers('X-Command-ID') || '');
		}
		close();
		emit('saved');
	} catch (e: unknown) {
		const data = (e as { data?: { message?: string } }).data;
		message.value = data?.message || (isNew.value ? "Couldn't create this event." : "Couldn't update this event.");
	}
}

function close() {
	visible.value = false;
	emit('update:modelValue', false);
}

async function fetchResourceTitle() {
	if (!newUrl.value || newTitle.value || resourceLoading.value) return;
	resourceLoading.value = true;
	try {
		const response = await api.get<{ title?: string }>(`/og?url=${encodeURIComponent(newUrl.value)}`);
		if (response.data.title) {
			newTitle.value = response.data.title;
		}
	} catch {
	} finally {
		resourceLoading.value = false;
	}
}

async function refreshResourceTitle() {
	if (!newUrl.value || resourceLoading.value) return;
	resourceLoading.value = true;
	try {
		const response = await api.get<{ title?: string }>(`/og?url=${encodeURIComponent(newUrl.value)}`);
		if (response.data.title) {
			newTitle.value = response.data.title;
		}
	} catch {
	} finally {
		resourceLoading.value = false;
	}
}

function setLocationFromLatLng(lat: number, lng: number) {
	newLat.value = lat;
	newLon.value = lng;
	if (marker && map) {
		const pos = new maps.LatLng(lat, lng);
		marker.setPosition(pos);
	}
}

function parseLatLng(value: string): { lat: number; lng: number } | null {
	const p = value.indexOf(',');
	if (p === -1) return null;
	const lat = parseFloat(value.substring(0, p));
	const lng = parseFloat(value.substring(p + 1));
	return !Number.isNaN(lat) && !Number.isNaN(lng) ? { lat, lng } : null;
}

function onLocationSearchInput() {
	if (!locationSearchEl.value) return;
	const parsed = parseLatLng(locationSearchEl.value.value);
	if (parsed) {
		setLocationFromLatLng(parsed.lat, parsed.lng);
		marker!.setMap(map);
		map!.setCenter(new maps.LatLng(parsed.lat, parsed.lng));
	}
}

async function initLocationMap() {
	maps = await loadGoogleMaps();
	if (!locationMapEl.value) return;
	map = new maps.Map(locationMapEl.value, {
		center: new maps.LatLng(0, 0),
		zoom: 2,
		mapTypeId: maps.MapTypeId.ROADMAP,
		draggableCursor: 'crosshair',
		streetViewControl: false,
	});
	marker = new maps.Marker({
		map: null,
		draggable: true,
	});
	maps.event.addListener(map, 'click', (...args: unknown[]) => {
		const e = args[0] as { latLng: google.maps.LatLng };
		setLocationFromLatLng(e.latLng.lat(), e.latLng.lng());
		marker!.setMap(map);
	});
	maps.event.addListener(marker, 'dragend', (...args: unknown[]) => {
		const e = args[0] as { latLng: google.maps.LatLng };
		newLat.value = e.latLng.lat();
		newLon.value = e.latLng.lng();
	});
	if (locationSearchEl.value) {
		const autocomplete = new maps.places.Autocomplete(locationSearchEl.value);
		autocomplete.bindTo('bounds', map);
		maps.event.addListener(autocomplete, 'place_changed', () => {
			const place = autocomplete.getPlace();
			if (place.geometry?.location) {
				const loc = place.geometry.location;
				setLocationFromLatLng(loc.lat(), loc.lng());
				marker!.setMap(map);
				map!.setCenter(loc);
				map!.setZoom(14);
			}
		});
	}
	geolocate();
}

function geolocate() {
	if (!navigator.geolocation || !map) return;
	navigator.geolocation.getCurrentPosition((pos) => {
		const lat = pos.coords.latitude;
		const lng = pos.coords.longitude;
		setLocationFromLatLng(lat, lng);
		marker!.setMap(map);
		map!.setCenter(new maps.LatLng(lat, lng));
		map!.setZoom(10);
	});
}

watch(newField, (field) => {
	resetInputs();
	if (field === 'tag' && tags.value.length === 0) {
		api.get<string[]>(`/buckets/${props.bucketId}/tags/`)
			.then((response) => {
				tags.value = response.data;
			})
			.catch(() => {});
	} else if (field === 'timestamp') {
		const now = new Date();
		newDate.value = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
		newTime.value = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
		newTimezone.value = getLocalTimezoneOffset();
	} else if (field === 'location') {
		nextTick(() => initLocationMap());
	}
});

watch(
	() => props.modelValue,
	(open) => {
		if (open) {
			init(props.event);
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
	<v-dialog v-model="visible" max-width="700" @update:model-value="!$event && close()">
		<v-card>
			<v-card-title class="d-flex align-center">
				{{ isNew ? 'Create Event' : 'Update Event' }}
				<v-spacer />
				<v-btn icon="mdi-close" variant="text" density="compact" @click="close()" />
			</v-card-title>
			<v-card-text>
				<v-alert v-if="message" type="error" variant="tonal" class="mb-4">{{ message }}</v-alert>

				<v-autocomplete label="Field" :items="FIELD_SELECT_ITEMS" v-model="newField" clearable style="max-width: 300px">
						<template #item="{ item, props: itemProps }">
							<v-list-item v-bind="itemProps">
								<template v-if="COMMON_FIELDS.includes(String(itemProps.title))" #title>
									<span style="font-weight: bold">{{ itemProps.title }}</span>
								</template>
							</v-list-item>
						</template>
					</v-autocomplete>

				<v-card v-if="newField" class="mb-4" variant="outlined">
					<v-card-text>

					<!-- Tag -->
					<template v-if="fieldCategory === 'tag'">
						<v-text-field label="Value" v-model="newValue" list="tag-suggestions" @keyup.enter="addEntry()" style="max-width: 200px" />
						<datalist id="tag-suggestions">
							<option v-for="t in tags" :key="t" :value="t" />
						</datalist>
					</template>

					<!-- Note -->
					<template v-else-if="fieldCategory === 'note'">
						<v-textarea label="Value" v-model="newValue" />
					</template>

					<!-- Simple text -->
					<template v-else-if="fieldCategory === 'text'">
						<v-text-field label="Value" v-model="newValue" @keyup.enter="addEntry()" />
					</template>

					<!-- Resource -->
					<template v-else-if="fieldCategory === 'resource'">
						<v-text-field label="URL" v-model="newUrl" @blur="fetchResourceTitle()" />
						<v-text-field label="Title" v-model="newTitle" :disabled="resourceLoading">
							<template #append-inner>
								<v-icon :icon="resourceLoading ? 'mdi-loading mdi-spin' : 'mdi-refresh'" style="cursor: pointer" @click="refreshResourceTitle()" />
							</template>
						</v-text-field>
					</template>

					<!-- Timestamp -->
					<template v-else-if="fieldCategory === 'timestamp'">
						<div class="d-flex ga-2">
							<v-text-field type="date" v-model="newDate" style="flex: 0 0 auto" />
							<v-text-field type="time" v-model="newTime" style="flex: 0 0 auto" />
							<v-select :items="TIMEZONE_OFFSETS" v-model="newTimezone" style="flex: 0 0 auto" />
						</div>
					</template>

					<!-- Location -->
					<template v-else-if="fieldCategory === 'location'">
						<input ref="locationSearchEl" type="text" class="v-field__input" style="width: 100%; border: 1px solid #ccc; padding: 8px; border-radius: 4px; margin-bottom: 8px" @input="onLocationSearchInput()" />
						<div ref="locationMapEl" style="height: 200px; margin-bottom: 10px"></div>
					</template>

					<!-- Numeric with units -->
					<template v-else-if="fieldCategory === 'unit'">
						<div class="d-flex ga-2">
							<v-text-field label="Value" type="number" step="any" v-model.number="newNumValue" @keyup.enter="addEntry()" style="max-width: 200px" />
							<v-select label="Unit" :items="fieldUnits" v-model="newUnit" style="flex: 0 0 auto" />
						</div>
					</template>

					<!-- Duration -->
					<template v-else-if="fieldCategory === 'duration'">
						<div class="d-flex ga-2">
							<v-text-field type="number" v-model.number="newDays" suffix="d" style="max-width: 100px" />
							<v-text-field type="number" min="0" max="23" v-model.number="newHours" suffix="h" style="max-width: 100px" />
							<v-text-field type="number" min="0" max="59" v-model.number="newMinutes" suffix="min" style="max-width: 100px" />
							<v-text-field type="number" min="0" max="59" v-model.number="newSeconds" suffix="s" style="max-width: 100px" />
						</div>
					</template>

					<!-- Pace -->
					<template v-else-if="fieldCategory === 'pace'">
						<div class="d-flex ga-2 align-center">
							<v-text-field type="number" min="0" v-model.number="newMinutes" suffix="'" style="max-width: 100px" />
							<v-text-field type="number" min="0" max="59" v-model.number="newSeconds" suffix="&quot;" style="max-width: 100px" />
							<span>/</span>
							<v-select :items="fieldUnits" v-model="newUnit" style="max-width: 120px" />
						</div>
					</template>

					<!-- Count -->
					<template v-else-if="fieldCategory === 'count'">
						<v-text-field label="Value" type="number" v-model.number="newNumValue" @keyup.enter="addEntry()" style="max-width: 200px" />
					</template>

					<!-- Rating -->
					<template v-else-if="fieldCategory === 'rating'">
						<div style="cursor: pointer; font-size: 1.5em" class="text-no-wrap">
							<v-icon v-for="i in 5" :key="i"
								:icon="(highlightedStars || newStars) >= i ? 'mdi-star' : 'mdi-star-outline'"
								:title="'Rate ' + i + '/5'"
								@mouseenter="highlightedStars = i"
								@mouseleave="highlightedStars = 0"
								@click="newStars = i"
							/>
						</div>
					</template>

					<!-- Percent -->
					<template v-else-if="fieldCategory === 'percent'">
						<v-text-field label="Value" type="number" min="0" max="100" :step="newField === 'percentage' ? 0.1 : 1" v-model.number="newNumValue" suffix="%" @keyup.enter="addEntry()" style="max-width: 200px" />
					</template>

					<!-- Currency -->
					<template v-else-if="fieldCategory === 'currency'">
						<v-text-field label="Value" type="number" step="0.01" v-model.number="newNumValue" @keyup.enter="addEntry()" style="max-width: 200px" />
					</template>

					</v-card-text>
					<v-card-actions>
						<v-btn :disabled="!isValid" @click="addEntry()">Add</v-btn>
					</v-card-actions>
				</v-card>

				<div class="mt-4">
					<em v-if="entries.length === 0">Add one or more fields.</em>
					<span v-for="(entry, i) in entries" :key="i" class="editable">
						<template v-if="entry.stars !== undefined">
							<span class="text-no-wrap" :title="entry.value"><v-icon v-for="s in 5" :key="s" :icon="entry.stars >= s ? 'mdi-star' : 'mdi-star-outline'" size="small" /></span>
						</template>
						<template v-else>
							<v-icon :icon="getFieldIcon(entry.field)" size="small" :title="entry.field" /> {{ entry.value }}
						</template>
						{{ ' ' }}<v-btn variant="text" size="x-small" @click="removeEntry(i)"><v-icon icon="mdi-close" title="Delete" /></v-btn>
						{{ ' ' }}
					</span>
				</div>
			</v-card-text>
			<v-card-actions>
				<v-btn v-if="!isNew" variant="text" color="error" @click="() => { emit('deleted', eventData['@id'] as string); close() }">Delete</v-btn>
				<v-spacer />
				<v-btn color="primary" :disabled="!!newField || entries.length === 0" @click="save()">{{ isNew ? 'Create' : 'Update' }}</v-btn>
				<v-btn variant="text" @click="close()">Cancel</v-btn>
			</v-card-actions>
		</v-card>
	</v-dialog>
</template>
