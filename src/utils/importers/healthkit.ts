import type { ZenoEvent } from '../../types';
import { parseCSV } from './csv';

export interface DateParser {
	parse(value: string, format: string): { valueOf(): number; format(fmt: string): string };
}

export function parseHealthKit(s: string, dateParser: DateParser): ZenoEvent[] {
	const events: ZenoEvent[] = [];
	const csv = parseCSV(s);
	for (const row of csv.data) {
		const f = 'DD/MMM/YYYY H:mm:ss';
		const t0 = dateParser.parse(row['Start'], f);
		const t1 = dateParser.parse(row['Finish'], f);
		const duration = t1.valueOf() - t0.valueOf();
		const timestamp = t0.format('YYYY-MM-DDTHH:mm:ss.SSSZ');
		const eventsByTag: Record<string, ZenoEvent> = {};

		function push(tag: string, field: string, value: unknown) {
			let event = eventsByTag[tag];
			if (!event) {
				event = { timestamp, duration, tag: [tag] };
				events.push((eventsByTag[tag] = event));
			}
			const arr = (event[field] = event[field] || []) as unknown[];
			arr.push(value);
		}

		for (const field in row) {
			const value = Number(row[field]);
			const m = field.match(/(.+) \((.+?)\)/);
			if (m && !Number.isNaN(value) && value !== 0) {
				const tag = m[1].replace(/ \(.+\)/, '');
				const unit = m[2];
				switch (unit) {
					case 'count':
						push(tag, 'count', Math.round(value));
						break;
					case '%':
						push(tag, 'percentage', Math.round(100.0 * value));
						break;
					case 'mcg':
						push(tag, 'weight', { '@value': value, unit: 'ug' });
						break;
					case 'mg':
					case 'g':
					case 'kg':
					case 'lb':
						push(tag, 'weight', { '@value': value, unit });
						break;
					case 'L':
						push(tag, 'volume', { '@value': value, unit });
						break;
					case 'mg/dL':
						push(tag, 'concentration', { '@value': value, unit });
						break;
					case 'mmHg':
						push(tag, 'pressure', { '@value': value, unit });
						break;
					case 'degC':
						push(tag, 'temperature', { '@value': value, unit: 'C' });
						break;
					case 'cal':
					case 'kcal':
						push(tag, 'energy', { '@value': value, unit });
						break;
					case 'count/min':
						push(tag, 'frequency', { '@value': value, unit: 'bpm' });
						break;
				}
			}
		}
	}
	return events;
}
