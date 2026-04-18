import { describe, expect, it, vi } from 'vitest';
import ScoreboardWidget from '../ScoreboardWidget.vue';
import { feedData, mountWidget } from './helpers';

vi.mock('../../utils/userNames', () => ({
	resolveUserNames: vi.fn().mockResolvedValue(undefined),
	getUserName: (id: string) => id,
}));

describe('ScoreboardWidget', () => {
	const settings = {
		id: 'w1',
		key_field: 'tag',
		value_field: 'duration',
		limit: 10,
		statistics: ['count', 'sum', 'avg'],
	};

	it('shows loading state initially', () => {
		const { wrapper } = mountWidget(ScoreboardWidget, settings);
		expect(wrapper.find('.none').text()).toBe('Loading...');
	});

	it('renders only selected statistic columns', async () => {
		const { wrapper, dashboard } = mountWidget(ScoreboardWidget, settings);
		await feedData(dashboard, 'w1', [{ label: 'sleep', count: 30, min: 5, max: 100, sum: 14400, avg: 480 }]);

		const headers = wrapper.findAll('th').map((th) => th.text());
		expect(headers).toContain('Count');
		expect(headers).toContain('Sum');
		expect(headers).toContain('Avg');
		expect(headers).not.toContain('Min');
		expect(headers).not.toContain('Max');
	});

	it('renders different statistics when configured', async () => {
		const { wrapper, dashboard } = mountWidget(ScoreboardWidget, {
			...settings,
			statistics: ['count', 'min', 'max'],
		});
		await feedData(dashboard, 'w1', [{ label: 'sleep', count: 30, min: 5, max: 100, sum: 14400, avg: 480 }]);

		const headers = wrapper.findAll('th').map((th) => th.text());
		expect(headers).toContain('Min');
		expect(headers).toContain('Max');
		expect(headers).not.toContain('Sum');
		expect(headers).not.toContain('Avg');
	});

	it('formats numbers correctly', async () => {
		const { wrapper, dashboard } = mountWidget(ScoreboardWidget, settings);
		await feedData(dashboard, 'w1', [{ label: 'sleep', count: 1000, sum: { '@value': 480, unit: 'min' }, avg: 1.5 }]);

		const text = wrapper.text();
		expect(text).toContain('1,000'); // integer with locale formatting
		expect(text).toContain('480 min'); // value with unit
		expect(text).toContain('1.5'); // decimal
	});

	it('calls addConstraint when clicking a term', async () => {
		const { wrapper, dashboard } = mountWidget(ScoreboardWidget, settings);
		await feedData(dashboard, 'w1', [{ label: 'sleep', count: 30, sum: 14400, avg: 480 }]);

		await wrapper.find('a').trigger('click');
		expect(dashboard.addConstraint).toHaveBeenCalledWith('tag', 'sleep');
	});

	it('shows "None" for empty data', async () => {
		const { wrapper, dashboard } = mountWidget(ScoreboardWidget, settings);
		await feedData(dashboard, 'w1', []);

		expect(wrapper.text()).toContain('None');
	});

	it('matches snapshot', async () => {
		const { wrapper, dashboard } = mountWidget(ScoreboardWidget, settings);
		await feedData(dashboard, 'w1', [
			{ label: 'sleep', count: 30, sum: 14400, avg: 480 },
			{ label: 'exercise', count: 15, sum: 900, avg: 60 },
		]);

		expect(wrapper.html()).toMatchSnapshot();
	});
});
