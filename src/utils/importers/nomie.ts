import type { ZenoEvent } from '../../types';
import { parseCSV } from './csv';

export interface NomieSettings {
	field?: string;
	unit?: string;
}

export interface DateParser {
	parse(value: string): { utcOffset(offset: number): unknown; format(fmt: string): string };
}

interface NomieJsonData {
	trackers: Array<{ _id: string; label: string; groups?: Array<string | null> }>;
	ticks: Array<NomieJsonItem>;
	notes: Array<NomieJsonItem>;
}

interface NomieJsonItem {
	time: number;
	offset: number;
	parent: string;
	charge: string;
	geo: number[];
	value: string | number;
}

function parseJSON(s: string, settings: NomieSettings, dateParser: DateParser): ZenoEvent[] {
	const events: ZenoEvent[] = [];
	const data: NomieJsonData = JSON.parse(s);
	const tags: Record<string, string[]> = {};

	for (const tracker of data.trackers) {
		tags[tracker._id] = [tracker.label];
		if (tracker.groups) {
			for (const group of tracker.groups) {
				if (group) {
					tags[tracker._id].push(group);
				}
			}
		}
	}

	const add = (item: NomieJsonItem) => {
		const t = dateParser.parse(String(item.time));
		const formatted = (t.utcOffset(-item.offset) as { format(f: string): string }).format('YYYY-MM-DDTHH:mm:ss.SSSZ');
		const event: ZenoEvent = {
			timestamp: formatted,
			tag: tags[item.parent],
			rating: (Number(item.charge) + 3) * 20,
		};
		if (item.geo.length === 2) {
			event['location'] = { lat: Number(item.geo[0]), lon: Number(item.geo[1]) };
		}
		if (typeof item.value === 'string') {
			event['note'] = item.value;
		} else if (typeof item.value === 'number' && settings.field) {
			event[settings.field] = settings.unit ? { '@value': item.value, unit: settings.unit } : item.value;
		}
		events.push(event);
	};

	for (const tick of data.ticks) add(tick);
	for (const note of data.notes) add(note);
	return events;
}

function parseNomieCSV(s: string, settings: NomieSettings, dateParser: DateParser): ZenoEvent[] {
	const events: ZenoEvent[] = [];
	const csv = parseCSV(s);
	for (const row of csv.data) {
		const t = dateParser.parse(row['iso_date']);
		const offset = Number(row['offset']);
		if (Number.isFinite(offset)) {
			t.utcOffset(-offset);
		}
		const timestamp = t.format('YYYY-MM-DDTHH:mm:ss.SSSZ');
		const event: ZenoEvent = { timestamp, tag: [] as string[] };
		if (row['tracker'] === '') return events;
		if (row['tracker'] !== 'Unknown') {
			(event['tag'] as string[]).push(row['tracker']);
		}
		if (row['charge'] !== undefined) {
			event['rating'] = (Number(row['charge']) + 3) * 20;
		}
		const value = Number(row['value']);
		if (value && settings.field) {
			event[settings.field] = settings.unit ? { '@value': value, unit: settings.unit } : value;
		}
		if (row['lat']) {
			const lat = Number(row['lat']);
			const lon = Number(row['long']);
			if (lat !== 0 || lon !== 0) {
				event['location'] = { lat, lon };
			}
		}
		events.push(event);
	}
	return events;
}

export function parseNomie(s: string, settings: NomieSettings, dateParser: DateParser): ZenoEvent[] {
	return s.charAt(0) === '{' ? parseJSON(s, settings, dateParser) : parseNomieCSV(s, settings, dateParser);
}
