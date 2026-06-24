import { mount } from '@vue/test-utils';
import { describe, expect, it, vi } from 'vitest';
import type { ZenoEvent } from '../../../types';
import EventFields from '../EventFields.vue';

vi.mock('../../utils/userNames', () => ({ getUserName: (id: string) => 'User ' + id }));

describe('EventFields rendering safety', () => {
	it('escapes HTML in text values instead of injecting markup', () => {
		const wrapper = mount(EventFields, { props: { event: { tag: '<img src=x onerror=alert(1)>' } as ZenoEvent } });
		// The payload must be present as text, not as a real <img> element.
		expect(wrapper.find('img').exists()).toBe(false);
		expect(wrapper.text()).toContain('<img src=x onerror=alert(1)>');
	});

	it('renders resource links with safe rel/target and no attribute breakout', () => {
		const event = { resource: { title: 'Example', url: 'https://example.com/path?a=1' } } as ZenoEvent;
		const a = mount(EventFields, { props: { event } }).get('a');
		expect(a.attributes('href')).toBe('https://example.com/path?a=1');
		expect(a.attributes('target')).toBe('_blank');
		expect(a.attributes('rel')).toBe('nofollow noopener');
		expect(a.text()).toBe('Example');
	});

	it('does not let a crafted url break out of the href attribute', () => {
		const event = { resource: { title: 'x', url: '" onmouseover="alert(1)' } } as ZenoEvent;
		const wrapper = mount(EventFields, { props: { event } });
		const a = wrapper.get('a');
		// The whole payload stays inside href; no onmouseover attribute is created.
		expect(a.attributes('href')).toBe('" onmouseover="alert(1)');
		expect(a.attributes('onmouseover')).toBeUndefined();
	});

	it('renders location as plain text by default and a filter link when enabled', () => {
		const event = { location: { lat: 47.62, lon: -122.35 } } as ZenoEvent;
		expect(mount(EventFields, { props: { event } }).find('a').exists()).toBe(false);

		const wrapper = mount(EventFields, { props: { event, locationFilter: true } });
		const a = wrapper.get('a.location-filter');
		a.trigger('click');
		expect(wrapper.emitted('filter')?.[0]).toEqual(['location', '47.62,-122.35~100 m']);
	});

	it('renders a rating as five star glyphs with the right fill', () => {
		const wrapper = mount(EventFields, { props: { event: { rating: 80 } as ZenoEvent } });
		expect(wrapper.findAll('i.mdi-star')).toHaveLength(4);
		expect(wrapper.findAll('i.mdi-star-outline')).toHaveLength(1);
	});
});
