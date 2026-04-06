import { mount } from '@vue/test-utils';
import { describe, expect, it, vi } from 'vitest';
import { createMemoryHistory, createRouter } from 'vue-router';
import { createVuetify } from 'vuetify';
import App from '../App.vue';
import productionRouter from '../router';

const vuetify = createVuetify();

// Mock the fetch API for whoami
globalThis.fetch = vi.fn().mockResolvedValue({
	ok: true,
	headers: new Headers({ 'content-type': 'application/json' }),
	json: () => Promise.resolve(null),
});

describe('App', () => {
	it('mounts without error', () => {
		const router = createRouter({
			history: createMemoryHistory(),
			routes: productionRouter.getRoutes(),
		});
		const wrapper = mount(App, {
			global: {
				plugins: [router, vuetify],
			},
		});
		expect(wrapper.exists()).toBe(true);
	});
});
