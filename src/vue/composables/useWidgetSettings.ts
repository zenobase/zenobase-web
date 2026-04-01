import { computed, type MaybeRefOrGetter, toValue } from 'vue';
import type { WidgetSettings } from '../../types';
import { Constraint } from '../../utils/constraint';
import { getNumericAndTimestampFieldNames, getNumericFieldNames, getStatisticsForField, getUnitsForField } from '../utils/fieldRegistry';

export function useWidgetSettings(draft: MaybeRefOrGetter<WidgetSettings>) {
	const textFieldNames = computed(() => ['author', 'tag']);
	const numericFieldNames = computed(() => getNumericFieldNames());
	const numericAndTimestampFieldNames = computed(() => getNumericAndTimestampFieldNames());

	function unitsForField(fieldName: string | undefined | null): string[] {
		if (!fieldName) return [];
		return getUnitsForField(fieldName);
	}

	const currentUnits = computed(() => unitsForField(toValue(draft).field));
	const currentValueUnits = computed(() => unitsForField(toValue(draft).value_field));
	const currentUnitsX = computed(() => unitsForField(toValue(draft).field_x));
	const currentUnitsY = computed(() => unitsForField(toValue(draft).field_y));

	function statisticsFor(fieldName: string | undefined | null): string[] {
		if (!fieldName) return ['count'];
		return getStatisticsForField(fieldName);
	}

	function isStatisticSelected(stat: string): boolean {
		return toValue(draft).statistics?.includes(stat) ?? false;
	}

	function toggleStatistic(stat: string) {
		const d = toValue(draft);
		if (!d.statistics) {
			d.statistics = [];
		}
		const idx = d.statistics.indexOf(stat);
		if (idx !== -1) {
			d.statistics.splice(idx, 1);
		} else {
			d.statistics.push(stat);
		}
	}

	function isFilterValid(filter: string | undefined | null): boolean | null {
		if (!filter) return null;
		try {
			for (const part of filter.split('|')) Constraint.parse(part.trim());
			return true;
		} catch {
			return false;
		}
	}

	const filterValid = computed(() => isFilterValid(toValue(draft).filter));
	const filterXValid = computed(() => isFilterValid(toValue(draft).filter_x));
	const filterYValid = computed(() => isFilterValid(toValue(draft).filter_y));

	// --- Order helpers ---

	const orderField = computed({
		get: () => {
			const order = toValue(draft).order;
			if (!order) return '';
			return order.charAt(0) === '-' ? order.substring(1) : order;
		},
		set: (field: string) => {
			toValue(draft).order = isAsc.value ? field : '-' + field;
		},
	});

	const isAsc = computed({
		get: () => {
			const order = toValue(draft).order;
			if (!order) return true;
			return order.charAt(0) !== '-';
		},
		set: (asc: boolean) => {
			const field = orderField.value;
			toValue(draft).order = asc ? field : '-' + field;
		},
	});

	return {
		textFieldNames,
		numericFieldNames,
		numericAndTimestampFieldNames,
		unitsForField,
		currentUnits,
		currentValueUnits,
		currentUnitsX,
		currentUnitsY,
		statisticsFor,
		isStatisticSelected,
		toggleStatistic,
		isFilterValid,
		filterValid,
		filterXValid,
		filterYValid,
		orderField,
		isAsc,
	};
}
