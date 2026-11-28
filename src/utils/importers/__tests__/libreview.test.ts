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
		expect(events.map((e) => e['tag'])).toEqual([
			['Glucose', 'Historic'],
			['Glucose', 'Scan'],
			['Glucose', 'Strip'],
		]);
	});

	it('skips readings without a numeric value', () => {
		const events = parseLibreView([row('0', 4, ''), row('1', 5, 'n/a'), row('0', 4, '95')].join('\n'), { tag: 'x', timezone: 'UTC' }, dateParser);
		expect(events.map((e) => e['concentration'])).toEqual([{ '@value': 95, unit: 'mg/dL' }]);
	});

	it('skips the export headers, imports notes and ignores other record types', () => {
		const data = ['Export,2026-01-02', 'Meter,Serial Number,Device Timestamp,Record Type', row('6', 13, 'ate pasta'), row('5', 4, '1')].join('\n');

		const events = parseLibreView(data, { tag: 'x', timezone: 'UTC' }, dateParser);

		expect(events).toEqual([{ timestamp: '2026-01-01T00:00:00.000Z', tag: ['Note'], note: 'ate pasta', source: { title: 'FreeStyle', url: 'https://www.libreview.com/' } }]);
	});
});
