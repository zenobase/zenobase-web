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

// jsdom doesn't ship visualViewport; Vuetify's VOverlay expects it.
vi.stubGlobal('visualViewport', { width: 1024, height: 768, offsetLeft: 0, offsetTop: 0, scale: 1, addEventListener: () => {}, removeEventListener: () => {} });

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

	it.each(['km/h', 'kmh'])('offers and preselects the stored velocity unit %s', async (unit) => {
		const vm = await mountDialog({ '@id': 'e1', velocity: { '@value': 10, unit } });
		await selectField(vm, 'velocity');
		expect(vm.fieldUnits.filter((u) => u === unit)).toHaveLength(1);
		expect(vm.newUnit).toBe(unit);
	});

	it('preselects a stored pace unit without its prefix', async () => {
		const vm = await mountDialog({ '@id': 'e1', pace: { '@value': 300, unit: 's/mi' } });
		await selectField(vm, 'pace');
		expect(vm.fieldUnits).toEqual(['km', 'mi']);
		expect(vm.newUnit).toBe('mi');
	});

	it('rejects an empty measure value instead of sending 0', async () => {
		const vm = await mountDialog(null);
		await selectField(vm, 'weight');
		vm.newUnit = 'kg';
		vm.newNumValue = '';
		expect(vm.isValid).toBe(false);
		vm.newNumValue = 70.5;
		expect(vm.isValid).toBe(true);
		vm.addEntry();
		expect(vm.eventData['weight']).toEqual({ '@value': 70.5, unit: 'kg' });
	});

	it('sends a numeric pace when one input is cleared', async () => {
		const vm = await mountDialog(null);
		await selectField(vm, 'pace');
		vm.newUnit = 'km';
		vm.newMinutes = 5;
		vm.newSeconds = '';
		vm.addEntry();
		expect(vm.eventData['pace']).toEqual({ '@value': 300, unit: 's/km' });
	});
});
