import { flushPromises } from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { apiResponse, mountDialog } from '../../__tests__/mount';
import api, { ApiError } from '../../api';
import TaskListDialog from '../TaskListDialog.vue';

interface TaskListVM {
	tasks: Array<{ '@id': string }> | null;
	offset: number;
	message: string;
	hasPrev(): boolean;
	hasNext(): boolean;
	next(): void;
	prev(): void;
	remove(id: string): Promise<void>;
	runTask(id: string): Promise<void>;
	formatTooltip(task: object): string;
}

const page = (total: number, ids: string[]) => apiResponse({ total, tasks: ids.map((id) => ({ '@id': id, type: 'fitbit-steps' })) });

async function open() {
	const get = vi.spyOn(api, 'get').mockResolvedValue(page(12, ['t1', 't2']));
	const result = await mountDialog<TaskListVM>(TaskListDialog, { bucketId: 'b1' });
	await flushPromises();
	vi.useFakeTimers({ toFake: ['setTimeout'] });
	return { ...result, get };
}

describe('TaskListDialog', () => {
	beforeEach(() => {
		vi.restoreAllMocks();
	});

	afterEach(() => {
		vi.useRealTimers();
		localStorage.clear();
	});

	it('pages through the tasks', async () => {
		const { vm, get } = await open();
		expect(get).toHaveBeenCalledWith('/buckets/b1/tasks/?offset=0&limit=10');
		expect(vm.hasPrev()).toBe(false);
		expect(vm.hasNext()).toBe(true);

		vm.next();
		await flushPromises();

		expect(get).toHaveBeenLastCalledWith('/buckets/b1/tasks/?offset=10&limit=10');
		expect(vm.hasPrev()).toBe(true);
		expect(vm.hasNext()).toBe(false);
	});

	it.each([
		[404, "Can't retrieve any tasks."],
		[500, "Couldn't retrieve any tasks. Try again later or contact support."],
	])('shows an error when the tasks cannot be loaded (%d)', async (status, message) => {
		const { vm, get } = await open();
		get.mockRejectedValue(new ApiError(status, null));

		vm.next();
		await flushPromises();

		expect(vm.message).toBe(message);
	});

	it('deletes a task and reloads the list', async () => {
		const { vm, get } = await open();
		const del = vi.spyOn(api, 'del').mockResolvedValue(apiResponse(null));
		get.mockResolvedValue(page(11, ['t2']));

		await vm.remove('t1');
		vi.advanceTimersByTime(1000);
		await flushPromises();

		expect(del).toHaveBeenCalledWith('/tasks/t1');
		expect(vm.tasks?.map((t) => t['@id'])).toEqual(['t2']);
	});

	it('asks for authorization when the task needs new credentials', async () => {
		const { wrapper, vm, alertApi, get } = await open();
		get.mockResolvedValueOnce(apiResponse({ '@id': 't1', type: 'fitbit-steps' }, { 'X-Credentials': 'fitbit' }));
		const post = vi.spyOn(api, 'post').mockResolvedValue(apiResponse({ '@id': 'c1', authorizationUrl: 'https://fitbit.example/auth' }));

		await vm.runTask('t1');

		expect(post).toHaveBeenCalledWith('/credentials/', { type: 'fitbit' });
		expect(localStorage.getItem('credentials')).toBe('c1');
		expect(alertApi.alert.value).toMatchObject({ message: 'fitbit requires authorization', action: { label: 'Authorize', url: 'https://fitbit.example/auth' } });
		expect(wrapper.emitted('task-ran')).toBeUndefined();
		vi.advanceTimersByTime(1000);
		expect(wrapper.emitted('task-ran')).toHaveLength(1);
	});

	it('links to the authorization page from the Link header', async () => {
		const { vm, alertApi, get } = await open();
		get.mockResolvedValueOnce(apiResponse({ '@id': 't1', type: 'lastfm-tracks' }, { Link: '<https://last.example/auth>; rel="authorize"' }));

		await vm.runTask('t1');

		expect(alertApi.alert.value).toMatchObject({ message: 'lastfm-tracks requires authorization', action: { url: 'https://last.example/auth' } });
	});

	it.each([
		[403, "Couldn't refresh a task. Insufficient quota?"],
		[409, "Couldn't refresh a task."],
		[502, "Couldn't refresh a task. Try again later or contact support."],
	])('explains a failed run (%d)', async (status, message) => {
		const { vm, get } = await open();
		get.mockRejectedValueOnce(new ApiError(status, null));

		await vm.runTask('t1');

		expect(vm.message).toBe(message);
	});

	it('lists the settings in the tooltip', async () => {
		const { vm } = await open();

		expect(vm.formatTooltip({ settings: { tag: 'steps', hourly: false } })).toBe('tag: steps\nhourly: false');
		expect(vm.formatTooltip({})).toBe('(no settings)');
	});
});
