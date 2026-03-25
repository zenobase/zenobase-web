import { describe, expect, it } from 'vitest';
import { Constraint } from '../constraint';

describe('Constraint', () => {
	it('converts to string', () => {
		const c = new Constraint('tag', 'sleep');
		expect(c.toString()).toBe('tag:sleep');
	});

	it('converts negated constraint to string', () => {
		const c = new Constraint('tag', 'sleep', true);
		expect(c.toString()).toBe('-tag:sleep');
	});

	it('converts constraint with subfield to string', () => {
		const c = new Constraint('weight', '70', false, 'kg');
		expect(c.toString()).toBe('weight$kg:70');
	});

	it('inverts a constraint', () => {
		const c = new Constraint('tag', 'sleep');
		const inverted = c.invert();
		expect(inverted.negated).toBe(true);
		expect(inverted.toString()).toBe('-tag:sleep');
	});

	it('inverts a negated constraint', () => {
		const c = new Constraint('tag', 'sleep', true);
		expect(c.invert().negated).toBe(false);
	});

	it('returns short value for simple values', () => {
		const c = new Constraint('tag', 'sleep');
		expect(c.shortValue()).toBe('sleep');
	});

	it('truncates OR values', () => {
		const c = new Constraint('tag', 'sleep OR nap OR rest');
		expect(c.shortValue()).toBe('sleep...');
	});

	describe('parse', () => {
		it('parses a simple constraint', () => {
			const c = Constraint.parse('tag:sleep');
			expect(c.field).toBe('tag');
			expect(c.value).toBe('sleep');
			expect(c.negated).toBe(false);
			expect(c.subfield).toBeNull();
		});

		it('parses a negated constraint', () => {
			const c = Constraint.parse('-tag:sleep');
			expect(c.field).toBe('tag');
			expect(c.value).toBe('sleep');
			expect(c.negated).toBe(true);
		});

		it('parses a constraint with subfield', () => {
			const c = Constraint.parse('weight$kg:70');
			expect(c.field).toBe('weight');
			expect(c.subfield).toBe('kg');
			expect(c.value).toBe('70');
		});

		it('parses a constraint with colon in value', () => {
			const c = Constraint.parse('timestamp:2024-01-01T00:00:00');
			expect(c.field).toBe('timestamp');
			expect(c.value).toBe('2024-01-01T00:00:00');
		});

		it('throws on invalid constraint', () => {
			expect(() => Constraint.parse('invalid')).toThrow("Can't parse constraint");
		});

		it('throws on empty field', () => {
			expect(() => Constraint.parse(':value')).toThrow("Can't parse constraint");
		});
	});

	it('roundtrips through toString and parse', () => {
		const original = new Constraint('weight', '70', true, 'kg');
		const parsed = Constraint.parse(original.toString());
		expect(parsed.field).toBe(original.field);
		expect(parsed.value).toBe(original.value);
		expect(parsed.negated).toBe(original.negated);
		expect(parsed.subfield).toBe(original.subfield);
	});
});
