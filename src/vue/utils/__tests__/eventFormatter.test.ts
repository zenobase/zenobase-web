import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ZenoEvent } from '../../../types';
import { type FieldSegment, formatEvent } from '../eventFormatter';

vi.mock('../userNames', () => ({ getUserName: (id: string) => 'User ' + id }));

/** Formats an event with a single field set and returns the one resulting segment. */
function one(field: string, value: unknown): FieldSegment {
	const segments = formatEvent({ [field]: value } as ZenoEvent);
	expect(segments).toHaveLength(1);
	return segments[0];
}

/** Formats an event with a single field and returns all resulting segments. */
function many(field: string, value: unknown): FieldSegment[] {
	return formatEvent({ [field]: value } as ZenoEvent);
}

describe('formatEvent', () => {
	it('tag', () => {
		expect(one('tag', 'food')).toMatchObject({ name: 'tag', icon: 'mdi-tag', iconTitle: 'Tag', kind: 'text', text: 'food', nowrap: true });
	});

	it('tag keeps raw text (escaping happens at render time)', () => {
		expect(one('tag', '<b>bold</b>')).toMatchObject({ kind: 'text', text: '<b>bold</b>' });
	});

	it('resource', () => {
		expect(one('resource', { title: 'Example', url: 'https://example.com' })).toMatchObject({
			name: 'resource',
			icon: 'mdi-bookmark',
			kind: 'link',
			text: 'Example',
			href: 'https://example.com',
			nowrap: false,
			tightIcon: true,
		});
	});

	it('resource with no title is skipped', () => {
		expect(many('resource', { url: 'https://example.com' })).toEqual([]);
	});

	it('distance', () => {
		expect(one('distance', { '@value': 5.2, unit: 'km' })).toMatchObject({ icon: 'mdi-arrow-left-right', kind: 'text', text: '5.2 km' });
	});

	it('weight', () => {
		expect(one('weight', { '@value': 70, unit: 'kg' })).toMatchObject({ kind: 'text', text: '70 kg' });
	});

	it('percentage', () => {
		expect(one('percentage', 85.7)).toMatchObject({ icon: 'mdi-view-grid', kind: 'abbr', text: '86%', title: '85.7%' });
	});

	it('moon', () => {
		expect(one('moon', 50)).toMatchObject({ icon: 'mdi-moon-waning-crescent', kind: 'text', text: '50%' });
	});

	it('humidity', () => {
		expect(one('humidity', 40)).toMatchObject({ kind: 'text', text: '40%' });
	});

	it('pressure uses locale formatting', () => {
		expect(one('pressure', { '@value': 1013, unit: 'hPa' })).toMatchObject({ kind: 'text', text: (1013).toLocaleString() + ' hPa' });
	});

	it('location', () => {
		expect(one('location', { lat: 47.6205, lon: -122.3493 })).toMatchObject({
			icon: 'mdi-map-marker',
			kind: 'location',
			text: '47.621, -122.349',
			filter: '47.621,-122.349~100 m',
		});
	});

	it('location with missing lat is skipped', () => {
		expect(many('location', {})).toEqual([]);
	});

	describe('timestamp', () => {
		beforeEach(() => {
			vi.useFakeTimers();
			vi.setSystemTime(new Date('2025-01-15T12:00:00Z'));
		});
		afterEach(() => {
			vi.useRealTimers();
		});

		it('shows just now with full timestamp as title', () => {
			expect(one('timestamp', '2025-01-15T11:59:30Z')).toMatchObject({ icon: 'mdi-calendar-outline', kind: 'abbr', text: 'just now', title: '2025-01-15T11:59:30Z' });
		});

		it('shows minutes ago', () => {
			expect(one('timestamp', '2025-01-15T11:50:00Z')).toMatchObject({ kind: 'abbr', text: '10m ago' });
		});

		it('shows hours ago', () => {
			expect(one('timestamp', '2025-01-15T09:00:00Z')).toMatchObject({ kind: 'abbr', text: '3h ago' });
		});
	});

	it('pace formats s/km', () => {
		expect(one('pace', { '@value': 305, unit: 's/km' })).toMatchObject({ kind: 'text', text: '5\'5"/km' });
	});

	it('pace falls back for non-s/ units', () => {
		expect(one('pace', { '@value': 5, unit: 'min/km' })).toMatchObject({ kind: 'text', text: '5 min/km' });
	});

	it('duration has no abbr title', () => {
		const seg = one('duration', 3661000);
		expect(seg).toMatchObject({ icon: 'mdi-clock-outline', kind: 'abbr', text: '1h 1min' });
		expect(seg.title).toBeUndefined();
	});

	it('duration with unit value', () => {
		expect(one('duration', { '@value': 60000, unit: 'ms' })).toMatchObject({ kind: 'abbr', text: '1min' });
	});

	it('count', () => {
		expect(one('count', 1234)).toMatchObject({ kind: 'text', text: '1,234' });
	});

	it('rating 0%', () => {
		expect(one('rating', 0)).toMatchObject({ name: 'rating', icon: null, kind: 'rating', filled: 0, title: '0%' });
	});

	it('rating 80%', () => {
		expect(one('rating', 80)).toMatchObject({ icon: null, kind: 'rating', filled: 4, title: '80%' });
	});

	it('rating 100%', () => {
		expect(one('rating', 100)).toMatchObject({ kind: 'rating', filled: 5, title: '100%' });
	});

	it('currency', () => {
		expect(one('currency', 9.5)).toMatchObject({ icon: 'mdi-currency-usd', kind: 'text', text: '9.50' });
	});

	it('note', () => {
		expect(one('note', 'hello world')).toMatchObject({ icon: 'mdi-comment-outline', kind: 'text', text: 'hello world', nowrap: false, tightIcon: true });
	});

	it('author resolves user name', () => {
		expect(one('author', '123')).toMatchObject({ icon: 'mdi-account', iconTitle: 'User', kind: 'text', text: 'User 123' });
	});

	it('source', () => {
		expect(one('source', { title: 'Blog', url: 'https://blog.example.com' })).toMatchObject({
			icon: 'mdi-open-in-new',
			kind: 'link',
			text: 'Blog',
			href: 'https://blog.example.com',
			nowrap: true,
		});
	});

	it('source with no title is skipped', () => {
		expect(many('source', { url: 'https://example.com' })).toEqual([]);
	});

	it('expands array-valued fields into one segment each', () => {
		const segments = many('tag', ['a', 'b', 'c']);
		expect(segments.map((s) => s.text)).toEqual(['a', 'b', 'c']);
	});

	it('collapses a single-element array to one segment', () => {
		expect(many('tag', ['solo'])).toHaveLength(1);
	});

	it('skips excluded fields and preserves registry order', () => {
		const segments = formatEvent({ tag: 'food', count: 3, note: 'hi' } as ZenoEvent, new Set(['count']));
		expect(segments.map((s) => s.name)).toEqual(['tag', 'note']);
	});

	it('skips null and undefined values', () => {
		expect(formatEvent({ tag: null, note: undefined, count: 5 } as unknown as ZenoEvent)).toHaveLength(1);
	});
});
