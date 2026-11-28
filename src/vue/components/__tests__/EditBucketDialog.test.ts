import { describe, expect, it, vi } from 'vitest';
import { ref } from 'vue';
import type { Bucket, Role, User } from '../../../types';
import { apiResponse, mountDialog } from '../../__tests__/mount';
import api, { ApiError } from '../../api';
import { authKey } from '../../composables/useAuth';
import EditBucketDialog from '../EditBucketDialog.vue';

interface EditBucketVM {
	newBucket: Bucket;
	message: string;
	isFormValid: boolean;
	selectableBuckets: Array<{ '@id': string }>;
	selectedBucket: { '@id': string; label: string } | null;
	aliasFilter: string | null;
	addAlias(): void;
	removeAlias(id: string): void;
	publish(): void;
	unpublish(): void;
	save(): Promise<void>;
	archiveBucket(archive: boolean): Promise<void>;
	deleteBucket(): Promise<void>;
}

const user: User = { '@id': 'u1', verified: true, quota: 5 };
const owner: Role = { principal: 'u1', role: 'owner' };

async function open(bucket: Partial<Bucket> = {}, currentUser: User = user) {
	const get = vi.spyOn(api, 'get').mockResolvedValue(
		apiResponse({
			buckets: [
				{ '@id': 'b1', label: 'Runs' },
				{ '@id': 'b2', label: 'Walks' },
				{ '@id': 'v1', label: 'A view', aliases: [{ '@id': 'b1' }] },
			],
		}),
	);
	const props = { bucketId: 'b1', bucket: { '@id': 'b1', label: 'Runs', roles: [owner], version: 3, ...bucket } };
	const result = await mountDialog<EditBucketVM>(EditBucketDialog, props, { [authKey as symbol]: { user: ref(currentUser) } });
	return { ...result, get };
}

/** Spies on `api.put`, recording each body as it was sent, since the dialog keeps mutating it. */
function spyOnPut(...results: Array<Error | null>) {
	const bodies: Bucket[] = [];
	vi.spyOn(api, 'put').mockImplementation(async (_url, body) => {
		bodies.push(JSON.parse(JSON.stringify(body)));
		const error = results.shift();
		if (error) throw error;
		return apiResponse({}, { 'X-Command-ID': 'c1' });
	});
	return bodies;
}

describe('EditBucketDialog', () => {
	it('saves the edited copy and bumps its version', async () => {
		const sent = spyOnPut();
		const { wrapper, vm, alertApi, get } = await open({ refresh: true });
		expect(get).toHaveBeenCalledWith('/users/u1/buckets/?order=label&offset=0&limit=100&labels_only=true');

		vm.newBucket.label = 'Morning runs';
		vm.publish();
		vm.publish(); // adds the viewer role only once
		await vm.save();

		const saved = { '@id': 'b1', label: 'Morning runs', roles: [owner, { principal: '*', role: 'viewer' }], refresh: true };
		expect(api.put).toHaveBeenCalledWith('/buckets/b1', expect.anything());
		expect(sent).toEqual([{ ...saved, version: 3 }]);
		expect(wrapper.emitted('saved')).toEqual([[{ ...saved, version: 4 }]]);
		expect(wrapper.props('bucket').label).toBe('Runs');
		expect(alertApi.alert.value).toMatchObject({ message: 'Saved settings.', undoId: 'c1' });
	});

	it('turns off automatic refreshing without a quota', async () => {
		const { vm } = await open({ refresh: true, roles: [owner, { principal: '*', role: 'viewer' }] }, { '@id': 'u1' });

		vm.unpublish();

		expect(vm.newBucket.refresh).toBe(false);
		expect(vm.newBucket.roles).toEqual([owner]);
	});

	it('edits the aliases of a view', async () => {
		const { vm } = await open({ aliases: [{ '@id': 'b1' }] });
		await vi.waitFor(() => expect(vm.selectableBuckets.map((b) => b['@id'])).toEqual(['b2']));

		vm.selectedBucket = { '@id': 'b2', label: 'Walks' };
		vm.aliasFilter = 'tag:dog';
		vm.addAlias();
		vm.removeAlias('b1');

		expect(vm.newBucket.aliases).toEqual([{ '@id': 'b2', filter: 'tag:dog' }]);
		vm.removeAlias('b2');
		expect(vm.isFormValid).toBe(false);
	});

	it.each([
		[400, "Can't save this bucket"],
		[500, "Couldn't save this bucket. Try again later or contact support."],
	])('shows an error when saving fails with %d', async (status, message) => {
		spyOnPut(new ApiError(status, null));
		const { wrapper, vm } = await open();

		await vm.save();

		expect(vm.message).toBe(message);
		expect(wrapper.emitted('saved')).toBeUndefined();
	});

	it('archives the bucket and leaves the dashboard', async () => {
		const sent = spyOnPut();
		const { vm, router } = await open();

		await vm.archiveBucket(true);

		expect(sent).toEqual([expect.objectContaining({ archived: true, version: 3 })]);
		expect(router.push).toHaveBeenCalledWith('/');
	});

	it('un-archives the bucket in place', async () => {
		const sent = spyOnPut();
		const { wrapper, vm, router } = await open({ archived: true });

		await vm.archiveBucket(false);

		expect(sent[0]).not.toHaveProperty('archived');
		const [[saved]] = wrapper.emitted('saved') as [[Bucket]];
		expect(saved).not.toHaveProperty('archived');
		expect(saved.version).toBe(4);
		expect(router.push).not.toHaveBeenCalled();
	});

	it('does not archive the bucket on the next save after archiving failed', async () => {
		const sent = spyOnPut(new ApiError(409, null));
		const { vm } = await open();

		await vm.archiveBucket(true);
		expect(vm.message).toBe("Can't archive this bucket.");
		await vm.save();

		expect(sent[1]).not.toHaveProperty('archived');
	});

	it('deletes the bucket and leaves the dashboard', async () => {
		const del = vi.spyOn(api, 'del').mockResolvedValue(apiResponse({}));
		const { vm, router } = await open();

		await vm.deleteBucket();

		expect(del).toHaveBeenCalledWith('/buckets/b1');
		expect(router.push).toHaveBeenCalledWith('/');
	});

	it.each([
		[403, "Can't delete this bucket."],
		[500, "Couldn't delete this bucket. Try again later or contact support."],
	])('shows an error when deleting fails with %d', async (status, message) => {
		vi.spyOn(api, 'del').mockRejectedValue(new ApiError(status, null));
		const { vm, router } = await open();

		await vm.deleteBucket();

		expect(vm.message).toBe(message);
		expect(router.push).not.toHaveBeenCalled();
	});
});
