import type { ZenoEvent } from '../../types';
import { parseCSV } from './csv';

export interface MoodPandaSettings {
	tag: string;
	timezone: string;
}

export interface DateParser {
	parseTz(value: string, format: string, timezone: string): { format(fmt: string): string };
}

export function parseMoodPanda(s: string, settings: MoodPandaSettings, dateParser: DateParser): ZenoEvent[] {
	const events: ZenoEvent[] = [];
	const csv = parseCSV(s);
	for (const row of csv.data) {
		const event: ZenoEvent = {
			timestamp: dateParser.parseTz(row['Date'], 'DD/MM/YYYY HH:mm:ss', settings.timezone).format('YYYY-MM-DDTHH:mm:ss.SSSZ'),
			tag: [settings.tag],
			rating: Number(row['Rating']) * 10,
		};
		if (row['Reason']) {
			event['note'] = row['Reason'];
		}
		events.push(event);
	}
	return events;
}
