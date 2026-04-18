import { describe, expect, it } from 'vitest';
import CountWidget from '../CountWidget.vue';
import { feedData, mountWidget } from './helpers';

describe('CountWidget', () => {
	const settings = { id: 'w1', field: 'tag', limit: 10, order: 'count' };

	it('shows loading state initially', () => {
		const { wrapper } = mountWidget(CountWidget, settings);
		expect(wrapper.find('.none').text()).toBe('Loading...');
	});

	it('renders terms after update', async () => {
		const { wrapper, dashboard } = mountWidget(CountWidget, settings);
		await feedData(dashboard, 'w1', [{ label: 'sleep', count: 42 }]);

		expect(wrapper.find('table').isVisible()).toBe(true);
		expect(wrapper.text()).toContain('sleep');
		expect(wrapper.text()).toContain('42');
	});

	it('calls addConstraint when clicking a term', async () => {
		const { wrapper, dashboard } = mountWidget(CountWidget, settings);
		await feedData(dashboard, 'w1', [{ label: 'sleep', count: 42 }]);

		await wrapper.find('a').trigger('click');
		expect(dashboard.addConstraint).toHaveBeenCalledWith('tag', 'sleep');
	});

	it('shows "None" when terms is empty array', async () => {
		const { wrapper, dashboard } = mountWidget(CountWidget, settings);
		await feedData(dashboard, 'w1', []);

		expect(wrapper.text()).toContain('None');
	});

	it('detects more pages when result exceeds limit', async () => {
		const { wrapper, dashboard } = mountWidget(CountWidget, { ...settings, limit: 2 });
		await feedData(dashboard, 'w1', [
			{ label: 'a', count: 3 },
			{ label: 'b', count: 2 },
			{ label: 'c', count: 1 },
		]);

		expect(wrapper.findAll('tbody tr')).toHaveLength(2);
		const nextBtn = wrapper.find('button[title="Next"]');
		expect(nextBtn.attributes('disabled')).toBeUndefined();
	});
});
