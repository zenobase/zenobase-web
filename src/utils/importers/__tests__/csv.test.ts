import { describe, expect, it } from 'vitest';
import { parseCSV } from '../csv';

describe('parseCSV', () => {
	it('parses rows by header and skips blank lines', () => {
		expect(parseCSV('tag,note\nrun,"5k, easy"\n\n').data).toEqual([{ tag: 'run', note: '5k, easy' }]);
	});

	it('parses a single-column file', () => {
		expect(parseCSV('tag\nrun').data).toEqual([{ tag: 'run' }]);
	});

	it('reports the first malformed row', () => {
		expect(() => parseCSV('tag,note\nrun,"unterminated')).toThrow('Quoted field unterminated in row 1');
	});
});
