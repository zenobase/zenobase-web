import { describe, expect, it } from 'vitest';
import { Spreadsheet } from '../spreadsheet';

describe('Spreadsheet', () => {
	it('creates with headers', () => {
		const s = new Spreadsheet(['A', 'B']);
		expect(s.headers).toEqual(['A', 'B']);
		expect(s.records).toEqual([]);
	});

	it('adds a header', () => {
		const s = new Spreadsheet(['A']);
		s.addHeader('B');
		expect(s.headers).toEqual(['A', 'B']);
	});

	it('adds a record', () => {
		const s = new Spreadsheet(['A']);
		s.addRecord([1]);
		expect(s.records).toEqual([[1]]);
	});

	it('merges a record into empty spreadsheet', () => {
		const s = new Spreadsheet(['A', 'B']);
		s.mergeRecord(['x', 1]);
		expect(s.records).toEqual([['x', '', 1]]);
	});

	it('merges a record with matching key', () => {
		const s = new Spreadsheet(['A', 'B']);
		s.addRecord(['x', 1]);
		s.mergeRecord(['x', 2]);
		expect(s.records).toEqual([['x', 1, [2]]]);
	});

	it('converts to blob with tab-separated values', () => {
		const s = new Spreadsheet(['A', 'B']);
		s.addRecord([1, 2]);
		const blob = s.toBlob();
		expect(blob.type).toBe('text/plain');
	});
});
