import type { ZenoEvent } from '../../types';
import { parseCSV } from './csv';

export interface TapLogSettings {
	field?: string;
	unit?: string;
}

export function parseTapLog(s: string, settings: TapLogSettings = {}): ZenoEvent[] {
	const events: ZenoEvent[] = [];
	const csv = parseCSV(s);
	for (const row of csv.data) {
		const event: ZenoEvent = {
			timestamp: row['timestamp'],
			tag: [] as string[],
		};
		for (let i = 1; i < 10; ++i) {
			const category = row[`cat${i}`];
			if (category) {
				(event['tag'] as string[]).push(category);
			}
		}
		if (settings.field && row['number']) {
			let value = Number(row['number']);
			if (settings.field === 'rating') {
				value *= 20;
			}
			event[settings.field] = settings.unit ? { '@value': value, unit: settings.unit } : value;
		}
		if (row['note']) {
			event['note'] = row['note'];
		}
		if (row['latitude']) {
			const lat = Number(row['latitude']);
			const lon = Number(row['longitude']);
			if (lat !== 0 || lon !== 0) {
				event['location'] = { lat, lon };
			}
		}
		events.push(event);
	}
	return events;
}
