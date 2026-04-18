<script setup lang="ts">
import { inject, ref, toRef } from 'vue';
import type { Rating, RatingsParams, SearchResult } from '../../types/search';
import { type DashboardApi, dashboardKey } from '../composables/useDashboard';
import { useWidgetData } from '../composables/useWidgetData';

const props = defineProps<{
	settings: {
		id: string;
		filter?: string;
	};
	active: boolean;
}>();

const dashboard = inject<DashboardApi>(dashboardKey)!;
const ratings = ref<Rating[] | null>(null);

function params(): RatingsParams {
	return {
		id: props.settings.id,
		type: 'ratings',
		filter: props.settings.filter,
	};
}

function update(result: SearchResult) {
	ratings.value = (result[props.settings.id] as Rating[]) || [];
}

function init() {
	ratings.value = null;
}

function toStars(value: number | null): number {
	if (value === null || value === undefined) return 0;
	return Math.round(value / 20);
}

function formatBound(value: number | null): string {
	return typeof value === 'number' ? `${value}%` : '*';
}

function filterByRating(rating: Rating) {
	dashboard.addConstraint('rating', `[${formatBound(rating.from)}..${formatBound(rating.to)})`);
}

const { failed } = useWidgetData(dashboard, toRef(props, 'active'), params, { init, update });
</script>

<template>
	<div>
		<v-table v-show="ratings?.length">
			<thead>
				<tr>
					<th>Rating</th>
					<th style="text-align: right">Count</th>
				</tr>
			</thead>
			<tbody>
				<tr v-for="rating in ratings" :key="rating.from ?? 'null'">
					<td>
						<a @click="filterByRating(rating)" aria-label="Filter by rating">
							<v-icon v-for="i in 5" :key="i" :icon="toStars(rating.from) >= i ? 'mdi-star' : 'mdi-star-outline'" size="small" />
						</a>
					</td>
					<td style="text-align: right">{{ rating.count.toLocaleString() }}</td>
				</tr>
			</tbody>
		</v-table>

		<p v-if="failed" class="none">Failed</p>
		<p v-else-if="ratings === null" class="none">Loading...</p>
		<p v-else-if="ratings.length === 0" class="none">None</p>
	</div>
</template>
