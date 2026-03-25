import { describe, expect, it } from 'vitest';
import { deepExtend, param } from '../helpers';

describe('deepExtend', () => {
	it('copies properties from source to target', () => {
		const target = { a: 1 };
		const result = deepExtend(target, { b: 2 });
		expect(result).toEqual({ a: 1, b: 2 });
		expect(result).toBe(target);
	});

	it('deeply merges nested objects', () => {
		const target = { a: { x: 1 } };
		const result = deepExtend(target, { a: { y: 2 } });
		expect(result).toEqual({ a: { x: 1, y: 2 } });
	});

	it('overwrites non-object values', () => {
		const target = { a: 1 };
		const result = deepExtend(target, { a: 2 });
		expect(result).toEqual({ a: 2 });
	});

	it('does not deep-merge arrays', () => {
		const target = { a: [1, 2] };
		const result = deepExtend(target, { a: [3] });
		expect(result).toEqual({ a: [3] });
	});

	it('handles multiple sources', () => {
		const result = deepExtend({}, { a: 1 }, { b: 2 });
		expect(result).toEqual({ a: 1, b: 2 });
	});

	it('skips null and undefined sources', () => {
		const result = deepExtend({ a: 1 }, null, undefined, { b: 2 });
		expect(result).toEqual({ a: 1, b: 2 });
	});
});

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
