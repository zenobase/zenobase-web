import { flushPromises } from '@vue/test-utils';
import { describe, expect, it, vi } from 'vitest';
import ListWidget from '../ListWidget.vue';
import { mountWidget } from './helpers';

vi.mock('../../utils/userNames', () => ({
	resolveUserNames: vi.fn().mockResolvedValue(undefined),
	getUserName: (id: string) => id,
}));

function mockSearchWithTotal(dashboard: ReturnType<typeof mountWidget>['dashboard'], data: unknown[], total: number) {
	(dashboard.search as ReturnType<typeof vi.fn>).mockResolvedValue({ w1: data, total });
}

async function feedListData(dashboard: ReturnType<typeof mountWidget>['dashboard'], data: unknown[], total: number) {
	mockSearchWithTotal(dashboard, data, total);
	dashboard.total.value = total;
	dashboard.generation.value++;
	await flushPromises();
}

describe('ListWidget', () => {
	const settings = { id: 'w1', limit: 5 };

	it('shows loading state initially', () => {
		const { wrapper } = mountWidget(ListWidget, settings);
		expect(wrapper.find('.loading-state').text()).toContain('Loading');
	});

	it('renders events after update', async () => {
		const { wrapper, dashboard } = mountWidget(ListWidget, settings);
		await feedListData(dashboard, [{ '@id': 'e1', timestamp: '2025-06-01T12:00:00Z', tag: 'sleep' }], 1);
		await vi.dynamicImportSettled();

		expect(wrapper.find('table').isVisible()).toBe(true);
	});

	it('shows "None" for empty data', async () => {
		const { wrapper, dashboard } = mountWidget(ListWidget, settings);
		await feedListData(dashboard, [], 0);
		await vi.dynamicImportSettled();

		expect(wrapper.text()).toContain('No data');
	});

	it('shows pagination info', async () => {
		const { wrapper, dashboard } = mountWidget(ListWidget, settings);
		await feedListData(
			dashboard,
			[
				{ '@id': 'e1', tag: 'a' },
				{ '@id': 'e2', tag: 'b' },
				{ '@id': 'e3', tag: 'c' },
				{ '@id': 'e4', tag: 'd' },
				{ '@id': 'e5', tag: 'e' },
			],
			12,
		);
		await vi.dynamicImportSettled();

		expect(wrapper.text()).toContain('1');
		expect(wrapper.text()).toContain('5');
		expect(wrapper.text()).toContain('12');
	});

	it('enables Next button when more pages exist', async () => {
		const { wrapper, dashboard } = mountWidget(ListWidget, settings);
		await feedListData(
			dashboard,
			[
				{ '@id': 'e1', tag: 'a' },
				{ '@id': 'e2', tag: 'b' },
				{ '@id': 'e3', tag: 'c' },
				{ '@id': 'e4', tag: 'd' },
				{ '@id': 'e5', tag: 'e' },
			],
			12,
		);
		await vi.dynamicImportSettled();

		const nextBtn = wrapper.find('button[title="Next"]');
		expect(nextBtn.attributes('disabled')).toBeUndefined();
		const prevBtn = wrapper.find('button[title="Previous"]');
		expect(prevBtn.attributes('disabled')).toBeDefined();
	});

	it('calls dashboard.search on Next click', async () => {
		const { wrapper, dashboard } = mountWidget(ListWidget, settings);
		await feedListData(
			dashboard,
			[
				{ '@id': 'e1', tag: 'a' },
				{ '@id': 'e2', tag: 'b' },
				{ '@id': 'e3', tag: 'c' },
				{ '@id': 'e4', tag: 'd' },
				{ '@id': 'e5', tag: 'e' },
			],
			12,
		);
		await vi.dynamicImportSettled();

		(dashboard.search as ReturnType<typeof vi.fn>).mockResolvedValue({
			w1: [{ '@id': 'e6', tag: 'f' }],
			total: 12,
		});
		await wrapper.find('button[title="Next"]').trigger('click');
		expect(dashboard.search).toHaveBeenCalled();
	});

	it('matches snapshot', async () => {
		const { wrapper, dashboard } = mountWidget(ListWidget, settings);
		await feedListData(dashboard, [{ '@id': 'e1', timestamp: '2025-06-01T12:00:00Z', tag: 'sleep' }], 1);
		await vi.dynamicImportSettled();

		expect(wrapper.html()).toMatchSnapshot();
	});
});
