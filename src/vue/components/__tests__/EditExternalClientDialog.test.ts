import { mount, type VueWrapper } from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ComponentPublicInstance } from 'vue';
import { createVuetify } from 'vuetify';
import * as components from 'vuetify/components';
import * as directives from 'vuetify/directives';
import type { ExternalClient } from '../../../types';
import api from '../../api';
import { alertKey, useAlert } from '../../composables/useAlert';
import EditExternalClientDialog from '../EditExternalClientDialog.vue';

const vuetify = createVuetify({ components, directives });

function makeApp(overrides: Partial<ExternalClient> = {}): ExternalClient {
	return {
		client_id: 'claude-desktop',
		client_name: 'Claude Desktop',
		first_seen_at: '2026-05-01T00:00:00Z',
		readable_buckets: ['b1'],
		...overrides,
	};
}

async function mountDialog(app: ExternalClient) {
	const alertApi = useAlert();
	const wrapper = mount(EditExternalClientDialog, {
		attachTo: document.body,
		props: {
			userId: 'user-1',
			app,
			buckets: [
				{ '@id': 'b1', label: 'Weight' },
				{ '@id': 'b2', label: 'Sleep' },
				{ '@id': 'b3', label: 'Steps' },
			],
			modelValue: false,
		},
		global: {
			plugins: [vuetify],
			provide: { [alertKey as symbol]: alertApi },
		},
	});
	// the dialog's watcher only fires on change, so toggle false -> true to open it
	await wrapper.setProps({ modelValue: true });
	await wrapper.vm.$nextTick();
	await wrapper.vm.$nextTick();
	return { wrapper, alertApi };
}

function dialogText(_wrapper: VueWrapper<ComponentPublicInstance>): string {
	// Vuetify dialogs render in a Teleport — read the whole document.
	return document.body.textContent || '';
}

describe('EditExternalClientDialog', () => {
	beforeEach(() => {
		document.body.replaceChildren();
		// jsdom doesn't ship visualViewport; Vuetify's VOverlay locationStrategies expects it.
		const w = window as Window & { visualViewport?: unknown };
		if (!w.visualViewport) {
			Object.defineProperty(window, 'visualViewport', {
				configurable: true,
				value: {
					width: window.innerWidth,
					height: window.innerHeight,
					offsetLeft: 0,
					offsetTop: 0,
					scale: 1,
					addEventListener: () => {},
					removeEventListener: () => {},
				},
			});
		}
	});
	afterEach(() => {
		vi.restoreAllMocks();
	});

	it('renders the client name and the buckets list', async () => {
		const { wrapper } = await mountDialog(makeApp());
		const text = dialogText(wrapper);
		expect(text).toContain('Claude Desktop');
		expect(text).toContain('Weight');
		expect(text).toContain('Sleep');
		expect(text).toContain('Steps');
	});

	it('pre-checks currently-granted buckets', async () => {
		const { wrapper } = await mountDialog(makeApp({ readable_buckets: ['b1', 'b3'] }));
		const checked = (wrapper.vm as unknown as { selected: Set<string> }).selected;
		expect(Array.from(checked).sort()).toEqual(['b1', 'b3']);
	});

	it('shows a Pending chip when no buckets are granted', async () => {
		const { wrapper } = await mountDialog(makeApp({ readable_buckets: [] }));
		expect(dialogText(wrapper)).toContain('Pending');
	});

	it('falls back to client_id when client_name is missing', async () => {
		const { wrapper } = await mountDialog(makeApp({ client_name: undefined }));
		expect(dialogText(wrapper)).toContain('claude-desktop');
	});

	it('emits saved with the response after a successful PUT', async () => {
		const updated = makeApp({ readable_buckets: ['b1', 'b2'] });
		const putSpy = vi.spyOn(api, 'put').mockResolvedValue({ data: updated, status: 200, headers: () => null });

		const { wrapper } = await mountDialog(makeApp());
		const vm = wrapper.vm as unknown as { selected: Set<string>; save: () => Promise<void> };
		vm.selected = new Set(['b1', 'b2']);
		await wrapper.vm.$nextTick();
		await vm.save();

		expect(putSpy).toHaveBeenCalledWith('/users/user-1/external-clients/claude-desktop', { readable_buckets: ['b1', 'b2'] });
		const events = wrapper.emitted('saved');
		expect(events).toBeTruthy();
		expect(events![0][0]).toEqual(updated);
	});

	it('shows an error message when the PUT fails', async () => {
		vi.spyOn(api, 'put').mockRejectedValue({ status: 500 });
		const { wrapper, alertApi } = await mountDialog(makeApp());
		const vm = wrapper.vm as unknown as { selected: Set<string>; save: () => Promise<void>; message: string };
		vm.selected = new Set(['b1', 'b2']);
		await wrapper.vm.$nextTick();
		await vm.save();

		expect(vm.message).toMatch(/Couldn't update this app/);
		expect(wrapper.emitted('saved')).toBeFalsy();
		// alert is cleared at the start of save() and not re-set on error (error stays in-dialog)
		expect(alertApi.alert.value.level).toBe('');
	});

	it('url-encodes the client_id when calling the API', async () => {
		const putSpy = vi.spyOn(api, 'put').mockResolvedValue({ data: makeApp(), status: 200, headers: () => null });
		const { wrapper } = await mountDialog(makeApp({ client_id: 'has spaces/and slashes' }));
		await (wrapper.vm as unknown as { save: () => Promise<void> }).save();
		expect(putSpy).toHaveBeenCalledWith('/users/user-1/external-clients/has%20spaces%2Fand%20slashes', expect.anything());
	});
});
