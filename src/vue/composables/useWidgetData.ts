import { type Ref, ref, watch } from 'vue';
import type { BaseWidgetParams, SearchResult } from '../../types/search';
import type { DashboardApi } from './useDashboard';

export function useWidgetData(
	dashboard: DashboardApi,
	active: Ref<boolean>,
	params: () => BaseWidgetParams | null,
	handlers: {
		init: () => void;
		update: (result: SearchResult, resultB?: SearchResult) => void;
	},
) {
	const failed = ref(false);
	let fetchedGeneration = 0;

	async function fetch() {
		const gen = dashboard.generation.value;
		if (!active.value || gen === 0 || fetchedGeneration === gen) return;
		fetchedGeneration = gen;
		failed.value = false;
		handlers.init();
		const p = params();
		if (!p) return;
		try {
			const hasA = dashboard.total.value > 0;
			const hasB = dashboard.constraintsB.value.length > 0 && (dashboard.totalB.value ?? 0) > 0;
			const requests: Promise<SearchResult>[] = [hasA ? dashboard.search([p]) : Promise.resolve({})];
			if (dashboard.constraintsB.value.length > 0) {
				requests.push(hasB ? dashboard.searchB([p]) : Promise.resolve({}));
			}
			const responses = await Promise.all(requests);
			if (fetchedGeneration !== gen) return;
			handlers.update(responses[0], responses.length > 1 ? responses[1] : undefined);
		} catch {
			if (fetchedGeneration !== gen) return;
			failed.value = true;
		}
	}

	watch([dashboard.generation, active], fetch);

	return { failed };
}
