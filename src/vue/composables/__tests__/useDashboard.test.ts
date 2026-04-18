import { mount } from '@vue/test-utils';
import { describe, expect, it, vi } from 'vitest';
import { defineComponent, inject, provide } from 'vue';
import { Constraint } from '../../../utils/constraint';
import { type DashboardApi, dashboardKey, useDashboard } from '../useDashboard';

function createTestComponent(bucketId: string, httpGet: (url: string) => Promise<{ data: Record<string, unknown> }>) {
	let locationParams: Record<string, string | string[] | undefined> = {};
	const locationChanges: Array<Record<string, string[] | null>> = [];

	const Parent = defineComponent({
		setup() {
			const dashboard = useDashboard(
				bucketId,
				httpGet,
				(params) => {
					locationChanges.push(params);
				},
				() => locationParams,
			);
			provide(dashboardKey, dashboard);
			return { dashboard };
		},
		template: '<div><slot /></div>',
	});

	const Child = defineComponent({
		setup() {
			const dashboard = inject<DashboardApi>(dashboardKey)!;
			return { dashboard };
		},
		template: '<div />',
	});

	const wrapper = mount(Parent, {
		slots: { default: () => [{ render: () => null, ...Child }] },
	});

	return {
		parent: wrapper.vm.dashboard,
		locationChanges,
		setLocationParams: (params: Record<string, string | string[] | undefined>) => {
			locationParams = params;
		},
	};
}

