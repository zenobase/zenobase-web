import { flushPromises } from '@vue/test-utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { nextTick } from 'vue';
import type { ZenoEvent } from '../../../types';
import { apiResponse, mountDialog as mount } from '../../__tests__/mount';
import api, { ApiError } from '../../api';
import EventEditDialog from '../EventEditDialog.vue';

interface DialogState {
	newField: string;
	newValue: string;
	newUnit: string;
	newNumValue: unknown;
	newDays: unknown;
	newHours: unknown;
	newMinutes: unknown;
	newSeconds: unknown;
	newStars: number;
	newLat: number | null;
	newLon: number | null;
	newDate: string;
	newTime: string;
	newTimezone: string;
	newUrl: string;
	newTitle: string;
	fieldUnits: string[];
	isValid: boolean;
	eventData: ZenoEvent;
	entries: Array<{ field: string; value: string; stars?: number }>;
	message: string;
	addEntry(): void;
	removeEntry(index: number): void;
	fetchResourceTitle(): Promise<void>;
	save(): Promise<void>;
}

async function open(event: ZenoEvent | null) {
	vi.spyOn(api, 'get').mockResolvedValue(apiResponse({}));
	return mount<DialogState>(EventEditDialog, { bucketId: 'b1', event });
}

async function mountDialog(event: ZenoEvent | null): Promise<DialogState> {
	return (await open(event)).vm;
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

	it.each([
		['duration', (vm: DialogState) => Object.assign(vm, { newDays: 1, newHours: 2, newMinutes: 3, newSeconds: 4 }), 93784000],
		['rating', (vm: DialogState) => (vm.newStars = 4), 80],
		['timestamp', (vm: DialogState) => Object.assign(vm, { newDate: '2026-05-01', newTime: '07:30', newTimezone: '+02:00' }), '2026-05-01T07:30:00.000+02:00'],
		['location', (vm: DialogState) => Object.assign(vm, { newLat: 47.6, newLon: -122.3 }), { lat: 47.6, lon: -122.3 }],
		['resource', (vm: DialogState) => Object.assign(vm, { newUrl: 'https://example.com', newTitle: 'Example' }), { url: 'https://example.com', title: 'Example' }],
	])('builds a %s value', async (field, fill, expected) => {
		const vm = await mountDialog(null);
		await selectField(vm, field);
		fill(vm);
		expect(vm.isValid).toBe(true);
		vm.addEntry();
		expect(vm.eventData[field]).toEqual(expected);
	});

	it.each([
		[91, 0],
		[0, 181],
	])('rejects the location %d,%d', async (lat, lon) => {
		const vm = await mountDialog(null);
		await selectField(vm, 'location');
		Object.assign(vm, { newLat: lat, newLon: lon });
		expect(vm.isValid).toBe(false);
	});

	it('defaults a new timestamp to now in the local timezone', async () => {
		const vm = await mountDialog(null);
		await selectField(vm, 'timestamp');
		expect(vm.newDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
		expect(vm.newTimezone).toMatch(/^-0[78]:00$/);
	});

	it('collapses a field back to a single value as values are removed', async () => {
		const vm = await mountDialog({ '@id': 'e1', tag: ['a', 'b', 'c'], count: 3 });
		expect(vm.entries.map((e) => e.value)).toEqual(['a', 'b', 'c', '3']);

		vm.removeEntry(1);
		expect(vm.eventData['tag']).toEqual(['a', 'c']);
		vm.removeEntry(0);
		expect(vm.eventData['tag']).toBe('c');
		vm.removeEntry(0);
		expect(vm.eventData).toEqual({ '@id': 'e1', count: 3 });

		await selectField(vm, 'count');
		vm.newNumValue = 4;
		vm.addEntry();
		vm.newField = 'count';
		vm.newNumValue = 5;
		vm.addEntry();
		expect(vm.eventData['count']).toEqual([3, 4, 5]);
	});

	it('fills in the title of a resource without overwriting one', async () => {
		const vm = await mountDialog(null);
		await selectField(vm, 'resource');
		const get = vi
			.spyOn(api, 'get')
			.mockClear()
			.mockResolvedValue(apiResponse({ title: 'Fetched' }));

		vm.newUrl = 'https://example.com/a b';
		await vm.fetchResourceTitle();
		expect(get).toHaveBeenCalledWith('/og?url=https%3A%2F%2Fexample.com%2Fa%20b');
		expect(vm.newTitle).toBe('Fetched');

		vm.newTitle = 'Mine';
		await vm.fetchResourceTitle();
		expect(get).toHaveBeenCalledOnce();
	});

	it('creates a new event with the current time', async () => {
		const post = vi.spyOn(api, 'post').mockResolvedValue(apiResponse({}));
		const { wrapper, vm } = await open(null);
		vm.eventData['tag'] = 'run';

		await vm.save();

		expect(post).toHaveBeenCalledWith('/buckets/b1/', { tag: 'run', timestamp: expect.stringMatching(/^\d{4}-.*Z$/) });
		expect(wrapper.emitted('saved')).toHaveLength(1);
	});

	it('updates an existing event', async () => {
		const put = vi.spyOn(api, 'put').mockResolvedValue(apiResponse({}, { 'X-Command-ID': 'c1' }));
		const { wrapper, vm, alertApi } = await open({ '@id': 'e1', tag: 'run' });

		await vm.save();

		expect(put).toHaveBeenCalledWith('/buckets/b1/e1', { '@id': 'e1', tag: 'run' });
		expect(alertApi.alert.value).toMatchObject({ message: 'Updated an event.', undoId: 'c1' });
		expect(wrapper.emitted('saved')).toHaveLength(1);
	});

	it.each([
		[{ message: 'Invalid unit' }, 'Invalid unit'],
		[null, "Couldn't update this event."],
	])('shows why an update failed', async (data, message) => {
		vi.spyOn(api, 'put').mockRejectedValue(new ApiError(400, data));
		const { wrapper, vm } = await open({ '@id': 'e1', tag: 'run' });

		await vm.save();
		await flushPromises();

		expect(vm.message).toBe(message);
		expect(wrapper.emitted('saved')).toBeUndefined();
	});
});
