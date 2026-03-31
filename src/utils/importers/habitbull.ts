import type { ZenoEvent } from '../../types';
import { parseCSV } from './csv';

export interface DateParser {
	parse(value: string): { format(fmt: string): string };
}

export function parseHabitBull(s: string, dateParser: DateParser): ZenoEvent[] {
	const events: ZenoEvent[] = [];
	const csv = parseCSV(s);
	for (const row of csv.data) {
		const event: ZenoEvent = {
			timestamp: dateParser.parse(row['CalendarDate']).format('YYYY-MM-DDTHH:mm:ss.SSSZ'),
			tag: [row['HabitName']],
			count: Math.round(Number(row['Value'])),
		};
		if (row['CommentText']) {
			event['note'] = row['CommentText'];
		}
		events.push(event);
	}
	return events;
}
