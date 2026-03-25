import Papa from 'papaparse';

export interface LibreViewSettings {
	tag: string;
	timezone: string;
}

export interface DateParser {
	parseTz(value: string, format: string, timezone: string): { format(fmt: string): string };
}

export function parseLibreView(s: string, settings: LibreViewSettings, dateParser: DateParser): Record<string, unknown>[] {
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

	const events: Record<string, unknown>[] = [];
	for (const row of result.data) {
		const t = dateParser.parseTz(row[2], 'MM-DD-YYYY LT', settings.timezone);
		const event: Record<string, unknown> = {
			timestamp: t.format('YYYY-MM-DDTHH:mm:00.000Z'),
			tag: [settings.tag],
			source: { title: row[0], url: 'https://www.libreview.com/' },
		};
		switch (row[3]) {
			case '0':
				event['tag'] = ['Glucose', 'Historic'];
				event['concentration'] = { '@value': Number(row[4]), unit: 'mg/dL' };
				break;
			case '1':
				event['tag'] = ['Glucose', 'Scan'];
				event['concentration'] = { '@value': Number(row[5]), unit: 'mg/dL' };
				break;
			case '2':
				event['tag'] = ['Glucose', 'Strip'];
				event['concentration'] = { '@value': Number(row[14]), unit: 'mg/dL' };
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
