import { describe, expect, it, vi } from 'vitest';
import { downloadCsv, toFilename, unwrapValue } from '../csv';

describe('unwrapValue', () => {
	it.each([
		[
			{ '@value': 70.5, unit: 'kg' },
			{ value: '70.5', unit: 'kg' },
		],
		[{ '@value': 3 }, { value: '3', unit: '' }],
		[42, { value: '42', unit: '' }],
		[null, { value: '', unit: '' }],
	])('unwraps %j', (input, expected) => {
		expect(unwrapValue(input)).toEqual(expected);
	});
});

describe('toFilename', () => {
	it.each([
		['Weight (kg) / day', 'Weight_kg_day'],
		['step-count_2026', 'step-count_2026'],
		['???', 'export'],
	])('turns %j into %j', (label, expected) => {
		expect(toFilename(label)).toBe(expected);
	});
});

describe('downloadCsv', () => {
	it('downloads the rows as a CSV file', async () => {
		let blob: Blob | undefined;
		vi.spyOn(URL, 'createObjectURL').mockImplementation((b) => {
			blob = b as Blob;
			return 'blob:1';
		});
		const revoke = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
		const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

		downloadCsv(
			[
				['date', 'count'],
				['2026-01-01', '3'],
			],
			'steps.csv',
		);

		expect(await blob?.text()).toBe('date,count\n2026-01-01,3');
		expect((click.mock.contexts[0] as HTMLAnchorElement).download).toBe('steps.csv');
		expect(revoke).toHaveBeenCalledWith('blob:1');
		expect(document.querySelector('a')).toBeNull();
	});
});
