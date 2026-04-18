import { flushPromises } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import { Constraint } from '../../../utils/constraint';
import PolarWidget from '../PolarWidget.vue';
import { createEChartsStub, feedData, mountWidget } from './helpers';

describe('PolarWidget', () => {
	const settings = { id: 'w1', value_field: 'duration', interval: 'hour_of_day' };

	const mockData = Array.from({ length: 24 }, (_, i) => ({
		label: `${i}h`,
		value: String(i),
		count: (i + 1) * 2,
	}));

	function mountWithStub(settingsOverride?: Record<string, unknown>) {
		const { Stub, capturedOptions } = createEChartsStub();
		const result = mountWidget(PolarWidget, settingsOverride ?? settings, {
			stubs: { EChartsChart: Stub },
		});
		return { ...result, capturedOptions };
	}

	it('shows loading state initially', () => {
		const { wrapper } = mountWithStub();
		expect(wrapper.find('.loading-state').text()).toContain('Loading');
	});

	it('builds chart with correct angle axis labels', async () => {
		const { dashboard, capturedOptions } = mountWithStub();
		await feedData(dashboard, 'w1', mockData);
		await flushPromises();

		const angleAxis = (capturedOptions.value as Record<string, unknown>).angleAxis as { data: string[] };
		expect(angleAxis.data).toHaveLength(24);
		expect(angleAxis.data[0]).toBe('0h');
		expect(angleAxis.data[23]).toBe('23h');
	});

	it('builds chart with correct series data', async () => {
		const { dashboard, capturedOptions } = mountWithStub();
		await feedData(dashboard, 'w1', mockData);
		await flushPromises();

		const series = (capturedOptions.value as Record<string, unknown>).series as Array<{ data: number[] }>;
		expect(series).toHaveLength(1);
		expect(series[0].data).toEqual(mockData.map((d) => d.count));
	});

	it('adds second series for A/B comparison', async () => {
		const { dashboard, capturedOptions } = mountWithStub();
		dashboard.constraintsB.value = [new Constraint('tag', 'x')];
		const dataBSlice = mockData.map((d) => ({ ...d, count: d.count + 5 }));
		await feedData(dashboard, 'w1', mockData, dataBSlice);
		await flushPromises();

		const series = (capturedOptions.value as Record<string, unknown>).series as Array<{ name: string }>;
		expect(series).toHaveLength(2);
		expect(series[1].name).toContain('-B');
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
