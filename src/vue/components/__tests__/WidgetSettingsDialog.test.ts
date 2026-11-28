import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import { computed, defineComponent, h, inject, nextTick } from 'vue';
import type { WidgetSettings } from '../../../types';
import { vuetify } from '../../__tests__/mount';
import { type SettingsDialogContext, settingsDialogKey } from '../../composables/useSettingsDialog';
import WidgetSettingsDialog from '../WidgetSettingsDialog.vue';

/** A settings form that defaults the interval, strips an empty filter before saving, and requires a label. */
const SettingsForm = defineComponent({
	setup() {
		const { draft, onInit, onBeforeSave, setCanSubmit } = inject<SettingsDialogContext>(settingsDialogKey)!;
		onInit((d) => {
			d.interval ??= 'month';
		});
		onBeforeSave((s) => {
			if (!s.filter) delete s.filter;
		});
		setCanSubmit(computed(() => !!draft.value.label));
		return () => h('input', { class: 'label', value: draft.value.label, onInput: (e: Event) => (draft.value.label = (e.target as HTMLInputElement).value) });
	},
});

async function open(settings: WidgetSettings, isNew = false) {
	const wrapper = mount(WidgetSettingsDialog, {
		attachTo: document.body,
		props: { modelValue: true, settings, title: 'Timeline', isNew },
		slots: { default: SettingsForm },
		global: { plugins: [vuetify] },
	});
	await nextTick();
	await nextTick();
	return wrapper;
}

function button(label: string) {
	return [...document.querySelectorAll<HTMLButtonElement>('.v-card-actions button')].find((b) => b.textContent?.trim() === label)!;
}

async function setLabel(label: string) {
	const input = document.querySelector<HTMLInputElement>('input.label')!;
	input.value = label;
	input.dispatchEvent(new Event('input'));
	await nextTick();
}

describe('WidgetSettingsDialog', () => {
	it('saves a copy of the edited settings after the form adjusts them', async () => {
		const settings: WidgetSettings = { id: 'w1', type: 'timeline', label: 'Steps', filter: '' };
		const wrapper = await open(settings);
		expect(button('Save').disabled).toBe(true);

		await setLabel('Daily steps');
		expect(button('Save').disabled).toBe(false);
		button('Save').closest('form')!.requestSubmit();

		expect(wrapper.emitted('save')).toEqual([[{ id: 'w1', type: 'timeline', label: 'Daily steps', interval: 'month' }]]);
		expect(wrapper.emitted('update:modelValue')).toEqual([[false]]);
		expect(settings.label).toBe('Steps');
	});

	it('allows saving a new widget unchanged, unless the form blocks it', async () => {
		await open({ id: 'w1', type: 'timeline', label: 'Steps' }, true);
		expect(button('Save').disabled).toBe(false);

		await setLabel('');
		expect(button('Save').disabled).toBe(true);
	});

	it('emits remove', async () => {
		const wrapper = await open({ id: 'w1', type: 'timeline' });

		button('Remove').click();

		expect(wrapper.emitted('remove')).toHaveLength(1);
		expect(wrapper.emitted('update:modelValue')).toEqual([[false]]);
	});
});
