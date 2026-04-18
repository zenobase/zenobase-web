import { flushPromises } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import { Constraint } from '../../../utils/constraint';
import ScatterPlotWidget from '../ScatterPlotWidget.vue';
import { createEChartsStub, feedData, mountWidget } from './helpers';

describe('ScatterPlotWidget', () => {
	const settings = { id: 'w1', field_x: 'duration', field_y: 'rating' };

	const mockData = [
		[60, 80],
		[120, 90],
		[45, 70],
		[90, 85],
	];

	function mountWithStub(settingsOverride?: Record<string, unknown>) {
		const { Stub, capturedOptions, allCapturedOptions } = createEChartsStub();
		const result = mountWidget(ScatterPlotWidget, settingsOverride ?? settings, {
			stubs: { EChartsChart: Stub },
		});
		return { ...result, capturedOptions, allCapturedOptions };
	}

	it('shows loading state initially', () => {
		const { wrapper } = mountWithStub();
		expect(wrapper.find('.loading-state').text()).toContain('Loading');
	});

	it('builds scatter chart with correct data', async () => {
		const { dashboard, allCapturedOptions } = mountWithStub();
		await feedData(dashboard, 'w1', mockData);
		await flushPromises();

		const mainChart = allCapturedOptions[0];
		const series = mainChart.series as Array<{ type: string; data: number[][] }>;
		expect(series[0].type).toBe('scatter');
		expect(series[0].data).toEqual(mockData);
	});

	it('adds second scatter series for A/B comparison', async () => {
		const { dashboard, allCapturedOptions } = mountWithStub();
		dashboard.constraintsB.value = [new Constraint('tag', 'x')];
		const dataB = [
			[30, 60],
			[80, 75],
			[50, 65],
			[70, 88],
		];
		await feedData(dashboard, 'w1', mockData, dataB);
		await flushPromises();

		const mainChart = allCapturedOptions[0];
		const series = mainChart.series as Array<{ type: string }>;
		const scatterSeries = series.filter((s) => s.type === 'scatter');
		expect(scatterSeries).toHaveLength(2);
	});

	it('adds regression line when configured', async () => {
		const { dashboard, allCapturedOptions } = mountWithStub({ ...settings, regression: 'linear' });
		await feedData(dashboard, 'w1', mockData);
		await flushPromises();

		const mainChart = allCapturedOptions[0];
		const series = mainChart.series as Array<{ type: string; lineStyle?: { type: string } }>;
		const regressionLine = series.find((s) => s.lineStyle?.type === 'dotted');
		expect(regressionLine).toBeDefined();
	});

	it('generates correlation chart for > 3 data points', async () => {
		const { dashboard, allCapturedOptions } = mountWithStub();
		await feedData(dashboard, 'w1', mockData);
		await flushPromises();

		// Should have 2 charts: main scatter + correlation
		expect(allCapturedOptions.length).toBeGreaterThanOrEqual(2);
	});

	it('shows "None" for empty data', async () => {
		const { wrapper, dashboard } = mountWithStub();
		await feedData(dashboard, 'w1', []);

		expect(wrapper.text()).toContain('No data');
	});

	it('matches snapshot', async () => {
		const { dashboard, allCapturedOptions } = mountWithStub();
		await feedData(dashboard, 'w1', mockData);
		await flushPromises();

		expect(allCapturedOptions[0]).toMatchSnapshot();
	});
});
