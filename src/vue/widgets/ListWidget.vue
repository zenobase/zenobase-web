<script setup lang="ts">
import { inject, onBeforeUnmount, onMounted, ref } from 'vue';
import { Constraint } from '../../utils/constraint';
import { type DashboardApi, dashboardKey, type WidgetRegistration } from '../composables/useDashboard';
import { getUserName, resolveUserNames } from '../utils/userNames';

// Helpers

function esc(value: unknown): string {
	const div = document.createElement('div');
	div.textContent = String(value ?? '');
	return div.innerHTML;
}

function textWithUnit(value: unknown): string {
	if (typeof value === 'object' && value !== null && '@value' in value) {
		const obj = value as Record<string, unknown>;
		return obj['@value'] + ' ' + (obj['unit'] || '');
	}
	return String(value);
}

function formatDuration(ms: number): string {
	const parts: string[] = [];
	const totalSec = Math.floor(ms / 1000);
	const d = Math.floor(totalSec / 86400);
	const h = Math.floor((totalSec % 86400) / 3600);
	const m = Math.floor((totalSec % 3600) / 60);
	const s = totalSec % 60;
	if (d) parts.push(d + 'd');
	if (h) parts.push(h + 'h');
	if (m) parts.push(m + 'min');
	if (s && parts.length < 2) parts.push(s + 's');
	if (parts.length === 0) parts.push(ms + 'ms');
	return parts.slice(0, 2).join(' ');
}

