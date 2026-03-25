import { parseCSV } from './csv';

export interface Nomie5Settings {
	field?: string;
	unit?: string;
}

export interface DateParser {
	parse(value: string): { utcOffset(offset: number): unknown; format(fmt: string): string };
}

export function parseNomie5(s: string, settings: Nomie5Settings, dateParser: DateParser): Record<string, unknown>[] {
	const events: Record<string, unknown>[] = [];
	const csv = parseCSV(s);
	for (const row of csv.data) {
		const t0 = dateParser.parse(row['start']);
		const t1 = dateParser.parse(row['end']);
		const offset = Number(row['offset']);
		if (Number.isFinite(offset)) {
			t0.utcOffset(-offset);
			t1.utcOffset(-offset);
		}
		const event: Record<string, unknown> = {
			timestamp: [t0.format('YYYY-MM-DDTHH:mm:ss.SSSZ'), t1.format('YYYY-MM-DDTHH:mm:ss.SSSZ')],
			tag: [] as string[],
		};
		if (row['tracker'] === '') continue;
		if (row['tracker'] !== 'Unknown') {
			(event['tag'] as string[]).push(row['tracker']);
		}
		const value = Number(row['value']);
		if (value && settings.field) {
			event[settings.field] = settings.unit ? { '@value': value, unit: settings.unit } : value;
		}
		if (row['lat']) {
			const lat = Number(row['lat']);
			const lon = Number(row['lng']);
			if (lat !== 0 || lon !== 0) {
				event['location'] = { lat, lon };
			}
		}
		events.push(event);
	}
	return events;
}
