import { describe, expect, it } from 'vitest';
import { dateParser } from '../dateParser';

describe('dateParser', () => {
	it('parses in the local timezone, with or without a format', () => {
		expect(dateParser.parse('2026-07-04 08:30').format()).toBe('2026-07-04T08:30:00-07:00');
		expect(dateParser.parse('04-07-2026', 'DD-MM-YYYY').format('YYYY-MM-DD')).toBe('2026-07-04');
	});

	it('parses in a given timezone', () => {
		expect(dateParser.parseTz('2026-07-04 08:30', 'Europe/Berlin').format()).toBe('2026-07-04T08:30:00+02:00');
		expect(dateParser.parseTz('07-04-2026 8:30 AM', 'MM-DD-YYYY h:mm A', 'Asia/Tokyo').format()).toBe('2026-07-04T08:30:00+09:00');
	});
});
