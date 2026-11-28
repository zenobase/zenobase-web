import { describe, expect, it } from 'vitest';
import type { Bucket, WidgetSettings } from '../../../types';
import { mountDialog } from '../../__tests__/mount';
import AddWidgetDialog from '../AddWidgetDialog.vue';

interface AddWidgetVM {
	findTemplates(): Array<{ type: string }>;
}

function open(widgets: WidgetSettings[] = []) {
	const bucket: Bucket = { '@id': 'b1', roles: [], widgets };
	return mountDialog<AddWidgetVM>(AddWidgetDialog, { bucketId: 'b1', bucket, placement: 'right' });
}

describe('AddWidgetDialog', () => {
	it('emits a new widget with the template defaults and placement', async () => {
		const { wrapper } = await open();

		const card = [...document.querySelectorAll<HTMLElement>('.v-card--hover')].find((c) => c.textContent?.includes('Histogram'));
		card?.click();

		const [[settings]] = wrapper.emitted('added') as [[WidgetSettings]];
		expect(settings).toEqual({ id: expect.stringMatching(/^w[a-z0-9]+$/), type: 'histogram', label: 'Histogram', placement: 'right', field: 'distance', interval: 10, unit: 'mi' });
		expect(wrapper.emitted('update:modelValue')).toEqual([[false]]);
	});

	it('offers the list widget only once per bucket', async () => {
		const { vm } = await open([
			{ id: 'w1', type: 'list' },
			{ id: 'w2', type: 'count' },
		]);
		const types = vm.findTemplates().map((t) => t.type);

		expect(types).not.toContain('list');
		expect(types).toContain('count');
	});
});
