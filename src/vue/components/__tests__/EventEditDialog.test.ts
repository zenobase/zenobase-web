import { mount } from '@vue/test-utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { nextTick } from 'vue';
import { createVuetify } from 'vuetify';
import * as components from 'vuetify/components';
import * as directives from 'vuetify/directives';
import type { ZenoEvent } from '../../../types';
import api from '../../api';
import { alertKey, useAlert } from '../../composables/useAlert';
import EventEditDialog from '../EventEditDialog.vue';

const vuetify = createVuetify({ components, directives });

interface DialogState {
	newField: string;
	newUnit: string;
	newNumValue: unknown;
	newMinutes: unknown;
	newSeconds: unknown;
	fieldUnits: string[];
	isValid: boolean;
	eventData: ZenoEvent;
	addEntry(): void;
}

async function mountDialog(event: ZenoEvent | null): Promise<DialogState> {
	vi.spyOn(api, 'get').mockResolvedValue({ data: {} } as never);
	const wrapper = mount(EventEditDialog, {
		props: { bucketId: 'b1', event, modelValue: false },
		global: { plugins: [vuetify], provide: { [alertKey as symbol]: useAlert() } },
	});
	await wrapper.setProps({ modelValue: true });
	return wrapper.vm as unknown as DialogState;
}

async function selectField(vm: DialogState, field: string) {
	vm.newField = field;
	await nextTick();
}

describe('EventEditDialog', () => {
	beforeEach(() => {
		vi.restoreAllMocks();
	});

	it.each([
		['velocity', 'km/h'],
		['pace', 's/mi'],
	])('offers and preselects the stored %s unit %s', async (field, unit) => {
		const vm = await mountDialog({ '@id': 'e1', [field]: { '@value': 10, unit } });
		await selectField(vm, field);
		expect(vm.fieldUnits).toContain(unit);
		expect(vm.newUnit).toBe(unit);
	});

	it.each([
		['weight', 'kg', { '@value': 70.5, unit: 'kg' }],
		['humidity', '', 70.5],
		['currency', '', 70.5],
	])('rejects an empty %s value instead of sending 0', async (field, unit, expected) => {
		const vm = await mountDialog(null);
		await selectField(vm, field);
		vm.newUnit = unit;
		vm.newNumValue = '';
		expect(vm.isValid).toBe(false);
		vm.newNumValue = 70.5;
		expect(vm.isValid).toBe(true);
		vm.addEntry();
		expect(vm.eventData[field]).toEqual(expected);
	});

	it('sends a numeric pace when one input is cleared', async () => {
		const vm = await mountDialog(null);
		await selectField(vm, 'pace');
		vm.newUnit = 's/km';
		vm.newMinutes = 5;
		vm.newSeconds = '';
		vm.addEntry();
		expect(vm.eventData['pace']).toEqual({ '@value': 300, unit: 's/km' });
	});
});
