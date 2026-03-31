import type { ZenoEvent } from '../../types';
import { parseCSV } from './csv';

export interface SleepyHeadSettings {
	tag: string;
	timezone: string;
}

export interface DateParser {
	parseTz(value: string, timezone: string): { valueOf(): number; format(fmt: string): string };
}

export function parseSleepyHead(s: string, settings: SleepyHeadSettings, dateParser: DateParser): ZenoEvent[] {
	const events: ZenoEvent[] = [];
	const csv = parseCSV(s);
	for (const row of csv.data) {
		const t0 = dateParser.parseTz(row['Start'], settings.timezone);
		const t1 = dateParser.parseTz(row['End'], settings.timezone);
		events.push({
			timestamp: [t0.format('YYYY-MM-DDTHH:mm:ss.SSSZ'), t1.format('YYYY-MM-DDTHH:mm:ss.SSSZ')],
			duration: t1.valueOf() - t0.valueOf(),
			tag: settings.tag,
			rating: Math.round(100 * Math.exp(-Number(row['AHI']) / 32)),
			pressure: { '@value': Number(row['Pressure  Avg']), unit: 'cm_wg' },
		});
	}
	return events;
}
