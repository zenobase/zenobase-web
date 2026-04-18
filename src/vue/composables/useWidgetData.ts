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
			const requests: Promise<SearchResult>[] = [dashboard.search([p])];
			if (dashboard.constraintsB.value.length > 0) {
				requests.push(dashboard.searchB([p]));
			}
			const responses = await Promise.all(requests);
			if (fetchedGeneration !== gen) return;
			if (typeof responses[0]['total'] === 'number') {
				dashboard.total.value = responses[0]['total'];
			}
			const resultB = responses.length > 1 ? responses[1] : undefined;
			if (resultB && typeof resultB['total'] === 'number') {
				dashboard.totalB.value = resultB['total'];
			}
			handlers.update(responses[0], resultB);
		} catch {
			if (fetchedGeneration !== gen) return;
			failed.value = true;
		}
	}

	watch([dashboard.generation, active], fetch);

	return { failed };
}
