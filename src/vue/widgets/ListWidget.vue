<script setup lang="ts">
import { inject, onBeforeUnmount, onMounted, ref, watch } from 'vue';
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
	return '<span class="text-no-wrap"><i class="mdi mdi-map-marker" title="Location"></i> <a class="location-filter" data-filter="' + esc(filter) + '">' + esc(text) + '</a></span>';
}

const FIELD_OVERRIDES: Record<string, (value: unknown) => string> = { location: locationToHtml };

interface FilterField {
	id: string;
	label: string;
	icon: string;
	tokenized: boolean;
}

const FILTER_FIELDS: FilterField[] = [
	{ id: 'resource.title', label: 'resources', icon: 'mdi-bookmark', tokenized: true },
	{ id: 'source.title', label: 'sources', icon: 'mdi-open-in-new', tokenized: true },
	{ id: 'tag', label: 'tags', icon: 'mdi-tag', tokenized: false },
	{ id: 'note', label: 'notes', icon: 'mdi-comment-outline', tokenized: true },
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
	update(result);
}

const longPressedEventId = ref<string | null>(null);

function onLongPress(event: ZenoEvent) {
	longPressedEventId.value = event['@id'] as string;
	setTimeout(() => { longPressedEventId.value = null; }, 3000);
}

const dropdownOpen = ref(false);

function _toggleDropdown() {
	dropdownOpen.value = !dropdownOpen.value;
}

function selectField(field: FilterField) {
	filterField.value = field;
	dropdownOpen.value = false;
}

function onEventClick(e: MouseEvent) {
	const target = e.target as HTMLElement;
	if (target.closest('a')) {
		const locationLink = target.closest('.location-filter') as HTMLElement | null;
		if (locationLink) {
			e.preventDefault();
			const filter = locationLink.dataset.filter;
			if (filter) {
				dashboard.addConstraint('location', filter, false);
			}
		}
	}
}

function closeDropdownOnOutsideClick(e: MouseEvent) {
	const target = e.target as HTMLElement;
	if (dropdownOpen.value && !target.closest('.btn-group')) {
		dropdownOpen.value = false;
	}
}

let filterDebounce: ReturnType<typeof setTimeout> | null = null;
watch(filterValue, () => {
	if (filterDebounce) clearTimeout(filterDebounce);
	filterDebounce = setTimeout(() => refresh(), 300);
});

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
		<form class="list-search-bar" @submit.prevent="applyFilter()">
			<v-menu>
				<template #activator="{ props: menuProps }">
					<v-icon :icon="filterField.icon" size="small" v-bind="menuProps" style="cursor: pointer" class="text-medium-emphasis" title="Search field" />
				</template>
				<v-list density="compact">
					<v-list-item v-for="field in FILTER_FIELDS" :key="field.id" @click="selectField(field)">
						<template #prepend><v-icon :icon="field.icon" size="small" /></template>
						{{ field.label }}
					</v-list-item>
				</v-list>
			</v-menu>
			<input
				v-model="filterValue"
				:placeholder="'search in ' + filterField.label"
				class="list-search-input"
			/>
			<v-icon v-if="filterValue" icon="mdi-close" size="x-small" class="text-medium-emphasis" style="cursor: pointer" title="Clear" @click="clearFilter()" />
			<v-icon icon="mdi-filter" size="small" :class="filterValue ? 'text-primary' : 'text-disabled'" style="cursor: pointer" title="Apply filter to dashboard" @click="applyFilter()" />
		</form>

		<v-table v-show="items?.length" density="default">
			<tbody>
				<tr v-for="event in items" :key="event['@id'] as string" class="event-row" :class="{ 'event-row--editable': editable && !isVirtual }" @click="onEventClick($event)" @contextmenu.prevent="editable && !isVirtual && onLongPress(event)">
					<td style="line-height: 1.5; border-style: none; position: relative; overflow: visible">
						<span v-html="formatEventHtml(event, undefined, FIELD_OVERRIDES)" />
						<div v-if="editable && !isVirtual" class="row-actions" :class="{ 'row-actions--visible': longPressedEventId === event['@id'] }">
							<v-btn icon="mdi-pencil" size="small" variant="elevated" color="primary" title="Edit" @click.stop="emit('openDialog', 'edit-event-dialog', event)" />
						</div>
					</td>
				</tr>
			</tbody>
		</v-table>

		<p v-if="items === null" class="none">Loading...</p>
		<p v-else-if="items.length === 0" class="none">None</p>

		<div class="d-flex align-center justify-end" v-show="items?.length">
			<v-btn icon variant="text" title="Previous" :disabled="!hasPrev()" @click="prev()"><v-icon icon="mdi-chevron-left" /></v-btn>
			<span style="color: rgba(0,0,0,0.5)"><b>{{ offset + 1 }}</b>&ndash;<b>{{ offset + (items?.length ?? 0) }}</b> of <b>{{ total.toLocaleString() }}</b></span>
			<v-btn icon variant="text" title="Next" :disabled="!hasNext()" @click="next()"><v-icon icon="mdi-chevron-right" /></v-btn>
		</div>
	</div>
</template>
