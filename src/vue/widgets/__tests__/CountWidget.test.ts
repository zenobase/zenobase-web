import { mount } from '@vue/test-utils';
import { describe, expect, it, vi } from 'vitest';
import { createVuetify } from 'vuetify';
import { type DashboardApi, dashboardKey } from '../../composables/useDashboard';
import CountWidget from '../CountWidget.vue';

const vuetify = createVuetify();

function createMockDashboard(searchResult: Record<string, unknown> = {}): DashboardApi {
	return {
		constraints: { value: [] } as unknown as DashboardApi['constraints'],
		constraintsB: { value: [] } as unknown as DashboardApi['constraintsB'],
		total: { value: 0 } as unknown as DashboardApi['total'],
		totalB: { value: null } as unknown as DashboardApi['totalB'],
		search: vi.fn().mockResolvedValue(searchResult),
		register: vi.fn(),
		refresh: vi.fn(),
		addConstraint: vi.fn(),
		addConstraints: vi.fn(),
		removeConstraint: vi.fn(),
		removeConstraintB: vi.fn(),
		invertConstraint: vi.fn(),
		invertConstraintB: vi.fn(),
		getConstraints: vi.fn().mockReturnValue([]),
		getConstraintsB: vi.fn().mockReturnValue([]),
		addConstraintB: vi.fn(),
		swapAB: vi.fn(),
		reduceExpectedWidgetCount: vi.fn(),
	};
}

describe('CountWidget', () => {
	const settings = { id: 'w1', field: 'tag', limit: 10, order: 'count' };

	it('mounts and registers with dashboard', () => {
		const dashboard = createMockDashboard();
		mount(CountWidget, {
			props: { settings },
			global: { plugins: [vuetify], provide: { [dashboardKey as symbol]: dashboard } },
		});
		expect(dashboard.register).toHaveBeenCalledOnce();
	});

	it('shows loading state initially', () => {
		const dashboard = createMockDashboard();
		const wrapper = mount(CountWidget, {
			props: { settings },
			global: { plugins: [vuetify], provide: { [dashboardKey as symbol]: dashboard } },
		});
		expect(wrapper.find('.none').text()).toBe('Loading...');
	});

	it('renders terms after update', async () => {
		const dashboard = createMockDashboard();
		const wrapper = mount(CountWidget, {
			props: { settings },
			global: { plugins: [vuetify], provide: { [dashboardKey as symbol]: dashboard } },
		});

		const registration = (dashboard.register as ReturnType<typeof vi.fn>).mock.calls[0][0];
		registration.update({ w1: [{ label: 'sleep', count: 42 }] });
		await wrapper.vm.$nextTick();

		expect(wrapper.find('table').isVisible()).toBe(true);
		expect(wrapper.text()).toContain('sleep');
		expect(wrapper.text()).toContain('42');
	});

	it('calls addConstraint when clicking a term', async () => {
		const dashboard = createMockDashboard();
		const wrapper = mount(CountWidget, {
			props: { settings },
			global: { plugins: [vuetify], provide: { [dashboardKey as symbol]: dashboard } },
		});

		const registration = (dashboard.register as ReturnType<typeof vi.fn>).mock.calls[0][0];
		registration.update({ w1: [{ label: 'sleep', count: 42 }] });
		await wrapper.vm.$nextTick();

		await wrapper.find('a').trigger('click');
		expect(dashboard.addConstraint).toHaveBeenCalledWith('tag', 'sleep');
	});

	it('shows "None" when terms is empty array', async () => {
		const dashboard = createMockDashboard();
		const wrapper = mount(CountWidget, {
			props: { settings },
			global: { plugins: [vuetify], provide: { [dashboardKey as symbol]: dashboard } },
		});

		const registration = (dashboard.register as ReturnType<typeof vi.fn>).mock.calls[0][0];
		registration.update({ w1: [] });
		await wrapper.vm.$nextTick();

		expect(wrapper.text()).toContain('None');
	});

	it('detects more pages when result exceeds limit', async () => {
		const dashboard = createMockDashboard();
		const wrapper = mount(CountWidget, {
			props: { settings: { ...settings, limit: 2 } },
			global: { plugins: [vuetify], provide: { [dashboardKey as symbol]: dashboard } },
		});

		const registration = (dashboard.register as ReturnType<typeof vi.fn>).mock.calls[0][0];
		registration.update({
			w1: [
				{ label: 'a', count: 3 },
				{ label: 'b', count: 2 },
				{ label: 'c', count: 1 },
			],
		});
		await wrapper.vm.$nextTick();

		// Should only show 2 items (the limit)
		expect(wrapper.findAll('tbody tr')).toHaveLength(2);
		// Next button should be enabled
		const nextBtn = wrapper.find('button[title="Next"]');
		expect(nextBtn.attributes('disabled')).toBeUndefined();
	});
});
