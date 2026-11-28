import { flushPromises } from '@vue/test-utils';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { defineComponent, onMounted } from 'vue';
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

	describe('filters', () => {
		afterEach(() => {
			vi.useRealTimers();
		});

		type Filters = Record<string, (n?: number) => void>;

		function filterValues(now: string, apply: (filters: Filters) => void) {
			vi.useFakeTimers({ now: new Date(now), toFake: ['Date'] });
			const { wrapper, dashboard } = mountWithStub();
			apply((wrapper.vm as unknown as { filters: Filters }).filters);
			return (dashboard.addConstraint as ReturnType<typeof vi.fn>).mock.calls.map(([field, value, replace]) => {
				expect([field, replace]).toEqual(['timestamp', true]);
				return value;
			});
		}

		it('filters by calendar periods relative to today', () => {
			const values = filterValues('2026-01-15T10:00:00', (f) => {
				f.thisYear();
				f.lastYear();
				f.thisMonth();
				f.lastMonth();
				f.lastMonths(3);
				f.thisWeek();
				f.lastWeek();
				f.today();
				f.yesterday();
				f.lastHours(24);
			});

			expect(values).toEqual(['2026', '2025', '2026-01', '2025-12', '[2025-10..2026-01)', '2026-W03', '2026-W02', '2026-01-15', '2026-01-14', '[-24h..*)']);
		});

		it('filters by the previous month at the end of a long month', () => {
			const values = filterValues('2026-05-31T10:00:00', (f) => {
				f.lastMonth();
				f.lastMonths(3);
			});

			expect(values).toEqual(['2026-04', '[2026-02..2026-05)']);
		});

		it.each([
			[0, [10, 8, 12], '[2024-01..2024-03]'],
			[0, [10, 0, 12], '2024-01 OR 2024-03'],
			[-1, [10, 8, 12], '[2024-01..2024-02]'],
			[1, [10, 8, 0], '[2024-02..2024-03]'],
			[0, [10, 8, 0], '[2024-01..2024-03)'],
		])('selects the periods offset by %d with counts %j', async (offset, counts, expected) => {
			const { wrapper, dashboard } = mountWithStub();
			await feedData(
				dashboard,
				'w1',
				mockData.map((d, i) => ({ ...d, count: counts[i] })),
			);

			(wrapper.vm as unknown as { filters: Filters }).filters.select(offset);

			expect(dashboard.addConstraint).toHaveBeenCalledWith('timestamp', expected, true);
		});
	});

	it('filters by the clicked and brushed periods', async () => {
		const handlers: Record<string, (params?: unknown) => void> = {};
		const instance = { on: (event: string, fn: (params?: unknown) => void) => (handlers[event] = fn), dispatchAction: vi.fn() };
		const Stub = defineComponent({
			emits: ['ready'],
			setup(_, { emit }) {
				onMounted(() => emit('ready', instance));
			},
			template: '<div />',
		});
		const { dashboard } = mountWidget(TimelineWidget, settings, { stubs: { EChartsChart: Stub } });
		await feedData(dashboard, 'w1', mockData);

		handlers['click']?.({ value: [mockData[1].time, 8] });
		handlers['brushSelected']?.({ batch: [{ areas: [{ coordRange: [mockData[0].time, mockData[1].time + 1] }] }] });
		handlers['brushEnd']?.();
		handlers['brushSelected']?.({ batch: [] });
		handlers['brushEnd']?.();

		expect((dashboard.addConstraint as ReturnType<typeof vi.fn>).mock.calls).toEqual([
			['timestamp', '2024-02', true],
			['timestamp', '[2024-01..2024-02]', true],
		]);
		expect(instance.dispatchAction).toHaveBeenCalledWith(expect.objectContaining({ type: 'takeGlobalCursor', key: 'brush' }));
	});
});
