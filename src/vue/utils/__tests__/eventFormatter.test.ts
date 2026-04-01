import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FIELD_REGISTRY } from '../eventFormatter';

vi.mock('../userNames', () => ({ getUserName: (id: string) => 'User ' + id }));

function toHtml(fieldName: string, value: unknown): string {
	const field = FIELD_REGISTRY.find((f) => f.name === fieldName);
	if (!field) throw new Error('Unknown field: ' + fieldName);
	return field.toHtml(value);
}

function span(icon: string, title: string, value: string): string {
	return '<span class="text-no-wrap"><i class="mdi ' + icon + '" title="' + title + '"></i> ' + value + '</span>';
}

describe('FIELD_REGISTRY toHtml', () => {
	it('tag', () => {
		expect(toHtml('tag', 'food')).toBe(span('mdi-tag', 'Tag', 'food'));
	});

	it('tag escapes HTML', () => {
		expect(toHtml('tag', '<b>bold</b>')).toBe(span('mdi-tag', 'Tag', '&lt;b&gt;bold&lt;/b&gt;'));
	});

	it('resource', () => {
		expect(toHtml('resource', { title: 'Example', url: 'https://example.com' })).toBe(
			'<span><i class="mdi mdi-bookmark" title="Resource"></i>&nbsp;<a href="/to?url=https://example.com" target="_blank" rel="nofollow noopener noreferrer">Example</a></span>',
		);
	});

	it('resource with no title returns empty', () => {
		expect(toHtml('resource', { url: 'https://example.com' })).toBe('');
	});

	it('distance', () => {
		expect(toHtml('distance', { '@value': 5.2, unit: 'km' })).toBe(span('mdi-arrow-left-right', 'Distance', '5.2 km'));
	});

	it('height', () => {
		expect(toHtml('height', { '@value': 180, unit: 'cm' })).toBe(span('mdi-arrow-up-down', 'Height', '180 cm'));
	});

	it('weight', () => {
		expect(toHtml('weight', { '@value': 70, unit: 'kg' })).toBe(span('mdi-weight', 'Weight', '70 kg'));
	});

	it('percentage', () => {
		expect(toHtml('percentage', 85.7)).toBe(span('mdi-view-grid', 'Percentage', '<abbr title="85.7%">86%</abbr>'));
	});

	it('moon', () => {
		expect(toHtml('moon', 50)).toBe(span('mdi-moon-waning-crescent', 'Moon', '50%'));
	});

	it('volume', () => {
		expect(toHtml('volume', { '@value': 500, unit: 'mL' })).toBe(span('mdi-cup', 'Volume', '500 mL'));
	});

	it('concentration', () => {
		expect(toHtml('concentration', { '@value': 1.2, unit: 'mg/dL' })).toBe(span('mdi-water', 'Concentration', '1.2 mg/dL'));
	});

	it('distance/volume', () => {
		expect(toHtml('distance/volume', { '@value': 30, unit: 'mpg' })).toBe(span('mdi-gas-station', 'Distance/Volume', '30 mpg'));
	});

	it('humidity', () => {
		expect(toHtml('humidity', 40)).toBe(span('mdi-water', 'Humidity', '40%'));
	});

	it('pressure', () => {
		expect(toHtml('pressure', { '@value': 1013, unit: 'hPa' })).toBe(span('mdi-arrow-expand-all', 'Pressure', '1013 hPa'));
	});

	it('sound', () => {
		expect(toHtml('sound', { '@value': 85, unit: 'dB' })).toBe(span('mdi-volume-high', 'Sound Level', '85 dB'));
	});

	it('location', () => {
		expect(toHtml('location', { lat: 47.6205, lon: -122.3493 })).toBe(span('mdi-map-marker', 'Location', '47.621, -122.349'));
	});

	it('location with missing lat returns empty', () => {
		expect(toHtml('location', {})).toBe('');
	});

	describe('timestamp', () => {
		beforeEach(() => {
			vi.useFakeTimers();
			vi.setSystemTime(new Date('2025-01-15T12:00:00Z'));
		});
		afterEach(() => {
			vi.useRealTimers();
		});

		it('shows just now', () => {
			expect(toHtml('timestamp', '2025-01-15T11:59:30Z')).toBe(span('mdi-calendar-outline', 'Timestamp', '<abbr title="2025-01-15T11:59:30Z">just now</abbr>'));
		});

		it('shows minutes ago', () => {
			expect(toHtml('timestamp', '2025-01-15T11:50:00Z')).toBe(span('mdi-calendar-outline', 'Timestamp', '<abbr title="2025-01-15T11:50:00Z">10 minutes ago</abbr>'));
		});

		it('shows hours ago', () => {
			expect(toHtml('timestamp', '2025-01-15T09:00:00Z')).toBe(span('mdi-calendar-outline', 'Timestamp', '<abbr title="2025-01-15T09:00:00Z">3 hours ago</abbr>'));
		});
	});

	it('velocity', () => {
		expect(toHtml('velocity', { '@value': 100, unit: 'kmh' })).toBe(span('mdi-speedometer', 'Velocity', '100 kmh'));
	});

	it('pace formats s/km', () => {
		expect(toHtml('pace', { '@value': 305, unit: 's/km' })).toBe(span('mdi-timer-outline', 'Pace', '5\'5"/km'));
	});

	it('pace formats s/mi', () => {
		expect(toHtml('pace', { '@value': 480, unit: 's/mi' })).toBe(span('mdi-timer-outline', 'Pace', '8\'0"/mi'));
	});

	it('pace falls back for non-s/ units', () => {
		expect(toHtml('pace', { '@value': 5, unit: 'min/km' })).toBe(span('mdi-timer-outline', 'Pace', '5 min/km'));
	});

	it('duration', () => {
		expect(toHtml('duration', 3661000)).toBe(span('mdi-clock-outline', 'Duration', '<abbr>1h 1min</abbr>'));
	});

	it('duration with unit value', () => {
		expect(toHtml('duration', { '@value': 60000, unit: 'ms' })).toBe(span('mdi-clock-outline', 'Duration', '<abbr>1min</abbr>'));
	});

	it('frequency', () => {
		expect(toHtml('frequency', { '@value': 72, unit: 'bpm' })).toBe(span('mdi-heart', 'Frequency', '72 bpm'));
	});

	it('bits', () => {
		expect(toHtml('bits', { '@value': 1024, unit: 'MB' })).toBe(span('mdi-database', 'Bits', '1024 MB'));
	});

	it('count', () => {
		expect(toHtml('count', 1234)).toBe(span('mdi-counter', 'Count', '1,234'));
	});

	it('energy', () => {
		expect(toHtml('energy', { '@value': 250, unit: 'kcal' })).toBe(span('mdi-fire', 'Energy', '250 kcal'));
	});

	it('light', () => {
		expect(toHtml('light', { '@value': 500, unit: 'lx' })).toBe(span('mdi-white-balance-sunny', 'Light', '500 lx'));
	});

	it('temperature', () => {
		expect(toHtml('temperature', { '@value': 36.7, unit: 'C' })).toBe(span('mdi-fire', 'Temperature', '36.7 C'));
	});

	it('rating 0%', () => {
		expect(toHtml('rating', 0)).toBe(
			'<span class="text-no-wrap" title="0%">' +
				'<i class="mdi mdi-star-outline"></i>' +
				'<i class="mdi mdi-star-outline"></i>' +
				'<i class="mdi mdi-star-outline"></i>' +
				'<i class="mdi mdi-star-outline"></i>' +
				'<i class="mdi mdi-star-outline"></i>' +
				'</span>',
		);
	});

	it('rating 80%', () => {
		expect(toHtml('rating', 80)).toBe(
			'<span class="text-no-wrap" title="80%">' +
				'<i class="mdi mdi-star"></i>' +
				'<i class="mdi mdi-star"></i>' +
				'<i class="mdi mdi-star"></i>' +
				'<i class="mdi mdi-star"></i>' +
				'<i class="mdi mdi-star-outline"></i>' +
				'</span>',
		);
	});

	it('rating 100%', () => {
		expect(toHtml('rating', 100)).toBe(
			'<span class="text-no-wrap" title="100%">' +
				'<i class="mdi mdi-star"></i>' +
				'<i class="mdi mdi-star"></i>' +
				'<i class="mdi mdi-star"></i>' +
				'<i class="mdi mdi-star"></i>' +
				'<i class="mdi mdi-star"></i>' +
				'</span>',
		);
	});

	it('currency', () => {
		expect(toHtml('currency', 9.5)).toBe(span('mdi-currency-usd', 'Currency', '9.50'));
	});

	it('note', () => {
		expect(toHtml('note', 'hello world')).toBe('<span><i class="mdi mdi-comment-outline" title="Note"></i>&nbsp;hello world</span>');
	});

	it('author', () => {
		expect(toHtml('author', '123')).toBe(span('mdi-account', 'User', 'User 123'));
	});

	it('source', () => {
		expect(toHtml('source', { title: 'Blog', url: 'https://blog.example.com' })).toBe(
			'<span class="text-no-wrap"><i class="mdi mdi-open-in-new" title="Source"></i> <a href="/to?url=https://blog.example.com" target="_blank" rel="nofollow noopener noreferrer">Blog</a></span>',
		);
	});

	it('source with no title returns empty', () => {
		expect(toHtml('source', { url: 'https://example.com' })).toBe('');
	});
});
