import { describe, expect, it } from 'vitest';
import { parseLibreView } from '../libreview';

const dateParser = { parseTz: () => ({ format: () => '2026-01-01T00:00:00.000Z' }) };

function row(type: string, column: number, value: string): string {
	const cells = Array(19).fill('');
	cells[0] = 'FreeStyle';
	cells[2] = '01-01-2026 12:00 AM';
	cells[3] = type;
	cells[column] = value;
	return cells.join(',');
}

describe('parseLibreView', () => {
	it('imports glucose readings', () => {
		const events = parseLibreView([row('0', 4, '95'), row('1', 5, '102'), row('2', 14, '88')].join('\n'), { tag: 'x', timezone: 'UTC' }, dateParser);
		expect(events.map((e) => e['concentration'])).toEqual([
			{ '@value': 95, unit: 'mg/dL' },
			{ '@value': 102, unit: 'mg/dL' },
			{ '@value': 88, unit: 'mg/dL' },
		]);
		expect(events[1]['tag']).toEqual(['Glucose', 'Scan']);
	});

	it('skips readings without a numeric value', () => {
		const events = parseLibreView([row('0', 4, ''), row('1', 5, 'n/a'), row('0', 4, '95')].join('\n'), { tag: 'x', timezone: 'UTC' }, dateParser);
		expect(events.map((e) => e['concentration'])).toEqual([{ '@value': 95, unit: 'mg/dL' }]);
	});
});
