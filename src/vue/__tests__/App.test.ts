import { mount } from '@vue/test-utils';
import { describe, expect, it, vi } from 'vitest';
import App from '../App.vue';
import router from '../router';

// Mock the fetch API for whoami
globalThis.fetch = vi.fn().mockResolvedValue({
	ok: true,
	headers: new Headers({ 'content-type': 'application/json' }),
	json: () => Promise.resolve(null),
});

describe('App', () => {
	it('mounts without error', () => {
		const wrapper = mount(App, {
			global: {
				plugins: [router],
			},
		});
		expect(wrapper.exists()).toBe(true);
	});
});
