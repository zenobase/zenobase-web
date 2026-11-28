import { describe, expect, it, vi } from 'vitest';
import type { ExternalClient } from '../../../types';
import { apiResponse, mountDialog as mount } from '../../__tests__/mount';
import api from '../../api';
import EditExternalClientDialog from '../EditExternalClientDialog.vue';

interface EditExternalClientVM {
	selected: Set<string>;
	message: string;
	save(): Promise<void>;
}

function makeApp(overrides: Partial<ExternalClient> = {}): ExternalClient {
	return {
		client_id: 'claude-desktop',
		client_name: 'Claude Desktop',
		created: '2026-05-01T00:00:00Z',
		readable_buckets: ['b1'],
		...overrides,
	};
}

function mountDialog(app: ExternalClient) {
	const buckets = [
		{ '@id': 'b1', label: 'Weight' },
		{ '@id': 'b2', label: 'Sleep' },
		{ '@id': 'b3', label: 'Steps' },
	];
	return mount<EditExternalClientVM>(EditExternalClientDialog, { userId: 'user-1', app, buckets });
}

// Vuetify dialogs render in a Teleport, so read the whole document.
function dialogText(): string {
	return document.body.textContent || '';
}

describe('EditExternalClientDialog', () => {
	it('renders the client name and the buckets list', async () => {
		await mountDialog(makeApp());
		const text = dialogText();
		expect(text).toContain('Claude Desktop');
		expect(text).toContain('Weight');
		expect(text).toContain('Sleep');
		expect(text).toContain('Steps');
	});

	it('pre-checks currently-granted buckets', async () => {
		const { vm } = await mountDialog(makeApp({ readable_buckets: ['b1', 'b3'] }));
		expect(Array.from(vm.selected).sort()).toEqual(['b1', 'b3']);
	});

	it('shows a Pending chip when no buckets are granted', async () => {
		await mountDialog(makeApp({ readable_buckets: [] }));
		expect(dialogText()).toContain('Pending');
	});

	it('falls back to client_id when client_name is missing', async () => {
		await mountDialog(makeApp({ client_name: undefined }));
		expect(dialogText()).toContain('claude-desktop');
	});

	it('emits saved with the response after a successful PUT', async () => {
		const updated = makeApp({ readable_buckets: ['b1', 'b2'] });
		const putSpy = vi.spyOn(api, 'put').mockResolvedValue(apiResponse(updated));

		const { wrapper, vm } = await mountDialog(makeApp());
		vm.selected = new Set(['b1', 'b2']);
		await vm.save();

		expect(putSpy).toHaveBeenCalledWith('/users/user-1/external-clients/claude-desktop', { readable_buckets: ['b1', 'b2'] });
		const events = wrapper.emitted('saved');
		expect(events).toBeTruthy();
		expect(events![0][0]).toEqual(updated);
	});

	it('shows an error message when the PUT fails', async () => {
		vi.spyOn(api, 'put').mockRejectedValue({ status: 500 });
		const { wrapper, vm, alertApi } = await mountDialog(makeApp());
		vm.selected = new Set(['b1', 'b2']);
		await vm.save();

		expect(vm.message).toMatch(/Couldn't update this app/);
		expect(wrapper.emitted('saved')).toBeFalsy();
		// alert is cleared at the start of save() and not re-set on error (error stays in-dialog)
		expect(alertApi.alert.value.level).toBe('');
	});

	it('url-encodes the client_id when calling the API', async () => {
		const putSpy = vi.spyOn(api, 'put').mockResolvedValue(apiResponse(makeApp()));
		const { vm } = await mountDialog(makeApp({ client_id: 'has spaces/and slashes' }));
		await vm.save();
		expect(putSpy).toHaveBeenCalledWith('/users/user-1/external-clients/has%20spaces%2Fand%20slashes', expect.anything());
	});
});
