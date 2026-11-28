import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import { type Component, h, nextTick } from 'vue';
import type { WidgetSettings } from '../../../types';
import { vuetify } from '../../__tests__/mount';
import WidgetSettingsDialog from '../../components/WidgetSettingsDialog.vue';
import HeatmapSettingsDialog from '../HeatmapSettingsDialog.vue';
import HistogramSettingsDialog from '../HistogramSettingsDialog.vue';
import PolarSettingsDialog from '../PolarSettingsDialog.vue';
import ScatterplotSettingsDialog from '../ScatterplotSettingsDialog.vue';
import ScoreboardSettingsDialog from '../ScoreboardSettingsDialog.vue';
import TimelineSettingsDialog from '../TimelineSettingsDialog.vue';

interface DialogVM {
	draft: WidgetSettings;
	canSubmit: boolean;
	save(): void;
}

async function open(form: Component, settings: Partial<WidgetSettings>) {
	const wrapper = mount(WidgetSettingsDialog, {
		props: { modelValue: true, settings: { id: 'w1', type: 'x', ...settings } as WidgetSettings, title: 'Settings' },
		slots: { default: () => h(form) },
		global: { plugins: [vuetify] },
	});
	await nextTick();
	const vm = wrapper.vm as unknown as DialogVM;
	return {
		vm,
		form: wrapper.findComponent(form).vm as unknown as { swapAxes(): void },
		/** Updates the draft and waits for the form's watchers. */
		async edit(changes: Partial<WidgetSettings>) {
			Object.assign(vm.draft, changes);
			await nextTick();
		},
		saved: () => {
			vm.save();
			return (wrapper.emitted('save') as [[WidgetSettings]])[0][0];
		},
	};
}

describe('widget settings forms', () => {
	it('edits a duration histogram interval in hours but saves milliseconds', async () => {
		const { vm, edit, saved } = await open(HistogramSettingsDialog, { field: 'duration', interval: '7200000' });
		expect(vm.draft.interval).toBe('2');

		await edit({ interval: '0' });
		expect(vm.canSubmit).toBe(false);
		await edit({ interval: '1.5' });

		expect(saved().interval).toBe('5400000');
	});

	it('keeps a non-duration histogram interval as is', async () => {
		const { edit, saved } = await open(HistogramSettingsDialog, { field: 'distance', unit: 'mi', interval: '10' });
		await edit({ field: 'weight' });

		expect(saved()).toMatchObject({ field: 'weight', unit: 'lb', interval: '10' });
	});

	it('swaps the scatter plot axes and reverses the lag', async () => {
		const x = { label_x: 'Weight', field_x: 'weight', unit_x: 'kg', statistic_x: 'avg', filter_x: 'tag:a' };
		const y = { label_y: 'Steps', field_y: 'count', unit_y: null, statistic_y: 'sum', filter_y: 'tag:b' };
		const { form, saved } = await open(ScatterplotSettingsDialog, { ...x, ...y, lag: 2 });

		form.swapAxes();
		await nextTick();

		expect(saved()).toMatchObject({
			label_x: 'Steps',
			field_x: 'count',
			unit_x: null,
			statistic_x: 'sum',
			filter_x: 'tag:b',
			label_y: 'Weight',
			field_y: 'weight',
			unit_y: 'kg',
			statistic_y: 'avg',
			filter_y: 'tag:a',
			lag: -2,
		});
	});

	it.each([
		['timeline', TimelineSettingsDialog, { field: 'weight', unit: 'kg', statistic: 'avg' }, { field: 'timestamp' }, { unit: null, statistic: 'count', interval: 'month' }],
		['timeline', TimelineSettingsDialog, { field: 'timestamp', unit: null, statistic: 'count' }, { field: 'weight' }, { unit: 'lb', statistic: 'sum' }],
		['polar', PolarSettingsDialog, { value_field: 'timestamp', statistic: 'count' }, { value_field: 'weight' }, { unit: 'lb', statistic: 'sum' }],
		['heatmap', HeatmapSettingsDialog, { value_field: 'weight', unit: 'kg' }, { value_field: 'count' }, { unit: '' }],
		['scatter plot', ScatterplotSettingsDialog, { field_x: 'count', unit_x: null }, { field_x: 'weight' }, { unit_x: 'lb' }],
		['scoreboard', ScoreboardSettingsDialog, { value_field: 'count' }, { value_field: 'weight' }, { unit: 'lb', statistics: ['count', 'sum', 'avg'] }],
	])('updates the %s unit and statistic for a new field', async (_, form, settings, changes, expected) => {
		const { edit, saved } = await open(form, settings);

		await edit(changes);

		expect(saved()).toMatchObject(expected);
	});
});
