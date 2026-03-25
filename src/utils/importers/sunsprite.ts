import { parseCSV } from './csv';

export interface SunSpriteSettings {
	tag: string;
	timezone: string;
}

export interface DateParser {
	parseTz(value: string, timezone: string): { format(fmt: string): string };
}

function mean(values: number[]): number {
	let sum = 0;
	for (const v of values) {
		if (v >= 0) sum += v;
	}
	return sum / values.length;
}

export function parseSunSprite(s: string, settings: SunSpriteSettings, dateParser: DateParser): Record<string, unknown>[] {
	const events: Record<string, unknown>[] = [];
	const csv = parseCSV(s);

	let hour: string | null = null;
	let rows = 0;
	let luxes: number[] = [];
	let uvs: number[] = [];

	function push() {
		const event: Record<string, unknown> = {
			timestamp: hour,
			duration: 3600000,
			tag: [settings.tag],
			source: { title: 'SunSprite', url: 'https://www.sunsprite.com/' },
		};
		const lux = mean(luxes);
		if (Number.isFinite(lux)) {
			event['light'] = { '@value': Math.round(lux), unit: 'lx' };
		}
		const uv = mean(uvs);
		if (Number.isFinite(uv)) {
			event['rating'] = Math.max(0, 100 - Math.round(10 * uv));
		}
		events.push(event);
		hour = null;
		rows = 0;
		luxes = [];
		uvs = [];
	}

	for (const row of csv.data) {
		const t = dateParser.parseTz(row['date'], settings.timezone);
		const h = t.format('YYYY-MM-DDTHH:00:00.000Z');
		if (hour && hour !== h) {
			push();
		}
		++rows;
		hour = h;
		luxes.push(Number(row['lux']));
		uvs.push(Number(row['uv index']));
	}
	if (hour && rows) {
		push();
	}
	return events;
}
