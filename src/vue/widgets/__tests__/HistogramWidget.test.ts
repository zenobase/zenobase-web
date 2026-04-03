import { flushPromises } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import HistogramWidget from '../HistogramWidget.vue';
import { createEChartsStub, feedData, mountWidget } from './helpers';

describe('HistogramWidget', () => {
	const settings = { id: 'w1', field: 'duration', interval: 60 };

	function mountWithStub(settingsOverride?: Record<string, unknown>) {
		const { Stub, capturedOptions } = createEChartsStub();
		const result = mountWidget(HistogramWidget, settingsOverride ?? settings, {
			stubs: { EChartsChart: Stub },
		});
		return { ...result, capturedOptions };
	}

	it('mounts and registers with dashboard', () => {
		const { dashboard } = mountWithStub();
		expect(dashboard.register).toHaveBeenCalledOnce();
	});

	it('shows loading state initially', () => {
		const { wrapper } = mountWithStub();
		expect(wrapper.find('.none').text()).toBe('Loading...');
	});

	it('builds chart options with correct series data', async () => {
		const { registration, capturedOptions } = mountWithStub();
		await feedData(registration, 'w1', [
			{ from: 0, to: 60, count: 5 },
			{ from: 60, to: 120, count: 12 },
			{ from: 120, to: 180, count: 3 },
		]);
		await flushPromises();

		expect(capturedOptions.value).not.toBeNull();
		const series = (capturedOptions.value as Record<string, unknown>).series as Array<{ data: number[] }>;
		expect(series[0].data).toEqual([5, 12, 3]);
	});

	it('builds chart options with correct category labels', async () => {
		const { registration, capturedOptions } = mountWithStub();
		await feedData(registration, 'w1', [
			{ from: 0, to: 60, count: 5 },
			{ from: 60, to: 120, count: 12 },
		]);
		await flushPromises();

		const yAxis = (capturedOptions.value as Record<string, unknown>).yAxis as { data: string[] };
		// duration field values get formatted via compactDuration
		expect(yAxis.data).toEqual(['0..60ms', '60ms..120ms']);
	});

	it('formats duration fields', async () => {
		const { registration, capturedOptions } = mountWithStub({
			...settings,
			field: 'duration.minutes',
		});
		await feedData(registration, 'w1', [{ from: 60000, to: 120000, count: 5 }]);
		await flushPromises();

		const yAxis = (capturedOptions.value as Record<string, unknown>).yAxis as { data: string[] };
		// duration values should be formatted as compact durations
		expect(yAxis.data[0]).toContain('..');
	});

	it('shows "None" for empty data', async () => {
		const { wrapper, registration } = mountWithStub();
		await feedData(registration, 'w1', []);

		expect(wrapper.text()).toContain('None');
	});

	it('matches snapshot', async () => {
		const { registration, capturedOptions } = mountWithStub();
		await feedData(registration, 'w1', [
			{ from: 0, to: 60, count: 5 },
			{ from: 60, to: 120, count: 12 },
			{ from: 120, to: 180, count: 3 },
		]);
		await flushPromises();

		expect(capturedOptions.value).toMatchSnapshot();
	});
});
