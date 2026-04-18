import { flushPromises } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import { Constraint } from '../../../utils/constraint';
import TimelineWidget from '../TimelineWidget.vue';
import { createEChartsStub, feedData, mountWidget } from './helpers';

describe('TimelineWidget', () => {
	const settings = { id: 'w1', field: 'duration', interval: 'month' };

	const mockData = [
		{ time: 1704067200000, label: '2024-01', value: '2024-01', count: 10, min: 5, max: 20, sum: 100, avg: 10 },
		{ time: 1706745600000, label: '2024-02', value: '2024-02', count: 8, min: 3, max: 15, sum: 64, avg: 8 },
		{ time: 1709251200000, label: '2024-03', value: '2024-03', count: 12, min: 2, max: 25, sum: 144, avg: 12 },
	];

	function mountWithStub(settingsOverride?: Record<string, unknown>) {
		const { Stub, capturedOptions, allCapturedOptions } = createEChartsStub();
		const result = mountWidget(TimelineWidget, settingsOverride ?? settings, {
			stubs: { EChartsChart: Stub },
		});
		return { ...result, capturedOptions, allCapturedOptions };
	}

	it('shows loading state initially', () => {
		const { wrapper } = mountWithStub();
		expect(wrapper.find('.loading-state').text()).toContain('Loading');
	});

	it('uses bar chart for count statistic', async () => {
		const { dashboard, capturedOptions } = mountWithStub();
		await feedData(dashboard, 'w1', mockData);
		await flushPromises();

		const series = (capturedOptions.value as Record<string, unknown>).series as Array<{ type: string; name: string }>;
		const mainSeries = series.find((s) => s.name === 'count');
		expect(mainSeries?.type).toBe('bar');
	});

	it('uses line chart for avg statistic', async () => {
		const { dashboard, capturedOptions } = mountWithStub({ ...settings, statistic: 'avg' });
		await feedData(dashboard, 'w1', mockData);
		await flushPromises();

		const series = (capturedOptions.value as Record<string, unknown>).series as Array<{ type: string; name: string }>;
		const mainSeries = series.find((s) => s.name === 'avg');
		expect(mainSeries?.type).toBe('line');
	});

	it('includes min/max range bands for avg statistic', async () => {
		const { dashboard, capturedOptions } = mountWithStub({ ...settings, statistic: 'avg' });
		await feedData(dashboard, 'w1', mockData);
		await flushPromises();

		const series = (capturedOptions.value as Record<string, unknown>).series as Array<{ name: string }>;
		const names = series.map((s) => s.name);
		expect(names).toContain('range-lower');
		expect(names).toContain('range-upper');
	});

	it('generates two series for A/B comparison', async () => {
		const { dashboard, allCapturedOptions } = mountWithStub();
		dashboard.constraintsB.value = [new Constraint('tag', 'x')];
		const dataB = mockData.map((d) => ({ ...d, count: d.count + 5 }));
		await feedData(dashboard, 'w1', mockData, dataB);
		await flushPromises();

		// First captured options is the main chart, second is effect size
		const mainChart = allCapturedOptions[0];
		const series = mainChart.series as Array<{ name: string }>;
		const names = series.map((s) => s.name);
		expect(names).toContain('count');
		expect(names).toContain('count-B');
	});

	it('adds regression line when configured', async () => {
		const { dashboard, capturedOptions } = mountWithStub({ ...settings, regression: 'linear' });
		await feedData(dashboard, 'w1', mockData);
		await flushPromises();

		const series = (capturedOptions.value as Record<string, unknown>).series as Array<{ type: string; lineStyle?: { type: string } }>;
		const regressionSeries = series.find((s) => s.lineStyle?.type === 'dotted');
		expect(regressionSeries).toBeDefined();
	});

	it('shows "None" for empty data', async () => {
		const { wrapper, dashboard } = mountWithStub();
		await feedData(dashboard, 'w1', []);

		expect(wrapper.text()).toContain('No data');
	});

	it('matches snapshot', async () => {
		const { dashboard, capturedOptions } = mountWithStub();
		await feedData(dashboard, 'w1', mockData);
		await flushPromises();

		expect(capturedOptions.value).toMatchSnapshot();
	});
});
