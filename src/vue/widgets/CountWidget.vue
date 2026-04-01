<script setup lang="ts">
import { inject, onMounted, ref } from 'vue';
import type { CountParams, CountTerm, SearchResult } from '../../types/search';
import { type DashboardApi, dashboardKey, type WidgetRegistration } from '../composables/useDashboard';
import { getUserName, resolveUserNames } from '../utils/userNames';

const props = defineProps<{
	settings: {
		id: string;
		field: string;
		limit: number;
		order?: string;
		filter?: string;
	};
}>();

const dashboard = inject<DashboardApi>(dashboardKey)!;

const offset = ref(0);
const more = ref(false);
const terms = ref<Array<{ label: string; count: number }> | null>(null);

function classesForOrderBy(column: string): string[] {
	const classes: string[] = [];
	if (props.settings.order?.includes(column)) {
		classes.push('mdi');
		classes.push(props.settings.order.charAt(0) === '-' ? 'mdi-sort-descending' : 'mdi-sort-ascending');
	}
	return classes;
}

function hasPrev(): boolean {
	return offset.value > 0;
}

function hasNext(): boolean {
	return more.value;
}

function prev() {
	offset.value -= props.settings.limit;
	refresh();
}

function next() {
	offset.value += props.settings.limit;
	refresh();
}

function params(): CountParams {
	return {
		id: props.settings.id,
		type: 'count',
		field: props.settings.field,
		offset: offset.value,
		limit: props.settings.limit,
		order: props.settings.order,
		filter: props.settings.filter,
	};
}

function update(result: SearchResult) {
	const data = (result[props.settings.id] as CountTerm[]) || [];
	more.value = data.length > props.settings.limit;
	terms.value = more.value ? data.slice(0, props.settings.limit) : data;
	if (props.settings.field === 'author' && terms.value.length > 0) {
		resolveUserNames(terms.value.map((t) => t.label)).then(() => {
			terms.value = [...terms.value!];
		});
	}
}

function init() {
	offset.value = 0;
	more.value = false;
	terms.value = null;
}

async function refresh() {
	const result = await dashboard.search([params()]);
	update(result);
}

function filterByTerm(term: { label: string }) {
	offset.value = 0;
	dashboard.addConstraint(props.settings.field, term.label);
}

const registration: WidgetRegistration = { params, update, init };
onMounted(() => dashboard.register(registration));
</script>

<template>
	<div>
		<v-table v-show="terms?.length">
			<thead>
				<tr>
					<th style="text-transform: capitalize">
						{{ settings.field }} <i :class="classesForOrderBy('term')" />
					</th>
					<th style="text-align: right">
						Count <i :class="classesForOrderBy('count')" />
					</th>
				</tr>
			</thead>
			<tbody>
				<tr v-for="term in terms" :key="term.label">
					<td><a @click="filterByTerm(term)">{{ settings.field === 'author' ? getUserName(term.label) : term.label }}</a></td>
					<td style="text-align: right">{{ term.count.toLocaleString() }}</td>
				</tr>
			</tbody>
		</v-table>

		<p v-if="terms === null" class="none">Loading...</p>
		<p v-else-if="terms.length === 0" class="none">None</p>

		<div class="d-flex align-center" v-show="terms?.length">
			<v-spacer />
			<span class="text-body-2"><b>{{ offset + 1 }}</b> &ndash; <b>{{ offset + (terms?.length ?? 0) }}</b></span>
			<div class="d-flex ga-1">
				<v-btn variant="text" size="small" title="Previous" :disabled="!hasPrev()" @click="prev()"><v-icon icon="mdi-chevron-left" size="small" /></v-btn>
				<v-btn variant="text" size="small" title="Next" :disabled="!hasNext()" @click="next()"><v-icon icon="mdi-chevron-right" size="small" /></v-btn>
			</div>
		</div>
	</div>
</template>
