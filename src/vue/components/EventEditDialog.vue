<script setup lang="ts">
import { computed, inject, nextTick, ref, watch } from 'vue';
import api from '../api';
import { type AlertApi, alertKey } from '../composables/useAlert';
import { formatDuration, formatRelativeTime } from '../utils/eventFormatter';
import { getFieldIcon, getNumericFieldNames, getTextFieldNames, getUnitsForField } from '../utils/fieldRegistry';

declare const google: {
	maps: {
		Map: new (el: HTMLElement, options: Record<string, unknown>) => GoogleMap;
		LatLng: new (lat: number, lng: number) => GoogleLatLng;
		Marker: new (options: Record<string, unknown>) => GoogleMarker;
		MapTypeId: { ROADMAP: string };
		event: {
			addListener(instance: unknown, event: string, handler: (...args: unknown[]) => void): void;
		};
		places: {
			Autocomplete: new (input: HTMLInputElement, options?: Record<string, unknown>) => GooglePlacesAutocomplete;
		};
	};
};

interface GoogleMap {
	setCenter(latLng: GoogleLatLng): void;
	setZoom(zoom: number): void;
	getBounds(): GoogleLatLngBounds | undefined;
}

interface GoogleLatLng {
	lat(): number;
	lng(): number;
}

interface GoogleLatLngBounds {
	isEmpty(): boolean;
}

interface GoogleMarker {
	setPosition(latLng: GoogleLatLng): void;
	setMap(map: GoogleMap | null): void;
}

interface GooglePlacesAutocomplete {
	bindTo(key: string, map: GoogleMap): void;
	getPlace(): { geometry?: { location?: GoogleLatLng } };
}

const props = defineProps<{
	bucketId: string;
	modelValue: boolean;
	event: Record<string, unknown> | null;
}>();

const emit = defineEmits<{
	'update:modelValue': [value: boolean];
	saved: [];
}>();

const alertApi = inject<AlertApi>(alertKey)!;

const modalEl = ref<HTMLElement | null>(null);
const message = ref('');
const entries = ref<Array<{ field: string; value: string; stars?: number }>>([]);
const newField = ref('');

const EDITABLE_FIELDS = [...getTextFieldNames().filter((f) => f !== 'author' && f !== 'source'), 'location', 'timestamp', ...getNumericFieldNames()].sort();

// Field-specific input state
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

// Template refs
const locationSearchEl = ref<HTMLInputElement | null>(null);
const locationMapEl = ref<HTMLElement | null>(null);

// Map state
let map: GoogleMap | null = null;
let marker: GoogleMarker | null = null;

// Tags cache
const tags = ref<string[]>([]);

const isNew = ref(true);
const eventData = ref<Record<string, unknown>>({});
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

