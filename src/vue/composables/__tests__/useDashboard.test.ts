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
	it('refresh does facetless request and increments generation', async () => {
		const httpGet = vi.fn().mockResolvedValue({ data: { total: 42 } });
		const { parent } = createTestComponent('bucket1', httpGet);

		parent.refresh();

		await vi.waitFor(() => {
			expect(httpGet).toHaveBeenCalledTimes(1);
			expect(parent.total.value).toBe(42);
			expect(parent.generation.value).toBe(1);
		});
	});

	it('sets total to -1 when facetless request fails', async () => {
		const httpGet = vi.fn().mockRejectedValue(new Error('fail'));
		const { parent } = createTestComponent('bucket1', httpGet);

		parent.refresh();

		await vi.waitFor(() => {
			expect(parent.total.value).toBe(-1);
			expect(parent.generation.value).toBe(0);
		});
	});

	it('fetches B totals when constraintsB is set', async () => {
		const httpGet = vi.fn().mockResolvedValue({ data: { total: 10 } });
		const { parent, setLocationParams } = createTestComponent('bucket1', httpGet);

		setLocationParams({ q: 'tag:sleep', r: 'tag:nap' });
		parent.refresh();

		await vi.waitFor(() => {
			expect(httpGet).toHaveBeenCalledTimes(2);
			expect(parent.total.value).toBe(10);
			expect(parent.totalB.value).toBe(10);
		});
	});

	it('discards stale facetless response on rapid refresh', async () => {
		let callCount = 0;
		const httpGet = vi.fn().mockImplementation(() => {
			callCount++;
			if (callCount === 1) {
				return new Promise((resolve) => setTimeout(() => resolve({ data: { total: 1 } }), 100));
			}
			return Promise.resolve({ data: { total: 2 } });
		});
		const { parent } = createTestComponent('bucket1', httpGet);

		parent.refresh();
		parent.refresh();

		await vi.waitFor(() => {
			expect(parent.total.value).toBe(2);
			expect(parent.generation.value).toBe(1);
		});
	});

	it('adds a constraint and notifies location', () => {
		const httpGet = vi.fn().mockResolvedValue({ data: { total: 42 } });
		const { parent, locationChanges } = createTestComponent('bucket1', httpGet);

		parent.addConstraint('tag', 'sleep');
		expect(parent.constraints.value).toHaveLength(1);
		expect(parent.constraints.value[0].field).toBe('tag');
		expect(parent.constraints.value[0].value).toBe('sleep');
		expect(locationChanges).toHaveLength(1);
		expect(locationChanges[0]['q']).toEqual(['tag:sleep']);
	});

	it('does not add duplicate constraint', () => {
		const httpGet = vi.fn().mockResolvedValue({ data: { total: 42 } });
		const { parent } = createTestComponent('bucket1', httpGet);

		parent.addConstraint('tag', 'sleep');
		parent.addConstraint('tag', 'sleep');
		expect(parent.constraints.value).toHaveLength(1);
	});

	it('replaces constraint on same field when replace=true', () => {
		const httpGet = vi.fn().mockResolvedValue({ data: { total: 42 } });
		const { parent } = createTestComponent('bucket1', httpGet);

		parent.addConstraint('tag', 'sleep');
		parent.addConstraint('tag', 'nap', true);
		expect(parent.constraints.value).toHaveLength(1);
		expect(parent.constraints.value[0].value).toBe('nap');
	});

	it('removes a constraint', () => {
		const httpGet = vi.fn().mockResolvedValue({ data: { total: 42 } });
		const { parent, locationChanges } = createTestComponent('bucket1', httpGet);

		parent.addConstraint('tag', 'sleep');
		const constraint = parent.constraints.value[0];
		parent.removeConstraint(constraint);
		expect(parent.constraints.value).toHaveLength(0);
		expect(locationChanges[locationChanges.length - 1]['q']).toBeNull();
	});

	it('inverts a constraint', () => {
		const httpGet = vi.fn().mockResolvedValue({ data: { total: 42 } });
		const { parent } = createTestComponent('bucket1', httpGet);

		parent.addConstraint('tag', 'sleep');
		const constraint = parent.constraints.value[0];
		parent.invertConstraint(constraint);
		expect(parent.constraints.value[0].negated).toBe(true);
	});

	it('gets constraints by field', () => {
		const httpGet = vi.fn().mockResolvedValue({ data: { total: 42 } });
		const { parent } = createTestComponent('bucket1', httpGet);

		parent.addConstraint('tag', 'sleep');
		parent.addConstraint('note', 'good');
		expect(parent.getConstraints('tag')).toHaveLength(1);
		expect(parent.getConstraints('note')).toHaveLength(1);
		expect(parent.getConstraints('other')).toHaveLength(0);
	});

	it('adds multiple constraints at once', () => {
		const httpGet = vi.fn().mockResolvedValue({ data: { total: 42 } });
		const { parent } = createTestComponent('bucket1', httpGet);

		parent.addConstraints([new Constraint('tag', 'sleep'), new Constraint('tag', 'nap')]);
		expect(parent.constraints.value).toHaveLength(2);
	});

	it('handles subfield in constraint field', () => {
		const httpGet = vi.fn().mockResolvedValue({ data: { total: 42 } });
		const { parent } = createTestComponent('bucket1', httpGet);

		parent.addConstraint('timestamp$day', 'Monday');
		expect(parent.constraints.value[0].field).toBe('timestamp');
		expect(parent.constraints.value[0].subfield).toBe('day');
	});
});
