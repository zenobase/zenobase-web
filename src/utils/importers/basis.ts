import type { ZenoEvent } from '../../types';
import { parseCSV } from './csv';

export interface BasisSettings {
	tag: string;
}

export interface DateParser {
	parse(value: string): { format(fmt: string): string };
}

function meanOfNonZeroValues(values: number[]): number {
	let sum = 0;
	let count = 0;
	for (const v of values) {
		if (v) {
			++count;
			sum += v;
		}
	}
	return sum / count;
}

export function parseBasis(s: string, settings: BasisSettings, dateParser: DateParser): ZenoEvent[] {
	const events: ZenoEvent[] = [];
	const csv = parseCSV(s);

	let hour: string | null = null;
	let rows = 0;
	let count = 0;
	let energy = 0.0;
	let frequencies: number[] = [];
	let temperatures: number[] = [];

	function push() {
		const event: ZenoEvent = {
			timestamp: hour!,
			duration: 3600000,
			tag: [settings.tag],
			energy: { '@value': Math.round(10 * energy) / 10, unit: 'kcal' },
			count,
			source: { title: 'Basis', url: 'https://www.mybasis.com/' },
		};
		const frequency = meanOfNonZeroValues(frequencies);
		if (Number.isFinite(frequency)) {
			event['frequency'] = { '@value': Math.round(frequency), unit: 'bpm' };
		}
		const temperature = meanOfNonZeroValues(temperatures);
		if (Number.isFinite(temperature)) {
			event['temperature'] = { '@value': Math.round(10 * temperature) / 10, unit: 'F' };
		}
		events.push(event);
		hour = null;
		rows = 0;
		count = 0;
		energy = 0.0;
		frequencies = [];
		temperatures = [];
	}

	for (const row of csv.data) {
		const t = dateParser.parse(row['date']);
		const h = t.format('YYYY-MM-DDTHH:00:00.000Z');
		if (hour && hour !== h) {
			push();
		}
		++rows;
		hour = h;
		count += Number(row['steps'] || 0);
		energy += Number(row['calories'] || 0);
		if (row['heart-rate']) {
			frequencies.push(Number(row['heart-rate']));
		}
		if (row['skin-temp']) {
			temperatures.push(Number(row['skin-temp']));
		}
	}
	if (hour && rows) {
		push();
	}
	return events;
}
