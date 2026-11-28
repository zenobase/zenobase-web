import { describe, expect, it, vi } from 'vitest';
import type { Bucket } from '../../../types';
import { Constraint } from '../../../utils/constraint';
import { apiResponse, mountDialog } from '../../__tests__/mount';
import api, { ApiError } from '../../api';
import SaveAsViewDialog from '../SaveAsViewDialog.vue';

interface SaveAsViewVM {
	label: string;
	message: string;
	create(): Promise<void>;
}

const bucket: Bucket = { '@id': 'b1', label: 'Runs', roles: [], widgets: [{ id: 'w1', type: 'list' }] };

function open(constraints: string[] = []) {
	return mountDialog<SaveAsViewVM>(SaveAsViewDialog, { bucketId: 'b1', bucket, constraints: constraints.map((c) => Constraint.parse(c)) });
}

describe('SaveAsViewDialog', () => {
	it('creates a view aliasing the bucket with the current constraints', async () => {
		const post = vi.spyOn(api, 'post').mockResolvedValue(apiResponse({}, { Location: '/buckets/v1' }));
		const { wrapper, vm, router } = await open(['tag:run', 'distance:>5']);
		expect(vm.label).toBe('Runs');

		vm.label = 'Long runs';
		await vm.create();

		expect(post).toHaveBeenCalledWith('/buckets/', {
			label: 'Long runs',
			widgets: bucket.widgets,
			aliases: [{ '@id': 'b1', filter: 'tag:run|distance:>5' }],
		});
		expect(router.push).toHaveBeenCalledWith('/buckets/v1');
		expect(wrapper.emitted('created')).toHaveLength(1);
	});

	it('creates an unfiltered view without constraints', async () => {
		const post = vi.spyOn(api, 'post').mockResolvedValue(apiResponse({}));
		const { vm, router } = await open();

		await vm.create();

		expect(post).toHaveBeenCalledWith('/buckets/', expect.objectContaining({ aliases: [{ '@id': 'b1', filter: null }] }));
		expect(router.push).not.toHaveBeenCalled();
	});

	it.each([
		[400, "Can't create view."],
		[503, "Couldn't create view. Please try again later or contact support."],
	])('shows an error for status %d', async (status, message) => {
		vi.spyOn(api, 'post').mockRejectedValue(new ApiError(status, null));
		const { wrapper, vm } = await open();

		await vm.create();

		expect(vm.message).toBe(message);
		expect(wrapper.emitted('created')).toBeUndefined();
	});
});