describe('useDashboard', () => {
	const mockHttpGet = vi.fn().mockResolvedValue({ data: { total: 42 } });

	it('makes facetless request then per-widget requests on refresh', async () => {
		const httpGet = vi.fn().mockResolvedValue({ data: { total: 42 } });
		const { parent } = createTestComponent('bucket1', httpGet);
		parent.setExpectedWidgetCount(2);

		const w1 = {
			params: () => ({ id: 'w1', type: 'count', field: 'tag' }),
			update: vi.fn(),
			init: vi.fn(),
			error: vi.fn(),
		};
		const w2 = {
			params: () => ({ id: 'w2', type: 'timeline', field: 'timestamp' }),
			update: vi.fn(),
			init: vi.fn(),
			error: vi.fn(),
		};

		parent.register(w1);
		parent.register(w2);

		await vi.waitFor(() => {
			// 1 facetless + 2 per-widget = 3 requests
			expect(httpGet).toHaveBeenCalledTimes(3);
		});
		expect(w1.update).toHaveBeenCalled();
		expect(w2.update).toHaveBeenCalled();
		expect(parent.total.value).toBe(42);
	});

	it('only fetches visible widgets when visibleWidgetIds is set', async () => {
		const httpGet = vi.fn().mockResolvedValue({ data: { total: 10 } });
		const { parent } = createTestComponent('bucket1', httpGet);
		parent.setVisibleWidgets(['w1']);
		parent.setExpectedWidgetCount(2);

		const w1 = {
			params: () => ({ id: 'w1', type: 'count', field: 'tag' }),
			update: vi.fn(),
			init: vi.fn(),
			error: vi.fn(),
		};
		const w2 = {
			params: () => ({ id: 'w2', type: 'timeline', field: 'timestamp' }),
			update: vi.fn(),
			init: vi.fn(),
			error: vi.fn(),
		};

		parent.register(w1);
		parent.register(w2);

		await vi.waitFor(() => {
			// 1 facetless + 1 visible widget = 2 requests
			expect(httpGet).toHaveBeenCalledTimes(2);
		});
		expect(w1.update).toHaveBeenCalled();
		expect(w2.update).not.toHaveBeenCalled();
	});

	it('lazily fetches unfetched widget without facetless request', async () => {
		const httpGet = vi.fn().mockResolvedValue({ data: { total: 10 } });
		const { parent } = createTestComponent('bucket1', httpGet);
		parent.setVisibleWidgets(['w1']);
		parent.setExpectedWidgetCount(2);

		const w1 = {
			params: () => ({ id: 'w1', type: 'count', field: 'tag' }),
			update: vi.fn(),
			init: vi.fn(),
			error: vi.fn(),
		};
		const w2 = {
			params: () => ({ id: 'w2', type: 'timeline', field: 'timestamp' }),
			update: vi.fn(),
			init: vi.fn(),
			error: vi.fn(),
		};

		parent.register(w1);
		parent.register(w2);

		await vi.waitFor(() => {
			expect(w1.update).toHaveBeenCalled();
		});
		httpGet.mockClear();

		// Switch to w2 tab — should fetch w2 only
		parent.refresh(['w2']);

		await vi.waitFor(() => {
			expect(httpGet).toHaveBeenCalledTimes(1);
			expect(w2.update).toHaveBeenCalled();
		});
	});

	it('skips already-fetched widget on tab switch', async () => {
		const httpGet = vi.fn().mockResolvedValue({ data: { total: 10 } });
		const { parent } = createTestComponent('bucket1', httpGet);
		parent.setExpectedWidgetCount(1);

		const w1 = {
			params: () => ({ id: 'w1', type: 'count', field: 'tag' }),
			update: vi.fn(),
			init: vi.fn(),
			error: vi.fn(),
		};

		parent.register(w1);

		await vi.waitFor(() => {
			expect(w1.update).toHaveBeenCalled();
		});
		httpGet.mockClear();

		// Switch back to w1 — already fetched, no new request
		parent.refresh(['w1']);
		expect(httpGet).not.toHaveBeenCalled();
	});

	it('calls widget error on per-widget failure', async () => {
		let callCount = 0;
		const httpGet = vi.fn().mockImplementation(() => {
			callCount++;
			if (callCount <= 1) return Promise.resolve({ data: { total: 5 } }); // facetless
			if (callCount === 2) return Promise.resolve({ data: { total: 5, w1: [{ label: 'a', count: 1 }] } });
			return Promise.reject(new Error('fail'));
		});
		const { parent } = createTestComponent('bucket1', httpGet);
		parent.setExpectedWidgetCount(2);

		const w1 = {
			params: () => ({ id: 'w1', type: 'count', field: 'tag' }),
			update: vi.fn(),
			init: vi.fn(),
			error: vi.fn(),
		};
		const w2 = {
			params: () => ({ id: 'w2', type: 'timeline', field: 'timestamp' }),
			update: vi.fn(),
			init: vi.fn(),
			error: vi.fn(),
		};

		parent.register(w1);
		parent.register(w2);

		await vi.waitFor(() => {
			expect(w1.update).toHaveBeenCalled();
			expect(w2.error).toHaveBeenCalled();
		});
		expect(parent.total.value).toBe(5);
	});

	it('sets total to -1 when facetless request fails', async () => {
		const httpGet = vi.fn().mockRejectedValue(new Error('fail'));
		const { parent } = createTestComponent('bucket1', httpGet);
		parent.setExpectedWidgetCount(1);

		const w1 = {
			params: () => ({ id: 'w1', type: 'count', field: 'tag' }),
			update: vi.fn(),
			init: vi.fn(),
			error: vi.fn(),
		};

		parent.register(w1);

		await vi.waitFor(() => {
			expect(parent.total.value).toBe(-1);
		});
		expect(w1.update).not.toHaveBeenCalled();
	});

	it('adds a constraint and notifies location', () => {
		const { parent, locationChanges } = createTestComponent('bucket1', mockHttpGet);

		parent.addConstraint('tag', 'sleep');
		expect(parent.constraints.value).toHaveLength(1);
		expect(parent.constraints.value[0].field).toBe('tag');
		expect(parent.constraints.value[0].value).toBe('sleep');
		expect(locationChanges).toHaveLength(1);
		expect(locationChanges[0]['q']).toEqual(['tag:sleep']);
	});

	it('does not add duplicate constraint', () => {
		const { parent } = createTestComponent('bucket1', mockHttpGet);

		parent.addConstraint('tag', 'sleep');
		parent.addConstraint('tag', 'sleep');
		expect(parent.constraints.value).toHaveLength(1);
	});

	it('replaces constraint on same field when replace=true', () => {
		const { parent } = createTestComponent('bucket1', mockHttpGet);

		parent.addConstraint('tag', 'sleep');
		parent.addConstraint('tag', 'nap', true);
		expect(parent.constraints.value).toHaveLength(1);
		expect(parent.constraints.value[0].value).toBe('nap');
	});

	it('removes a constraint', () => {
		const { parent, locationChanges } = createTestComponent('bucket1', mockHttpGet);

		parent.addConstraint('tag', 'sleep');
		const constraint = parent.constraints.value[0];
		parent.removeConstraint(constraint);
		expect(parent.constraints.value).toHaveLength(0);
		expect(locationChanges[locationChanges.length - 1]['q']).toBeNull();
	});

	it('inverts a constraint', () => {
		const { parent } = createTestComponent('bucket1', mockHttpGet);

		parent.addConstraint('tag', 'sleep');
		const constraint = parent.constraints.value[0];
		parent.invertConstraint(constraint);
		expect(parent.constraints.value[0].negated).toBe(true);
	});

	it('gets constraints by field', () => {
		const { parent } = createTestComponent('bucket1', mockHttpGet);

		parent.addConstraint('tag', 'sleep');
		parent.addConstraint('note', 'good');
		expect(parent.getConstraints('tag')).toHaveLength(1);
		expect(parent.getConstraints('note')).toHaveLength(1);
		expect(parent.getConstraints('other')).toHaveLength(0);
	});

	it('adds multiple constraints at once', () => {
		const { parent } = createTestComponent('bucket1', mockHttpGet);

		parent.addConstraints([new Constraint('tag', 'sleep'), new Constraint('tag', 'nap')]);
		expect(parent.constraints.value).toHaveLength(2);
	});

	it('handles subfield in constraint field', () => {
		const { parent } = createTestComponent('bucket1', mockHttpGet);

		parent.addConstraint('timestamp$day', 'Monday');
		expect(parent.constraints.value[0].field).toBe('timestamp');
		expect(parent.constraints.value[0].subfield).toBe('day');
	});
});