function init(event: Record<string, unknown> | null) {
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
	for (const field of EDITABLE_FIELDS) {
		const value = eventData.value[field];
		if (value === undefined || value === null) continue;
		const values = Array.isArray(value) ? value : [value];
		for (const v of values) {
			if (field === 'timestamp') {
				result.push({ field, value: formatRelativeTime(String(v)) });
			} else if (field === 'duration') {
				result.push({ field, value: formatDuration(Number(v)) });
			} else if (field === 'rating') {
				result.push({ field, value: `${v}%`, stars: Math.round((Number(v) || 0) / 20) });
			} else if (typeof v === 'object' && v !== null) {
				if ('@value' in v) {
					result.push({ field, value: `${v['@value']} ${v['unit'] || ''}`.trim() });
				} else if ('lat' in v && 'lon' in v) {
					result.push({ field, value: `${v['lat']}, ${v['lon']}` });
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
		// ignore fetch errors
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
		// ignore fetch errors
	} finally {
		resourceLoading.value = false;
	}
}

function setLocationFromLatLng(lat: number, lng: number) {
	newLat.value = lat;
	newLon.value = lng;
	if (marker && map) {
		const pos = new google.maps.LatLng(lat, lng);
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
		map!.setCenter(new google.maps.LatLng(parsed.lat, parsed.lng));
	}
}

function initLocationMap() {
	if (!locationMapEl.value) return;
	map = new google.maps.Map(locationMapEl.value, {
		center: new google.maps.LatLng(0, 0),
		zoom: 2,
		mapTypeId: google.maps.MapTypeId.ROADMAP,
		draggableCursor: 'crosshair',
		streetViewControl: false,
	});
	marker = new google.maps.Marker({
		map: null,
		draggable: true,
	});
	google.maps.event.addListener(map, 'click', (...args: unknown[]) => {
		const e = args[0] as { latLng: GoogleLatLng };
		setLocationFromLatLng(e.latLng.lat(), e.latLng.lng());
		marker!.setMap(map);
	});
	google.maps.event.addListener(marker, 'dragend', (...args: unknown[]) => {
		const e = args[0] as { latLng: GoogleLatLng };
		newLat.value = e.latLng.lat();
		newLon.value = e.latLng.lng();
	});
	if (locationSearchEl.value) {
		const autocomplete = new google.maps.places.Autocomplete(locationSearchEl.value);
		autocomplete.bindTo('bounds', map as unknown as GoogleMap);
		google.maps.event.addListener(autocomplete, 'place_changed', () => {
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
		map!.setCenter(new google.maps.LatLng(lat, lng));
		map!.setZoom(10);
	});
}

// Watch field changes to initialize field-specific UI
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
	<div v-if="visible" class="modal-backdrop fade in" @click="close()" />
	<div ref="modalEl" class="modal" :class="{ hide: !visible, in: visible, fade: true }" :style="visible ? { display: 'block', top: '10%' } : {}">
		<div class="modal-header">
			<a class="close" @click="close()">&times;</a>
			<h4>Event</h4>
		</div>
		<div class="modal-body">
			<div class="alert alert-error" v-if="message">{{ message }}</div>

			<div class="control-group">
				<label class="control-label">Field</label>
				<select class="input-large" v-model="newField">
					<option value="" />
					<option v-for="f in EDITABLE_FIELDS" :key="f" :value="f">{{ f }}</option>
				</select>
			</div>

			<div class="well well-small" v-if="newField">
				<a class="close" @click="resetField()">&times;</a>

				<!-- Tag: text with typeahead -->
				<template v-if="fieldCategory === 'tag'">
					<div class="control-group">
						<label class="control-label">Value</label>
						<input type="text" v-model="newValue" list="tag-suggestions" @keyup.enter="addEntry()" />
					<datalist id="tag-suggestions">
						<option v-for="t in tags" :key="t" :value="t" />
					</datalist>
					</div>
				</template>

				<!-- Note: textarea -->
				<template v-else-if="fieldCategory === 'note'">
					<div class="control-group">
						<label class="control-label">Value</label>
						<textarea v-model="newValue"></textarea>
					</div>
				</template>

				<!-- Simple text: author, source -->
				<template v-else-if="fieldCategory === 'text'">
					<div class="control-group">
						<label class="control-label">Value</label>
						<input type="text" v-model="newValue" @keyup.enter="addEntry()" />
					</div>
				</template>

				<!-- Resource: URL + Title -->
				<template v-else-if="fieldCategory === 'resource'">
					<div class="control-group">
						<label class="control-label">URL</label>
						<input type="text" v-model="newUrl" @blur="fetchResourceTitle()" />
					</div>
					<div class="control-group">
						<label class="control-label">Title</label>
						<div class="input-append">
							<input type="text" v-model="newTitle" :disabled="resourceLoading" />
							<a class="add-on" @click="refreshResourceTitle()" style="cursor: pointer"><i class="fa fa-refresh" :class="{ 'fa-spin': resourceLoading }"></i></a>
						</div>
					</div>
				</template>

				<!-- Timestamp: date + time + timezone -->
				<template v-else-if="fieldCategory === 'timestamp'">
					<div class="control-group">
						<input type="date" v-model="newDate" class="input-small" />
						<input type="text" v-model="newTime" class="input-mini" placeholder="HH:MM" />
						<select v-model="newTimezone" class="input-small">
							<option value="" />
							<option v-for="tz in TIMEZONE_OFFSETS" :key="tz" :value="tz">{{ tz }}</option>
						</select>
					</div>
				</template>

				<!-- Location: map + search -->
				<template v-else-if="fieldCategory === 'location'">
					<div class="control-group">
						<input ref="locationSearchEl" type="text" class="search-query" @input="onLocationSearchInput()" />
					</div>
					<div ref="locationMapEl" style="height: 200px; margin-bottom: 10px"></div>
				</template>

				<!-- Numeric with units -->
				<template v-else-if="fieldCategory === 'unit'">
					<div class="control-group">
						<label class="control-label">Value</label>
						<input type="number" step="any" v-model.number="newNumValue" @keyup.enter="addEntry()" />
					</div>
					<div class="control-group">
						<label class="control-label">Unit</label>
						<select v-model="newUnit">
							<option value="" />
							<option v-for="u in fieldUnits" :key="u" :value="u">{{ u }}</option>
						</select>
					</div>
				</template>

				<!-- Duration: days/hours/minutes/seconds -->
				<template v-else-if="fieldCategory === 'duration'">
					<div class="control-group input-append">
						<input type="number" v-model.number="newDays" class="input-mini" />
						<span class="add-on"><strong>d</strong></span>
					</div>
					<div class="control-group input-append">
						<input type="number" min="0" max="23" v-model.number="newHours" class="input-mini" />
						<span class="add-on"><strong>h</strong></span>
					</div>
					<div class="control-group input-append">
						<input type="number" min="0" max="59" v-model.number="newMinutes" class="input-mini" />
						<span class="add-on"><strong>min</strong></span>
					</div>
					<div class="control-group input-append">
						<input type="number" min="0" max="59" v-model.number="newSeconds" class="input-mini" />
						<span class="add-on"><strong>s</strong></span>
					</div>
				</template>

				<!-- Pace: minutes/seconds + unit -->
				<template v-else-if="fieldCategory === 'pace'">
					<div class="control-group input-append">
						<input type="number" min="0" v-model.number="newMinutes" class="input-mini" />
						<span class="add-on" title="minutes"><strong>'</strong></span>
					</div>
					<div class="control-group input-append">
						<input type="number" min="0" max="59" v-model.number="newSeconds" class="input-mini" />
						<span class="add-on" title="seconds"><strong>"</strong></span>
					</div>
					<div class="control-group input-prepend">
						<span class="add-on" title="per"><strong>/</strong></span>
						<select v-model="newUnit" class="input-small">
							<option value="" />
							<option v-for="u in fieldUnits" :key="u" :value="u">{{ u }}</option>
						</select>
					</div>
				</template>

				<!-- Count: integer -->
				<template v-else-if="fieldCategory === 'count'">
					<div class="control-group">
						<label class="control-label">Value</label>
						<input type="number" v-model.number="newNumValue" @keyup.enter="addEntry()" />
					</div>
				</template>

				<!-- Rating: 5 stars -->
				<template v-else-if="fieldCategory === 'rating'">
					<div class="control-group">
						<span class="nowrap" style="cursor: pointer; font-size: 1.5em">
							<i v-for="i in 5" :key="i"
								class="fa"
								:class="(highlightedStars || newStars) >= i ? 'fa-star' : 'fa-star-o'"
								:title="'Rate ' + i + '/5'"
								@mouseenter="highlightedStars = i"
								@mouseleave="highlightedStars = 0"
								@click="newStars = i"
							></i>
						</span>
					</div>
				</template>

				<!-- Percentage / Moon / Humidity -->
				<template v-else-if="fieldCategory === 'percent'">
					<div class="control-group">
						<label class="control-label">Value</label>
						<input type="number" min="0" max="100" :step="newField === 'percentage' ? 0.1 : 1" v-model.number="newNumValue" class="input-small" @keyup.enter="addEntry()" /> %
					</div>
				</template>

				<!-- Currency -->
				<template v-else-if="fieldCategory === 'currency'">
					<div class="control-group">
						<label class="control-label">Value</label>
						<input type="number" step="0.01" v-model.number="newNumValue" @keyup.enter="addEntry()" />
					</div>
				</template>

				<div class="control-group">
					<button class="btn" :disabled="!isValid" @click="addEntry()">Add</button>
				</div>
			</div>

			<div style="padding-top: 1em">
				<em v-if="entries.length === 0">Add one or more fields, then save.</em>
				<span v-for="(entry, i) in entries" :key="i" class="editable">
					<template v-if="entry.stars !== undefined">
						<span class="nowrap" :title="entry.value"><i v-for="s in 5" :key="s" class="fa" :class="entry.stars >= s ? 'fa-star' : 'fa-star-o'"></i></span>
					</template>
					<template v-else>
						<i class="fa" :class="getFieldIcon(entry.field)" :title="entry.field"></i> {{ entry.value }}
					</template>
					{{ ' ' }}<a class="action" @click="removeEntry(i)"><i class="fa fa-times" title="Delete" /></a>
					{{ ' ' }}
				</span>
			</div>
		</div>
		<div class="modal-footer">
			<button class="btn btn-primary" :disabled="!!newField || entries.length === 0" @click="save()">Save</button>
			<button class="btn" @click="close()">Cancel</button>
		</div>
	</div>
</template>
