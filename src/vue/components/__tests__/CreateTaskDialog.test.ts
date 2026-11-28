import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { nextTick } from 'vue';
import { apiResponse, mountDialog } from '../../__tests__/mount';
import api, { ApiError } from '../../api';
import CreateTaskDialog from '../CreateTaskDialog.vue';

interface CreateTaskVM {
	types: Array<{ id: string }>;
	selectedType: { id: string };
	settings: Record<string, unknown>;
	message: string;
	create(): Promise<void>;
}

function open(initialType?: string) {
	return mountDialog<CreateTaskVM>(CreateTaskDialog, { bucketId: 'b1', initialType });
}

describe('CreateTaskDialog', () => {
	beforeEach(() => {
		vi.useFakeTimers({ now: new Date('2026-05-15T12:00:00Z'), toFake: ['Date'] });
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it('resolves the defaults of the initial task type', async () => {
		const { vm } = await open('fitbit-steps');

		expect(vm.selectedType.id).toBe('fitbit-steps');
		expect(vm.settings).toEqual({ tag: 'steps', hourly: false, marker: '2026-02-01' });
	});

	it('defaults timezones to the local one', async () => {
		const { vm } = await open('withings-weight');

		expect(vm.settings).toMatchObject({ unit: 'lb', timezone: 'America/Los_Angeles' });
	});

	it('falls back to the first type and resets the settings on a type change', async () => {
		const { vm } = await open('no-such-task');
		expect(vm.selectedType.id).toBe(vm.types[0].id);

		vm.settings['tag'] = 'custom';
		vm.selectedType = vm.types.find((t) => t.id === 'goodreads')!;
		await nextTick();

		expect(vm.settings).toEqual({ tag: 'Book', shelf: 'read', marker: '2007-01-01' });
	});

	it.each([
		['rescuetime-productivity', { kind: 'overview' }, { kind: 'overview', timezone: 'America/Los_Angeles', marker: '2026-02-01' }],
		['netatmo', { modules: false }, { modules: false, hourly: true, marker: '2026-02-01' }],
		['trakt', { marker: '' }, undefined],
	])('creates a %s task, dropping blank settings but keeping false ones', async (type, edits, settings) => {
		const post = vi.spyOn(api, 'post').mockResolvedValue(apiResponse({ '@id': 't1' }));
		const { wrapper, vm } = await open(type);

		Object.assign(vm.settings, edits);
		await vm.create();

		expect(post).toHaveBeenCalledWith('/tasks/', { type, bucket: 'b1', settings });
		expect(wrapper.emitted('created')).toEqual([['t1']]);
	});

	it('stays open when the task cannot be created', async () => {
		vi.spyOn(api, 'post').mockRejectedValue(new ApiError(500, null));
		const { wrapper, vm } = await open();

		await vm.create();

		expect(vm.message).toBe("Couldn't create task. Try again later or contact support.");
		expect(wrapper.emitted('update:modelValue')).toBeUndefined();
	});
});
