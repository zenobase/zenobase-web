<script setup lang="ts">
import { computed, inject, onMounted, ref } from 'vue';
import { type DashboardApi, dashboardKey, type WidgetRegistration } from '../composables/useDashboard';
import { getUserName, resolveUserNames } from '../utils/userNames';

interface ScoreboardTerm {
	label: string;
	count: number;
	min?: number;
	max?: number;
	sum?: number;
	avg?: number;
}

const props = defineProps<{
	settings: {
		id: string;
		key_field: string;
		value_field: string;
		unit?: string;
		order?: string;
		limit: number;
		filter?: string;
		statistics?: string[];
	};
}>();

const dashboard = inject<DashboardApi>(dashboardKey)!;
const terms = ref<ScoreboardTerm[] | null>(null);

const statistics = computed(() => props.settings.statistics ?? ['count', 'sum', 'avg']);

function classesForOrderBy(column: string): string[] {
	const classes: string[] = [];
	if (props.settings.order?.includes(column)) {
		classes.push('fa');
		classes.push(props.settings.order.charAt(0) === '-' ? 'fa-sort-desc' : 'fa-sort-asc');
	}
	return classes;
}

function selected(stat: string): boolean {
	return statistics.value.includes(stat);
}

function params(): Record<string, unknown> {
	return {
		id: props.settings.id,
		type: 'scoreboard',
		key_field: props.settings.key_field,
		value_field: props.settings.value_field,
		unit: props.settings.unit,
		order: props.settings.order,
		limit: props.settings.limit,
		filter: props.settings.filter,
	};
}

function update(result: Record<string, unknown>) {
	terms.value = (result[props.settings.id] as ScoreboardTerm[]) || [];
	if (props.settings.key_field === 'author' && terms.value.length > 0) {
		resolveUserNames(terms.value.map((t) => t.label)).then(() => {
			terms.value = [...terms.value!];
		});
	}
}

function init() {
	terms.value = null;
}

function filterByTerm(term: ScoreboardTerm) {
	dashboard.addConstraint(props.settings.key_field, term.label);
}

function formatNumber(value: unknown): string {
	if (typeof value === 'number') {
		return Number.isInteger(value) ? value.toLocaleString() : value.toLocaleString(undefined, { maximumFractionDigits: 2 });
	}
	if (typeof value === 'object' && value !== null && '@value' in value) {
		const obj = value as { '@value': number; unit?: string };
		const formatted = formatNumber(obj['@value']);
		return obj.unit ? formatted + ' ' + obj.unit : formatted;
	}
	return String(value ?? '');
}

const registration: WidgetRegistration = { params, update, init };
onMounted(() => dashboard.register(registration));
</script>

<template>
	<div>
		<table class="table" v-show="terms?.length">
			<thead>
				<tr>
					<th style="text-transform: capitalize">{{ settings.key_field }} <i :class="classesForOrderBy('term')" /></th>
					<th v-if="selected('count')" style="text-align: right">Count <i :class="classesForOrderBy('count')" /></th>
					<th v-if="selected('min')" style="text-align: right">Min <i :class="classesForOrderBy('min')" /></th>
					<th v-if="selected('max')" style="text-align: right">Max <i :class="classesForOrderBy('max')" /></th>
					<th v-if="selected('sum')" style="text-align: right">Sum <i :class="classesForOrderBy('sum')" /></th>
					<th v-if="selected('avg')" style="text-align: right">Avg <i :class="classesForOrderBy('avg')" /></th>
				</tr>
			</thead>
			<tbody>
				<tr v-for="term in terms" :key="term.label">
					<td><a @click="filterByTerm(term)">{{ settings.key_field === 'author' ? getUserName(term.label) : term.label }}</a></td>
					<td v-if="selected('count')" style="text-align: right">{{ formatNumber(term.count) }}</td>
					<td v-if="selected('min')" style="text-align: right">{{ formatNumber(term.min) }}</td>
					<td v-if="selected('max')" style="text-align: right">{{ formatNumber(term.max) }}</td>
					<td v-if="selected('sum')" style="text-align: right">{{ formatNumber(term.sum) }}</td>
					<td v-if="selected('avg')" style="text-align: right">{{ formatNumber(term.avg) }}</td>
				</tr>
			</tbody>
		</table>

		<p v-if="terms === null" class="none">Loading...</p>
		<p v-else-if="terms.length === 0" class="none">None</p>
	</div>
</template>
