import { describe, expect, it } from 'vitest';
import RatingsWidget from '../RatingsWidget.vue';
import { feedData, mountWidget } from './helpers';

describe('RatingsWidget', () => {
	const settings = { id: 'w1' };

	it('shows loading state initially', () => {
		const { wrapper } = mountWidget(RatingsWidget, settings);
		expect(wrapper.find('.loading-state').text()).toContain('Loading');
	});

	it('renders ratings after update', async () => {
		const { wrapper, dashboard } = mountWidget(RatingsWidget, settings);
		await feedData(dashboard, 'w1', [
			{ from: 80, to: 100, count: 15 },
			{ from: 60, to: 80, count: 8 },
		]);

		expect(wrapper.find('table').isVisible()).toBe(true);
		expect(wrapper.text()).toContain('15');
		expect(wrapper.text()).toContain('8');
	});

	it('renders correct star icons for rating', async () => {
		const { wrapper, dashboard } = mountWidget(RatingsWidget, settings);
		await feedData(dashboard, 'w1', [{ from: 80, to: 100, count: 5 }]);

		const row = wrapper.find('tbody tr');
		const icons = row.findAll('.v-icon');
		// toStars(80) = 4 filled stars, 1 outline
		const filled = icons.filter((i) => i.classes().includes('mdi-star'));
		expect(icons).toHaveLength(5);
		expect(filled).toHaveLength(4);
	});

	it('calls addConstraint when clicking a rating', async () => {
		const { wrapper, dashboard } = mountWidget(RatingsWidget, settings);
		await feedData(dashboard, 'w1', [{ from: 80, to: 100, count: 5 }]);

		await wrapper.find('a').trigger('click');
		expect(dashboard.addConstraint).toHaveBeenCalledWith('rating', '[80%..100%)');
	});

	it('handles null bounds in constraint', async () => {
		const { wrapper, dashboard } = mountWidget(RatingsWidget, settings);
		await feedData(dashboard, 'w1', [{ from: null, to: 20, count: 2 }]);

		await wrapper.find('a').trigger('click');
		expect(dashboard.addConstraint).toHaveBeenCalledWith('rating', '[*..20%)');
	});

	it('shows "None" for empty data', async () => {
		const { wrapper, dashboard } = mountWidget(RatingsWidget, settings);
		await feedData(dashboard, 'w1', []);

		expect(wrapper.text()).toContain('No data');
	});

	it('matches snapshot', async () => {
		const { wrapper, dashboard } = mountWidget(RatingsWidget, settings);
		await feedData(dashboard, 'w1', [
			{ from: 80, to: 100, count: 15 },
			{ from: 60, to: 80, count: 8 },
			{ from: 0, to: 20, count: 2 },
		]);

		expect(wrapper.html()).toMatchSnapshot();
	});
});
