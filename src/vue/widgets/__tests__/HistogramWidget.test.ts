import { flushPromises } from '@vue/test-utils';
import { describe, expect, it, vi } from 'vitest';
import { Constraint } from '../../../utils/constraint';
import HistogramWidget from '../HistogramWidget.vue';
import { createEChartsStub, feedData, mountWidget } from './helpers';

describe('HistogramWidget', () => {
	const settings = { id: 'w1', field: 'duration', interval: 60 };

	function mountWithStub(settingsOverride?: Record<string, unknown>) {
		const { Stub, ...stub } = createEChartsStub();
		const result = mountWidget(HistogramWidget, settingsOverride ?? settings, {
			stubs: { EChartsChart: Stub },
		});
		return { ...result, ...stub };
	}

	it('shows loading state initially', () => {
		const { wrapper } = mountWithStub();
		expect(wrapper.find('.loading-state').text()).toContain('Loading');
	});

	it('builds chart options with correct series data', async () => {
		const { dashboard, capturedOptions } = mountWithStub();
		await feedData(dashboard, 'w1', [
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
		const { dashboard, capturedOptions } = mountWithStub();
		await feedData(dashboard, 'w1', [
			{ from: 0, to: 60, count: 5 },
			{ from: 60, to: 120, count: 12 },
		]);
		await flushPromises();

		const yAxis = (capturedOptions.value as Record<string, unknown>).yAxis as { data: string[] };
		// duration field values get formatted via compactDuration
		expect(yAxis.data).toEqual(['0..60ms', '60ms..120ms']);
	});

	it('formats duration fields', async () => {
		const { dashboard, capturedOptions } = mountWithStub({
			...settings,
			field: 'duration.minutes',
		});
		await feedData(dashboard, 'w1', [{ from: 60000, to: 120000, count: 5 }]);
		await flushPromises();

		const yAxis = (capturedOptions.value as Record<string, unknown>).yAxis as { data: string[] };
		// duration values should be formatted as compact durations
		expect(yAxis.data[0]).toContain('..');
	});

	it('shows "None" for empty data', async () => {
		const { wrapper, dashboard } = mountWithStub();
		await feedData(dashboard, 'w1', []);

		expect(wrapper.text()).toContain('No data');
	});

	it('matches snapshot', async () => {
		const { dashboard, capturedOptions } = mountWithStub();
		await feedData(dashboard, 'w1', [
			{ from: 0, to: 60, count: 5 },
			{ from: 60, to: 120, count: 12 },
			{ from: 120, to: 180, count: 3 },
		]);
		await flushPromises();

		expect(capturedOptions.value).toMatchSnapshot();
	});

	const miles = (from: number, to: number, count: number) => ({ from: { '@value': from, unit: 'mi' }, to: { '@value': to, unit: 'mi' }, count });

	it('filters by the clicked bin', async () => {
		const { dashboard, handlers } = mountWithStub({ id: 'w1', field: 'distance', interval: 5 });
		await feedData(dashboard, 'w1', [miles(0, 5, 3), miles(5, 10, 1)]);

		handlers['click']!({ dataIndex: 1 });

		expect(dashboard.addConstraint).toHaveBeenCalledWith('distance', '[5 mi..10 mi)', true);
	});

	it('downloads A and B counts per bin, in order', async () => {
		const { wrapper, dashboard } = mountWithStub({ id: 'w1', field: 'distance', interval: 5, label: 'Run distance' });
		dashboard.constraintsB.value = [new Constraint('tag', 'x')];
		await feedData(dashboard, 'w1', [miles(5, 10, 1)], [miles(0, 5, 2), miles(5, 10, 4)]);
		const blob = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:1');
		vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
		const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

		await wrapper.find('button[title="Download"]').trigger('click');

		expect(await (blob.mock.calls[0][0] as Blob).text()).toBe('distance,count,count-B\n[0 mi..5 mi),0,2\n[5 mi..10 mi),1,4');
		expect((click.mock.contexts[0] as HTMLAnchorElement).download).toBe('Run_distance.csv');
	});
});
