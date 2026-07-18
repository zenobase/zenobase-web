import { describe, expect, it } from 'vitest';
import { Interval } from '../interval';

const [YEAR, MONTH, WEEK, DAY, HOUR, MINUTE, SECOND] = Interval.VALUES;

describe('Interval.VALUES', () => {
	it('defines the seven intervals in descending order', () => {
		expect(Interval.VALUES.map((i) => i.name)).toEqual(['year', 'month', 'week', 'day', 'hour', 'minute', 'second']);
	});

	it('wires the zoom-in chain', () => {
		expect(YEAR.zoomIn).toBe(MONTH);
		expect(MONTH.zoomIn).toBe(DAY);
		expect(WEEK.zoomIn).toBe(DAY);
		expect(DAY.zoomIn).toBe(HOUR);
		expect(HOUR.zoomIn).toBe(MINUTE);
		expect(MINUTE.zoomIn).toBe(SECOND);
		expect(SECOND.zoomIn).toBeUndefined();
	});
});

describe('Interval.match', () => {
	it('returns the next level to zoom into for each bucket-key length', () => {
		expect(Interval.match('2024-01')).toBe(DAY); // month -> day
		expect(Interval.match('2024-W01')).toBe(DAY); // week -> day
		expect(Interval.match('2024-01-01')).toBe(HOUR); // day -> hour
		expect(Interval.match('2024-01-01T00')).toBe(MINUTE); // hour -> minute
		expect(Interval.match('2024-01-01T00:00')).toBe(SECOND); // minute -> second
	});

	it('returns undefined at the finest bucket (second has no zoom-in)', () => {
		expect(Interval.match('2024-01-01T00:00:00')).toBeUndefined();
	});

	it('does not match a bare year (loop starts at month)', () => {
		expect(Interval.match('2024')).toBeUndefined();
	});

	it('ignores values carrying a timezone offset', () => {
		expect(Interval.match('2024-01-01T00:00:00Z')).toBeUndefined();
		expect(Interval.match('2024-01-01T00:00-05:00')).toBeUndefined();
	});

	it('returns undefined for non-date strings', () => {
		expect(Interval.match('hello')).toBeUndefined();
		expect(Interval.match('')).toBeUndefined();
	});
});

describe('Interval.matchRange', () => {
	it('matches the interval of the range start', () => {
		expect(Interval.matchRange('[2024..2025]')).toBe(YEAR);
		expect(Interval.matchRange('[2024-01-01..2024-02-01]')).toBe(DAY);
	});

	it('uses the open end when the start is a wildcard', () => {
		expect(Interval.matchRange('[*..2024-02-01]')).toBe(DAY);
	});

	it('uses the start when the end is a wildcard', () => {
		expect(Interval.matchRange('[2024-01-01..*]')).toBe(DAY);
	});

	it('returns undefined when there is no range', () => {
		expect(Interval.matchRange('2024-01-01')).toBeUndefined();
	});

	it('ignores a timezone-qualified range start', () => {
		expect(Interval.matchRange('[2024-01-01T00:00:00Z..2024-02-01T00:00:00Z]')).toBeUndefined();
	});
});

describe('Interval.matchSymbol', () => {
	it('maps each symbol to its interval', () => {
		expect(Interval.matchSymbol('y')).toBe(YEAR);
		expect(Interval.matchSymbol('M')).toBe(MONTH);
		expect(Interval.matchSymbol('w')).toBe(WEEK);
		expect(Interval.matchSymbol('d')).toBe(DAY);
		expect(Interval.matchSymbol('h')).toBe(HOUR);
		expect(Interval.matchSymbol('m')).toBe(MINUTE);
		expect(Interval.matchSymbol('s')).toBe(SECOND);
	});

	it('distinguishes month (M) from minute (m) case-sensitively', () => {
		expect(Interval.matchSymbol('1M')).toBe(MONTH);
		expect(Interval.matchSymbol('1m')).toBe(MINUTE);
	});

	it('returns undefined for an empty value', () => {
		expect(Interval.matchSymbol('')).toBeUndefined();
	});
});

describe('Interval.findByName', () => {
	it('finds an interval by name', () => {
		expect(Interval.findByName('year')).toBe(YEAR);
		expect(Interval.findByName('second')).toBe(SECOND);
	});

	it('returns undefined for an unknown or empty name', () => {
		expect(Interval.findByName('decade')).toBeUndefined();
		expect(Interval.findByName('')).toBeUndefined();
	});
});