function formatRelativeTime(isoStr: string): string {
	const diff = Math.abs(Date.now() - new Date(isoStr).getTime());
	if (diff < 60000) return 'just now';
	if (diff >= 79200000) {
		// >= 22 hours: show absolute
		const d = new Date(isoStr);
		const mo = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][d.getMonth()];
		const pad = (n: number) => (n < 10 ? '0' + n : String(n));
		return `${mo} ${d.getDate()}, ${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
	}
	const minutes = Math.floor(diff / 60000);
	if (minutes < 60) return minutes + ' minutes ago';
	const hours = Math.floor(minutes / 60);
	return hours + ' hours ago';
}

function ratingStarsHtml(value: number): string {
	const stars = Math.round((value || 0) / 20);
	let html = '<span class="nowrap" title="' + value + '%">';
	for (let i = 0; i < 5; ++i) {
		html += '<i class="fa ' + (stars > i ? 'fa-star' : 'fa-star-o') + '"></i>';
	}
	html += '</span>';
	return html;
}

function locationText(value: Record<string, unknown>): string {
	return Math.round(Number(value['lat']) * 1000) / 1000 + ', ' + Math.round(Number(value['lon']) * 1000) / 1000;
}

// Field registry — produces HTML matching AngularJS Field.toHtml() output
// Ordered to match Field.findAll() order

type FieldDef = { name: string; icon: string; title: string; toHtml: (value: unknown) => string };

const FIELD_REGISTRY: FieldDef[] = [
	{
		name: 'tag',
		icon: 'fa-tag',
		title: 'Tag',
		toHtml: (v) => '<span class="nowrap"><i class="fa fa-tag" title="Tag"></i> ' + esc(v) + '</span>',
	},
	{
		name: 'resource',
		icon: 'fa-bookmark',
		title: 'Resource',
		toHtml: (v) => {
			const obj = v as Record<string, unknown>;
			if (!obj || !obj['title']) return '';
			return (
				'<span><i class="fa fa-bookmark" title="Resource"></i>&nbsp;<a href="/to?url=' +
				esc(obj['url']) +
				'" target="_blank" rel="nofollow noopener noreferrer">' +
				esc(obj['title']) +
				'</a></span>'
			);
		},
	},
	{ name: 'distance', icon: 'fa-arrows-h', title: 'Distance', toHtml: (v) => '<span class="nowrap"><i class="fa fa-arrows-h" title="Distance"></i> ' + esc(textWithUnit(v)) + '</span>' },
	{ name: 'height', icon: 'fa-arrows-v', title: 'Height', toHtml: (v) => '<span class="nowrap"><i class="fa fa-arrows-v" title="Height"></i> ' + esc(textWithUnit(v)) + '</span>' },
	{
		name: 'weight',
		icon: 'fa-caret-square-o-down',
		title: 'Weight',
		toHtml: (v) => '<span class="nowrap"><i class="fa fa-caret-square-o-down" title="Weight"></i> ' + esc(textWithUnit(v)) + '</span>',
	},
	{
		name: 'percentage',
		icon: 'fa-th',
		title: 'Percentage',
		toHtml: (v) => {
			const n = Number(v);
			return '<span class="nowrap"><i class="fa fa-th" title="Percentage"></i> <abbr title="' + n + '%">' + Math.round(n) + '%</abbr></span>';
		},
	},
	{ name: 'moon', icon: 'fa-moon-o', title: 'Moon', toHtml: (v) => '<span class="nowrap"><i class="fa fa-moon-o" title="Moon"></i> ' + v + '%</span>' },
	{ name: 'volume', icon: 'fa-flask', title: 'Volume', toHtml: (v) => '<span class="nowrap"><i class="fa fa-flask" title="Volume"></i> ' + esc(textWithUnit(v)) + '</span>' },
	{ name: 'concentration', icon: 'fa-tint', title: 'Concentration', toHtml: (v) => '<span class="nowrap"><i class="fa fa-tint" title="Concentration"></i> ' + esc(textWithUnit(v)) + '</span>' },
	{
		name: 'distance/volume',
		icon: 'fa-flask',
		title: 'Distance/Volume',
		toHtml: (v) => '<span class="nowrap"><i class="fa fa-flask" title="Distance/Volume"></i> ' + esc(textWithUnit(v)) + '</span>',
	},
	{ name: 'humidity', icon: 'fa-tint', title: 'Humidity', toHtml: (v) => '<span class="nowrap"><i class="fa fa-tint" title="Humidity"></i> ' + v + '%</span>' },
	{ name: 'pressure', icon: 'fa-arrows-alt', title: 'Pressure', toHtml: (v) => '<span class="nowrap"><i class="fa fa-arrows-alt" title="Pressure"></i> ' + esc(textWithUnit(v)) + '</span>' },
	{ name: 'sound', icon: 'fa-volume-up', title: 'Sound Level', toHtml: (v) => '<span class="nowrap"><i class="fa fa-volume-up" title="Sound Level"></i> ' + esc(textWithUnit(v)) + '</span>' },
	{
		name: 'location',
		icon: 'fa-map-marker',
		title: 'Location',
		toHtml: (v) => {
			const obj = v as Record<string, unknown>;
			if (!obj || !('lat' in obj)) return '';
			const text = locationText(obj);
			const filter = text.replace(' ', '') + '~100 m';
			return '<span class="nowrap"><i class="fa fa-map-marker" title="Location"></i> <a class="location-filter" data-filter="' + esc(filter) + '">' + esc(text) + '</a></span>';
		},
	},
	{
		name: 'timestamp',
		icon: 'fa-calendar-o',
		title: 'Timestamp',
		toHtml: (v) => '<span class="nowrap"><i class="fa fa-calendar-o" title="Timestamp"></i> <abbr title="' + esc(v) + '">' + esc(formatRelativeTime(String(v))) + '</abbr></span>',
	},
	{ name: 'velocity', icon: 'fa-tachometer', title: 'Velocity', toHtml: (v) => '<span class="nowrap"><i class="fa fa-tachometer" title="Velocity"></i> ' + esc(textWithUnit(v)) + '</span>' },
	{ name: 'pace', icon: 'fa-clock-o', title: 'Pace', toHtml: (v) => '<span class="nowrap"><i class="fa fa-clock-o" title="Pace"></i> ' + esc(textWithUnit(v)) + '</span>' },
	{
		name: 'duration',
		icon: 'fa-clock-o',
		title: 'Duration',
		toHtml: (v) => {
			const ms = typeof v === 'number' ? v : typeof v === 'object' && v !== null && '@value' in v ? Number((v as Record<string, unknown>)['@value']) : 0;
			return '<span class="nowrap"><i class="fa fa-clock-o" title="Duration"></i> <abbr>' + esc(formatDuration(ms)) + '</abbr></span>';
		},
	},
	{ name: 'frequency', icon: 'fa-heart', title: 'Frequency', toHtml: (v) => '<span class="nowrap"><i class="fa fa-heart" title="Frequency"></i> ' + esc(textWithUnit(v)) + '</span>' },
	{ name: 'bits', icon: 'fa-hdd-o', title: 'Bits', toHtml: (v) => '<span class="nowrap"><i class="fa fa-hdd-o" title="Bits"></i> ' + esc(textWithUnit(v)) + '</span>' },
	{ name: 'count', icon: 'fa-th', title: 'Count', toHtml: (v) => '<span class="nowrap"><i class="fa fa-th" title="Count"></i> ' + Number(v).toLocaleString() + '</span>' },
	{ name: 'energy', icon: 'fa-fire', title: 'Energy', toHtml: (v) => '<span class="nowrap"><i class="fa fa-fire" title="Energy"></i> ' + esc(textWithUnit(v)) + '</span>' },
	{ name: 'light', icon: 'fa-sun-o', title: 'Light', toHtml: (v) => '<span class="nowrap"><i class="fa fa-sun-o" title="Light"></i> ' + esc(textWithUnit(v)) + '</span>' },
	{ name: 'temperature', icon: 'fa-fire', title: 'Temperature', toHtml: (v) => '<span class="nowrap"><i class="fa fa-fire" title="Temperature"></i> ' + esc(textWithUnit(v)) + '</span>' },
	{ name: 'rating', icon: 'fa-star', title: 'Rating', toHtml: (v) => ratingStarsHtml(Number(v)) },
	{
		name: 'currency',
		icon: 'fa-money',
		title: 'Currency',
		toHtml: (v) => '<span class="nowrap"><i class="fa fa-money" title="Currency"></i> ' + Number(v).toFixed(2) + '</span>',
	},
	{ name: 'note', icon: 'fa-comment-o', title: 'Note', toHtml: (v) => '<span><i class="fa fa-comment-o" title="Note"></i>&nbsp;' + esc(v) + '</span>' },
	{
		name: 'author',
		icon: 'fa-user',
		title: 'User',
		toHtml: (v) => '<span class="nowrap"><i class="fa fa-user" title="User"></i> ' + esc(getUserName(String(v))) + '</span>',
	},
	{
		name: 'source',
		icon: 'fa-external-link',
		title: 'Source',
		toHtml: (v) => {
			const obj = v as Record<string, unknown>;
			if (!obj || !obj['title']) return '';
			return (
				'<span class="nowrap"><i class="fa fa-external-link" title="Source"></i> <a href="/to?url=' + esc(obj['url']) + '" target="_blank" rel="nofollow">' + esc(obj['title']) + '</a></span>'
			);
		},
	},
];

function unwrap(value: unknown): unknown {
	if (Array.isArray(value) && value.length === 1) return value[0];
	return value;
}

function formatEventHtml(event: Record<string, unknown>): string {
	const parts: string[] = [];
	for (const field of FIELD_REGISTRY) {
		let value = event[field.name];
		if (value === undefined || value === null) continue;
		value = unwrap(value);
		const html = field.toHtml(value);
		if (html) parts.push(html);
	}
	return parts.join(' &nbsp; ');
}

interface FilterField {
	id: string;
	label: string;
	icon: string;
	tokenized: boolean;
}

const FILTER_FIELDS: FilterField[] = [
	{ id: 'resource.title', label: 'resources', icon: 'fa-bookmark', tokenized: true },
	{ id: 'source.title', label: 'sources', icon: 'fa-external-link', tokenized: true },
	{ id: 'tag', label: 'tags', icon: 'fa-tag', tokenized: false },
	{ id: 'note', label: 'notes', icon: 'fa-comment-o', tokenized: true },
];

const props = defineProps<{
	settings: {
		id: string;
		limit: number;
		order?: string;
	};
	editable?: boolean;
	isVirtual?: boolean;
}>();

const emit = defineEmits<{
	removeEvent: [eventId: string];
	openDialog: [dialogId: string, event: Record<string, unknown>];
}>();

const dashboard = inject<DashboardApi>(dashboardKey)!;

const offset = ref(0);
const total = ref(0);
const items = ref<Array<Record<string, unknown>> | null>(null);
const filterField = ref<FilterField>(FILTER_FIELDS[0]);
const filterValue = ref('');

function hasPrev(): boolean {
	return offset.value > 0;
}

function hasNext(): boolean {
	return offset.value + props.settings.limit < total.value;
}

function prev() {
	offset.value -= props.settings.limit;
	refresh();
}

function next() {
	offset.value += props.settings.limit;
	refresh();
}

function buildFilter(): Constraint[] {
	const values: string[] = [];
	if (filterValue.value) {
		if (filterField.value.tokenized) {
			const pattern = /([^"]\S*|".+?")\s*/g;
			let match: RegExpExecArray | null = pattern.exec(filterValue.value);
			while (match) {
				values.push(match[1]);
				match = pattern.exec(filterValue.value);
			}
		} else {
			values.push(filterValue.value);
		}
	}
	return values.map((value) => new Constraint(filterField.value.id, value));
}

function applyFilter() {
	dashboard.addConstraints(buildFilter());
	filterValue.value = '';
}

function clearFilter() {
	filterValue.value = '';
}

function params(): Record<string, unknown> {
	return {
		id: props.settings.id,
		type: 'list',
		offset: 0,
		limit: props.settings.limit,
		order: props.settings.order,
		filter: buildFilter().join('|'),
	};
}

function update(result: Record<string, unknown>) {
	total.value = (result['total'] as number) ?? 0;
	items.value = (result[props.settings.id] as Array<Record<string, unknown>>) || [];
	// Resolve author IDs to usernames in the background
	const authorIds = items.value.map((e) => e['author']).filter((a): a is string => typeof a === 'string');
	if (authorIds.length > 0) {
		resolveUserNames(authorIds).then(() => {
			items.value = [...items.value!];
		});
	}
}

function init() {
	offset.value = 0;
	total.value = 0;
	items.value = null;
}

async function refresh() {
	const result = await dashboard.search([{ ...params(), offset: offset.value }]);
	init();
	update(result);
}

const dropdownOpen = ref(false);

function toggleDropdown() {
	dropdownOpen.value = !dropdownOpen.value;
}

function selectField(field: FilterField) {
	filterField.value = field;
	dropdownOpen.value = false;
}

function onEventClick(e: MouseEvent) {
	const target = e.target as HTMLElement;
	const link = target.closest('.location-filter') as HTMLElement | null;
	if (link) {
		e.preventDefault();
		const filter = link.dataset.filter;
		if (filter) {
			dashboard.addConstraint('location', filter, false);
		}
	}
}

function closeDropdownOnOutsideClick(e: MouseEvent) {
	const target = e.target as HTMLElement;
	if (dropdownOpen.value && !target.closest('.btn-group')) {
		dropdownOpen.value = false;
	}
}

const registration: WidgetRegistration = { params, update, init };
onMounted(() => {
	dashboard.register(registration);
	document.addEventListener('click', closeDropdownOnOutsideClick);
});
onBeforeUnmount(() => {
	document.removeEventListener('click', closeDropdownOnOutsideClick);
});
</script>

<template>
	<div>
		<form class="form-search" @submit.prevent="applyFilter()">
			<div class="input-append">
				<input type="text" class="search-query input-large" v-model="filterValue" :placeholder="'search in ' + filterField.label" />
				<div class="btn-group" :class="{ open: dropdownOpen }">
					<button type="button" class="btn dropdown-toggle" title="Field" @click="toggleDropdown()">
						<i class="fa" :class="filterField.icon" />
						{{ ' ' }}
						<span class="caret" />
					</button>
					<button type="button" class="btn" title="Clear" @click="clearFilter()"><i class="fa fa-close" /></button>
					<ul class="dropdown-menu" role="menu">
						<li v-for="field in FILTER_FIELDS" :key="field.id" role="presentation">
							<a role="menuitem" @click="selectField(field)"><i class="fa" :class="field.icon" /> &nbsp; {{ field.label }}</a>
						</li>
					</ul>
				</div>
			</div>
			<div class="pull-right">
				<button type="submit" class="xbtn" title="Filter" :disabled="!filterValue"><i class="fa fa-filter" /></button>
			</div>
		</form>

		<table class="table" v-show="items?.length">
			<tbody>
				<tr v-for="event in items" :key="event['@id'] as string" class="event-row">
					<td style="line-height: 1.5; border-style: none">
						<span v-html="formatEventHtml(event)" @click="onEventClick($event)" />
						&nbsp;
						<div class="action pull-right" v-if="editable && !isVirtual">
							<a class="event-edit-action" @click="emit('openDialog', 'edit-event-dialog', event)"><i class="fa fa-pencil" title="Edit" /></a>
							{{ ' ' }}
							<a class="event-delete-action" @click="emit('removeEvent', event['@id'] as string)"><i class="fa fa-trash-o" title="Delete" /></a>
						</div>
					</td>
				</tr>
			</tbody>
		</table>

		<p v-if="items === null" class="none">Loading...</p>
		<p v-else-if="items.length === 0" class="none">None</p>

		<div class="btn-toolbar" v-show="items?.length">
			<div class="btn-group pull-right">
				<button class="btn" title="Previous" :disabled="!hasPrev()" @click="prev()"><i class="fa fa-chevron-left" /></button>
				<button class="btn" title="Next" :disabled="!hasNext()" @click="next()"><i class="fa fa-chevron-right" /></button>
			</div>
			<div class="btn-group pull-right">
				<button class="btn disabled zeno-paging"><b>{{ offset + 1 }}</b> &ndash; <b>{{ offset + (items?.length ?? 0) }}</b> of <b>{{ total.toLocaleString() }}</b></button>
			</div>
		</div>
	</div>
</template>
