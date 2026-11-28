import { describe, expect, it } from 'vitest';
import { ref } from 'vue';
import type { WidgetSettings } from '../../../types';
import { useWidgetSettings } from '../useWidgetSettings';

function setup(settings: Partial<WidgetSettings> = {}) {
	const draft = ref({ id: 'w1', type: 'timeline', ...settings } as WidgetSettings);
	return { draft, ...useWidgetSettings(draft) };
}

describe('useWidgetSettings', () => {
	it('lists units and statistics for the selected field', () => {
		const { draft, currentUnits, statisticsFor } = setup({ field: 'weight' });
		expect(currentUnits.value).toContain('kg');
		expect(statisticsFor('weight')).toEqual(['sum', 'avg', 'min', 'max']);
		expect(statisticsFor('timestamp')).toEqual(['count']);
		expect(statisticsFor(undefined)).toEqual(['count']);
		draft.value.field = undefined;
		expect(currentUnits.value).toEqual([]);
	});

	it('toggles statistics on and off', () => {
		const { draft, toggleStatistic, isStatisticSelected } = setup();
		toggleStatistic('avg');
		toggleStatistic('max');
		expect(isStatisticSelected('avg')).toBe(true);
		toggleStatistic('avg');
		expect(draft.value.statistics).toEqual(['max']);
	});

	it('validates each part of a filter', () => {
		const { draft, filterValid, filterRule } = setup({ filter: 'tag:run|weight:>70' });
		expect(filterValid.value).toBe(true);
		draft.value.filter = 'tag:run|:';
		expect(filterValid.value).toBe(false);
		expect(filterRule(':')).toBe('Invalid filter');
		draft.value.filter = '';
		expect(filterValid.value).toBeNull();
	});

	it.each([
		[1, true],
		[100, true],
		[0, 'Must be 1–100'],
		[1.5, 'Must be 1–100'],
	])('limitRule(%d)', (limit, expected) => {
		expect(setup().limitRule(limit)).toBe(expected);
	});

	it('splits the order into a field and a direction', () => {
		const { draft, orderField, isAsc } = setup({ order: '-count' });
		expect(orderField.value).toBe('count');
		expect(isAsc.value).toBe(false);
		isAsc.value = true;
		expect(draft.value.order).toBe('count');
		orderField.value = 'sum';
		expect(draft.value.order).toBe('sum');
		isAsc.value = false;
		orderField.value = 'max';
		expect(draft.value.order).toBe('-max');
	});

	it('defaults to ascending with no order', () => {
		const { orderField, isAsc } = setup();
		expect(orderField.value).toBe('');
		expect(isAsc.value).toBe(true);
	});
});
