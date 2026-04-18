import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import GanttWidget from '../GanttWidget.vue';
import { feedData, mountWidget } from './helpers';

vi.mock('../../utils/userNames', () => ({
	resolveUserNames: vi.fn().mockResolvedValue(undefined),
	getUserName: (id: string) => id,
}));

describe('GanttWidget', () => {
	const settings = { id: 'w1', field: 'tag', limit: 10 };

	beforeEach(() => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date('2025-07-01T00:00:00Z'));
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it('shows loading state initially', () => {
		const { wrapper } = mountWidget(GanttWidget, settings);
		expect(wrapper.find('.none').text()).toBe('Loading...');
	});

	it('renders label, age, and freq', async () => {
		const { wrapper, dashboard } = mountWidget(GanttWidget, settings);
		await feedData(dashboard, 'w1', [{ label: 'exercise', first: '2025-01-01T00:00:00Z', last: '2025-06-15T00:00:00Z', count: 50 }]);

		expect(wrapper.text()).toContain('exercise');
		expect(wrapper.text()).toContain('ago'); // age formatted
	});

	it('computes freq for count > 1', async () => {
		const { wrapper, dashboard } = mountWidget(GanttWidget, settings);
		// 10 days apart, count=2 → freq = 10 days in ms
		await feedData(dashboard, 'w1', [{ label: 'test', first: '2025-06-01T00:00:00Z', last: '2025-06-11T00:00:00Z', count: 2 }]);

		// freq = (11-1) * 86400000 / (2-1) = 864000000 ms = 10 days
		expect(wrapper.text()).toContain('10d');
	});

	it('does not show freq for count = 1', async () => {
		const { wrapper, dashboard } = mountWidget(GanttWidget, settings);
		await feedData(dashboard, 'w1', [{ label: 'once', first: '2025-06-01T00:00:00Z', last: '2025-06-01T00:00:00Z', count: 1 }]);

		const freqCell = wrapper.findAll('tbody td')[2];
		expect(freqCell.text()).toBe('');
	});

	it('calls addConstraint when clicking a term', async () => {
		const { wrapper, dashboard } = mountWidget(GanttWidget, settings);
		await feedData(dashboard, 'w1', [{ label: 'exercise', first: '2025-01-01T00:00:00Z', last: '2025-06-15T00:00:00Z', count: 50 }]);

		await wrapper.find('a').trigger('click');
		expect(dashboard.addConstraint).toHaveBeenCalledWith('tag', 'exercise');
	});

	it('shows "None" for empty data', async () => {
		const { wrapper, dashboard } = mountWidget(GanttWidget, settings);
		await feedData(dashboard, 'w1', []);

		expect(wrapper.text()).toContain('None');
	});

	it('matches snapshot', async () => {
		const { wrapper, dashboard } = mountWidget(GanttWidget, settings);
		await feedData(dashboard, 'w1', [
			{ label: 'exercise', first: '2025-01-01T00:00:00Z', last: '2025-06-15T00:00:00Z', count: 50 },
			{ label: 'reading', first: '2025-06-01T00:00:00Z', last: '2025-06-01T00:00:00Z', count: 1 },
		]);

		expect(wrapper.html()).toMatchSnapshot();
	});
});
