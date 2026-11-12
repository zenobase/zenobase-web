import { flushPromises, mount } from '@vue/test-utils';
import { describe, expect, it, vi } from 'vitest';
import type { ZenoEvent } from '../../../types';
import { resolveUserNames } from '../../utils/userNames';
import EventFields from '../EventFields.vue';

vi.mock('../../api', () => ({
	default: { get: vi.fn().mockResolvedValue({ data: { name: 'Alice' } }) },
}));

describe('EventFields author name resolution', () => {
	it('replaces the author ID with the name once it is resolved', async () => {
		const event = { author: 'user-123' } as ZenoEvent;
		const wrapper = mount(EventFields, { props: { event } });
		expect(wrapper.text()).toContain('user-123');

		await resolveUserNames(['user-123']);
		await flushPromises();

		expect(wrapper.text()).toContain('Alice');
		expect(wrapper.text()).not.toContain('user-123');
	});
});
