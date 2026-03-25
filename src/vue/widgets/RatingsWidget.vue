<script setup lang="ts">
import { inject, onMounted, ref } from 'vue';
import { type DashboardApi, dashboardKey, type WidgetRegistration } from '../composables/useDashboard';

interface Rating {
	from: number | null;
	to: number | null;
	count: number;
}

const props = defineProps<{
	settings: {
		id: string;
		filter?: string;
	};
}>();

const dashboard = inject<DashboardApi>(dashboardKey)!;
const ratings = ref<Rating[] | null>(null);

function params(): Record<string, unknown> {
	return {
		id: props.settings.id,
		type: 'ratings',
		filter: props.settings.filter,
	};
}

function update(result: Record<string, unknown>) {
	ratings.value = (result[props.settings.id] as Rating[]) || [];
}

function init() {
	ratings.value = null;
}

function toStars(value: number | null): number {
	if (value === null || value === undefined) return 0;
	return Math.round(value / 20);
}

function toString(value: number | null): string {
	return typeof value === 'number' ? `${value}%` : '*';
}

function filterByRating(rating: Rating) {
	dashboard.addConstraint('rating', `[${toString(rating.from)}..${toString(rating.to)})`);
}

const registration: WidgetRegistration = { params, update, init };
onMounted(() => dashboard.register(registration));
</script>

<template>
	<div>
		<table class="table" v-show="ratings?.length">
			<thead>
				<tr>
					<th>Rating</th>
					<th style="text-align: right">Count</th>
				</tr>
			</thead>
			<tbody>
				<tr v-for="rating in ratings" :key="rating.from ?? 'null'">
					<td>
						<a @click="filterByRating(rating)">
							<i v-for="i in 5" :key="i" class="fa" :class="toStars(rating.from) >= i ? 'fa-star' : 'fa-star-o'" />
						</a>
					</td>
					<td style="text-align: right">{{ rating.count.toLocaleString() }}</td>
				</tr>
			</tbody>
		</table>

		<p v-if="ratings === null" class="none">Loading...</p>
		<p v-else-if="ratings.length === 0" class="none">None</p>
	</div>
</template>
