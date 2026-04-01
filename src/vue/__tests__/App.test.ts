import { mount } from '@vue/test-utils';
import { describe, expect, it, vi } from 'vitest';
import { createVuetify } from 'vuetify';
import App from '../App.vue';
import router from '../router';

const vuetify = createVuetify();

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
				plugins: [router, vuetify],
			},
		});
		expect(wrapper.exists()).toBe(true);
	});
});
