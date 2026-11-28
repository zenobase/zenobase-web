import { mount } from '@vue/test-utils';
import { describe, expect, it, vi } from 'vitest';
import { defineComponent, nextTick } from 'vue';
import ErrorBoundary from '../ErrorBoundary.vue';

const Broken = defineComponent({
	setup() {
		throw new Error('boom');
	},
	template: '<div />',
});

describe('ErrorBoundary', () => {
	it('replaces a failing child and reports the error', async () => {
		vi.spyOn(console, 'error').mockImplementation(() => {});
		const wrapper = mount({ components: { ErrorBoundary, Broken }, template: '<p>before</p><ErrorBoundary><Broken /></ErrorBoundary>' });
		await nextTick();

		expect(wrapper.text()).toBe('beforeOops');
		const boundary = wrapper.findComponent(ErrorBoundary);
		expect(boundary.emitted('error')?.[0][0]).toEqual(new Error('boom'));
	});

	it('renders the children when nothing fails', () => {
		const wrapper = mount(ErrorBoundary, { slots: { default: '<span>ok</span>' } });
		expect(wrapper.text()).toBe('ok');
	});
});
