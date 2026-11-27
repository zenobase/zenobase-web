import Papa from 'papaparse';
import type { ZenoEvent } from '../../types';

export interface LibreViewSettings {
	tag: string;
	timezone: string;
}

export interface DateParser {
	parseTz(value: string, format: string, timezone: string): { format(fmt: string): string };
}

/** Skips readings without a numeric value, which the backend would reject. */
function addGlucose(event: ZenoEvent, value: string | undefined, type: string): boolean {
	const n = value?.trim() ? Number(value) : Number.NaN;
	if (!Number.isFinite(n)) return false;
	event['tag'] = ['Glucose', type];
	event['concentration'] = { '@value': n, unit: 'mg/dL' };
	return true;
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
		switch (row[3]) {
			case '0':
				if (!addGlucose(event, row[4], 'Historic')) continue;
				break;
			case '1':
				if (!addGlucose(event, row[5], 'Scan')) continue;
				break;
			case '2':
				if (!addGlucose(event, row[14], 'Strip')) continue;
				break;
			case '6':
				event['tag'] = ['Note'];
				event['note'] = row[13];
				break;
			default:
				continue;
		}
		events.push(event);
	}
	return events;
}
