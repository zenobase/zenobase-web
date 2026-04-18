<script setup lang="ts">
import { inject, ref, toRef } from 'vue';
import type { GanttParams, GanttTerm, SearchResult } from '../../types/search';
import WidgetState from '../components/WidgetState.vue';
import { type DashboardApi, dashboardKey } from '../composables/useDashboard';
import { useWidgetData } from '../composables/useWidgetData';
import { formatAge } from '../utils/formatAge';
import { getUserName, resolveUserNames } from '../utils/userNames';

const props = defineProps<{
	settings: {
		id: string;
		field: string;
		key_field?: string;
		order?: string;
		limit: number;
		filter?: string;
	};
	active: boolean;
}>();

const dashboard = inject<DashboardApi>(dashboardKey)!;
const terms = ref<GanttTerm[] | null>(null);

function classesForOrderBy(column: string): string[] {
	const classes: string[] = [];
	if (props.settings.order?.includes(column)) {
		classes.push('mdi');
		classes.push(props.settings.order.charAt(0) === '-' ? 'mdi-sort-descending' : 'mdi-sort-ascending');
	}
	return classes;
}

function params(): GanttParams {
	return {
		id: props.settings.id,
		type: 'gantt',
		key_field: props.settings.key_field || 'timestamp',
		field: props.settings.field,
		order: props.settings.order,
		limit: props.settings.limit,
		filter: props.settings.filter,
	};
}

function update(result: SearchResult) {
	const data = (result[props.settings.id] as GanttTerm[]) || [];
	for (const term of data) {
		if (term.count > 1) {
			term.freq = Math.round((new Date(term.last).getTime() - new Date(term.first).getTime()) / (term.count - 1));
		}
	}
	terms.value = data;
	if (props.settings.field === 'author' && terms.value.length > 0) {
		resolveUserNames(terms.value.map((t) => t.label)).then(() => {
			terms.value = [...terms.value!];
		});
	}
}

function init() {
	terms.value = null;
}

function filterByTerm(term: GanttTerm) {
	dashboard.addConstraint(props.settings.field, term.label);
}

function formatDuration(ms: number): string {
	if (ms === 0) return '0';
	if (ms < 1000) return `${ms}ms`;
	const seconds = Math.floor(ms / 1000);
	if (seconds < 60) return `${seconds}s`;
	const minutes = Math.floor(seconds / 60);
	if (minutes < 60) return `${minutes}m`;
	const hours = Math.floor(minutes / 60);
	if (hours < 24) return `${hours}h`;
	const days = Math.floor(hours / 24);
	return `${days}d`;
}

const { failed } = useWidgetData(dashboard, toRef(props, 'active'), params, { init, update });
</script>

<template>
	<div>
		<v-table v-show="terms?.length">
			<thead>
				<tr>
					<th style="text-transform: capitalize">
						{{ settings.field }} <i :class="classesForOrderBy('term')" />
					</th>
					<th style="text-align: right">Last <i :class="classesForOrderBy('max')" /></th>
					<th style="text-align: right">Freq</th>
				</tr>
			</thead>
			<tbody>
				<tr v-for="term in terms" :key="term.label">
					<td><a @click="filterByTerm(term)">{{ settings.field === 'author' ? getUserName(term.label) : term.label }}</a></td>
					<td style="text-align: right"><abbr :title="term.last">{{ formatAge(term.last) }}</abbr></td>
					<td style="text-align: right"><span v-if="term.freq">{{ formatDuration(term.freq) }}</span></td>
				</tr>
			</tbody>
		</v-table>

		<WidgetState v-if="failed" state="failed" />
		<WidgetState v-else-if="terms === null" state="loading" />
		<WidgetState v-else-if="terms.length === 0" state="empty" />
	</div>
</template>
