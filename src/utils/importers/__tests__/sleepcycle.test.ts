import { describe, expect, it } from 'vitest';
import { dateParser } from '../../../vue/utils/dateParser';
import { parseSleepCycle } from '../sleepcycle';

const header = 'Start;End;Sleep quality;Time in bed;Wake up;Sleep Notes;Heart rate;Activity (steps)';

describe('parseSleepCycle', () => {
	it('imports nights with quality, mood and notes', () => {
		const data = [header, '2026-03-01 23:15:00;2026-03-02 06:45:00;87%;7:30;:);Stressful day:Drank coffee;54;1200', '', '2026-03-02 22:00:00;2026-03-03 05:05:00;60%;7:05;;;0;0'].join('\r\n');

		const [first, second] = parseSleepCycle(data, dateParser);

		expect(first).toEqual({
			tag: ['sleep', 'stressful day', 'drank coffee'],
			timestamp: ['2026-03-01T23:15:00.000-08:00', '2026-03-02T06:45:00.000-08:00'],
			duration: 27000000,
			percentage: 87,
			rating: 100,
			source: { title: 'SleepCycle', url: 'https://www.sleepcycle.com/' },
		});
		expect(second).toMatchObject({ tag: ['sleep'], duration: 25500000, percentage: 60, rating: undefined });
	});

	it.each([
		[':|', 50],
		[':(', 0],
	])('maps the wake-up mood %s to a rating of %d', (mood, rating) => {
		const [event] = parseSleepCycle(`${header}\n2026-03-01 23:00:00;x;50%;8:00;${mood};`, dateParser);
		expect(event['rating']).toBe(rating);
	});

	it.each([
		['Start;End;Quality', 'Expected headers: Start, End, Sleep quality, Time in bed, Wake up, Sleep Notes'],
		[`${header}\n2026-03-01 23:00:00;x;50%`, 'Wrong number of fields'],
		[`${header}\n2026-03-01 23:00:00;x;50%;8h;;`, '8h is not a valid duration'],
		[`${header}\n2026-03-01 23:00:00;x;good;8:00;;`, 'good is not a valid sleep quality'],
		[`${header}\n2026-03-01 23:00:00;x;50%;8:00;:D;`, ':D is not a valid emoticon'],
	])('rejects %j', (data, message) => {
		expect(() => parseSleepCycle(data, dateParser)).toThrow(message);
	});
});
