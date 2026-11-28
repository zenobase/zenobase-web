import { describe, expect, it } from 'vitest';
import { compactNumber, param } from '../helpers';

describe('param', () => {
	it('serializes simple key-value pairs', () => {
		expect(param({ a: '1', b: '2' })).toBe('a=1&b=2');
	});

	it('skips null and undefined values', () => {
		expect(param({ a: '1', b: null, c: undefined })).toBe('a=1');
	});

	it('handles arrays with bracket notation', () => {
		expect(param({ a: ['1', '2'] })).toBe('a%5B%5D=1&a%5B%5D=2');
	});

	it('handles arrays with traditional mode', () => {
		expect(param({ a: ['1', '2'] }, true)).toBe('a=1&a=2');
	});

	it('returns empty string for empty object', () => {
		expect(param({})).toBe('');
	});
});

describe('compactNumber', () => {
	it.each([
		[999, '999'],
		[1500, '1.5k'],
		[-12345, '-12.3k'],
		[2_500_000, '2.5M'],
		['1200', '1.2k'],
		['n/a', 'n/a'],
	])('compacts %j to %j', (value, expected) => {
		expect(compactNumber(value)).toBe(expected);
	});
});
