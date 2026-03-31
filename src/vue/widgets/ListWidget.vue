<script setup lang="ts">
import { inject, onBeforeUnmount, onMounted, ref } from 'vue';
import type { GeoPoint, ZenoEvent } from '../../types';
import type { ListParams, SearchResult } from '../../types/search';
import { Constraint } from '../../utils/constraint';
import { type DashboardApi, dashboardKey, type WidgetRegistration } from '../composables/useDashboard';
import { esc, formatEventHtml, locationText } from '../utils/eventFormatter';
import { resolveUserNames } from '../utils/userNames';

function locationToHtml(v: unknown): string {
	const obj = v as GeoPoint;
	if (!obj || !('lat' in obj)) return '';
	const text = locationText(obj);
	const filter = text.replace(' ', '') + '~100 m';
	return '<span class="nowrap"><i class="fa fa-map-marker" title="Location"></i> <a class="location-filter" data-filter="' + esc(filter) + '">' + esc(text) + '</a></span>';
}

const FIELD_OVERRIDES: Record<string, (value: unknown) => string> = { location: locationToHtml };

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
	openDialog: [dialogId: string, event: ZenoEvent];
}>();

const dashboard = inject<DashboardApi>(dashboardKey)!;

const offset = ref(0);
const total = ref(0);
const items = ref<ZenoEvent[] | null>(null);
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

function params(): ListParams {
	return {
		id: props.settings.id,
		type: 'list',
		offset: 0,
		limit: props.settings.limit,
		order: props.settings.order,
		filter: buildFilter().join('|'),
	};
}

function update(result: SearchResult) {
	total.value = (result.total as number) ?? 0;
	items.value = (result[props.settings.id] as ZenoEvent[]) || [];
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
	const p = params();
	p.offset = offset.value;
	const result = await dashboard.search([p]);
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
						<span v-html="formatEventHtml(event, undefined, FIELD_OVERRIDES)" @click="onEventClick($event)" />
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
