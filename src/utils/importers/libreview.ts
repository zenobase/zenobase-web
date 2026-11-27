import Papa from 'papaparse';
import type { ZenoEvent } from '../../types';

export interface LibreViewSettings {
	tag: string;
	timezone: string;
}

export interface DateParser {
	parseTz(value: string, format: string, timezone: string): { format(fmt: string): string };
}

/** Record type → glucose column and tag. */
const GLUCOSE_TYPES = new Map<string, [number, string]>([
	['0', [4, 'Historic']],
	['1', [5, 'Scan']],
	['2', [14, 'Strip']],
]);

function parseFiniteNumber(s: string | undefined): number | undefined {
	const n = s?.trim() ? Number(s) : Number.NaN;
	return Number.isFinite(n) ? n : undefined;
}

export function parseLibreView(s: string, settings: LibreViewSettings, dateParser: DateParser): ZenoEvent[] {
	const lines = s.split('\n');
	if (lines.length > 0 && lines[0].startsWith('Export')) {
		lines.shift();
	}
	if (lines.length > 0 && lines[0].startsWith('Meter')) {
		lines.shift();
	}
	const cleaned = lines.join('\n');

	const result = Papa.parse<string[]>(cleaned, { header: false, skipEmptyLines: true });
	if (result.errors.length) {
		const err = result.errors[0];
		throw new Error(`${err.message} in row ${err.row}`);
	}

	const events: ZenoEvent[] = [];
	for (const row of result.data) {
		const t = dateParser.parseTz(row[2], 'MM-DD-YYYY LT', settings.timezone);
		const event: ZenoEvent = {
			timestamp: t.format('YYYY-MM-DDTHH:mm:00.000Z'),
			tag: [settings.tag],
			source: { title: row[0], url: 'https://www.libreview.com/' },
		};
		const glucose = GLUCOSE_TYPES.get(row[3]);
		if (glucose) {
			const value = parseFiniteNumber(row[glucose[0]]);
			// the backend rejects non-numeric values
			if (value === undefined) continue;
			event['tag'] = ['Glucose', glucose[1]];
			event['concentration'] = { '@value': value, unit: 'mg/dL' };
		} else if (row[3] === '6') {
			event['tag'] = ['Note'];
			event['note'] = row[13];
		} else {
			continue;
		}
		events.push(event);
	}
	return events;
}
