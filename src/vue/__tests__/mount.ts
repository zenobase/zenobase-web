import { enableAutoUnmount, mount } from '@vue/test-utils';
import { afterEach, vi } from 'vitest';
import { type Component, nextTick } from 'vue';
import { routerKey } from 'vue-router';
import { createVuetify } from 'vuetify';
import * as components from 'vuetify/components';
import * as directives from 'vuetify/directives';
import { alertKey, useAlert } from '../composables/useAlert';

export const vuetify = createVuetify({ components, directives });

enableAutoUnmount(afterEach);

/** A resolved `api.*` value with the given body and response headers. */
export function apiResponse<T>(data: T, headers: Record<string, string> = {}) {
	return { data, status: 200, headers: (name: string) => headers[name] ?? null } as never;
}

/**
 * Mounts a dialog closed, then opens it, since the dialogs only initialize when `modelValue` changes to true.
 * `vm` exposes the component's `<script setup>` bindings, typed by the caller.
 */
export async function mountDialog<VM>(component: Component, props: Record<string, unknown>, provide: Record<symbol, unknown> = {}) {
	const alertApi = useAlert();
	const router = { push: vi.fn() };
	const wrapper = mount(component, {
		attachTo: document.body,
		props: { ...props, modelValue: false },
		global: {
			plugins: [vuetify],
			provide: { [alertKey as symbol]: alertApi, [routerKey as symbol]: router, ...provide },
		},
	});
	await wrapper.setProps({ modelValue: true });
	await nextTick();
	return { wrapper, vm: wrapper.vm as unknown as VM, alertApi, router };
}
