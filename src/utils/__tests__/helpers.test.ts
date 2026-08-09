import { describe, expect, it } from 'vitest';
import { param } from '../helpers';

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
