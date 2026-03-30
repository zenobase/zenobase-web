import type { DurationInputArg1, DurationInputArg2 } from 'moment';

export interface DateParser {
	parse(value: string): { add(amount: DurationInputArg1, unit?: DurationInputArg2): unknown; format(fmt: string): string };
}

function parseTimeInBed(value: string): number {
	const m = /(\d+):(\d+)/.exec(value);
	if (m) {
		return Number.parseInt(m[1], 10) * 60 * 60 * 1000 + Number.parseInt(m[2], 10) * 60 * 1000;
	}
	throw new Error(`${value} is not a valid duration`);
}

function parseSleepQuality(value: string): number {
	const m = /(\d+)%/.exec(value);
	if (m) {
		return Number.parseInt(m[1], 10);
	}
	throw new Error(`${value} is not a valid sleep quality`);
}

function parseWakeUp(value: string): number | undefined {
	if (!value) return undefined;
	if (value === ':)') return 100;
	if (value === ':|') return 50;
	if (value === ':(') return 0;
	throw new Error(`${value} is not a valid emoticon`);
}

function parseSleepNotes(values: string): string[] {
	const tags = ['sleep'];
	if (values) {
		for (const value of values.split(':')) {
			tags.push(value.toLowerCase());
		}
	}
	return tags;
}

export function parseSleepCycle(data: string, dateParser: DateParser): Record<string, unknown>[] {
	const events: Record<string, unknown>[] = [];
	const lines = data.split(/[\r\n]+/g);
	const expected = ['Start', 'End', 'Sleep quality', 'Time in bed', 'Wake up', 'Sleep Notes'];
	const headers = (lines.shift() ?? '').split(';').slice(0, 6);
	if (headers.length !== expected.length || headers.some((h, i) => h !== expected[i])) {
		throw new Error(`Expected headers: ${expected.join(', ')}`);
	}
	for (const line of lines) {
		const fields = line.split(';');
		if (line.trim()) {
			if (fields.length < expected.length) {
				throw new Error('Wrong number of fields');
			}
			const begin = dateParser.parse(fields[0]);
			const duration = parseTimeInBed(fields[3]);
			const event: Record<string, unknown> = {
				tag: parseSleepNotes(fields[5]),
				timestamp: [begin.format('YYYY-MM-DDTHH:mm:ss.SSSZ'), (begin.add(duration, 'ms') as { format(f: string): string }).format('YYYY-MM-DDTHH:mm:ss.SSSZ')],
				duration,
				percentage: parseSleepQuality(fields[2]),
				rating: parseWakeUp(fields[4]),
				source: { title: 'SleepCycle', url: 'https://www.sleepcycle.com/' },
			};
			events.push(event);
		}
	}
	return events;
}
