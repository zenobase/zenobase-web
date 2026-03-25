import { describe, expect, it } from 'vitest';
import { parseTapLog } from '../taplog';

describe('parseTapLog', () => {
	it('parses basic CSV data', () => {
		const csv = ['timestamp,cat1,cat2,cat3,cat4,cat5,cat6,cat7,cat8,cat9,number,note,latitude,longitude', '2024-01-15T08:00:00Z,coffee,,,,,,,,,,morning,0,0'].join('\n');

		const events = parseTapLog(csv);
		expect(events).toHaveLength(1);
		expect(events[0].timestamp).toBe('2024-01-15T08:00:00Z');
		expect(events[0].tag).toEqual(['coffee']);
		expect(events[0].note).toBe('morning');
	});

	it('parses multiple categories', () => {
		const csv = ['timestamp,cat1,cat2,cat3,cat4,cat5,cat6,cat7,cat8,cat9,number,note,latitude,longitude', '2024-01-15T08:00:00Z,food,breakfast,,,,,,,,,,,'].join('\n');

		const events = parseTapLog(csv);
		expect(events[0].tag).toEqual(['food', 'breakfast']);
	});

	it('maps numeric field with unit', () => {
		const csv = ['timestamp,cat1,cat2,cat3,cat4,cat5,cat6,cat7,cat8,cat9,number,note,latitude,longitude', '2024-01-15T08:00:00Z,weight,,,,,,,,,70,,,'].join('\n');

		const events = parseTapLog(csv, { field: 'weight', unit: 'kg' });
		expect(events[0].weight).toEqual({ '@value': 70, unit: 'kg' });
	});

	it('maps rating field with 20x multiplier', () => {
		const csv = ['timestamp,cat1,cat2,cat3,cat4,cat5,cat6,cat7,cat8,cat9,number,note,latitude,longitude', '2024-01-15T08:00:00Z,mood,,,,,,,,,4,,,'].join('\n');

		const events = parseTapLog(csv, { field: 'rating' });
		expect(events[0].rating).toBe(80);
	});

	it('parses location', () => {
		const csv = ['timestamp,cat1,cat2,cat3,cat4,cat5,cat6,cat7,cat8,cat9,number,note,latitude,longitude', '2024-01-15T08:00:00Z,run,,,,,,,,,,,47.6,-122.3'].join('\n');

		const events = parseTapLog(csv);
		expect(events[0].location).toEqual({ lat: 47.6, lon: -122.3 });
	});

	it('skips zero location', () => {
		const csv = ['timestamp,cat1,cat2,cat3,cat4,cat5,cat6,cat7,cat8,cat9,number,note,latitude,longitude', '2024-01-15T08:00:00Z,run,,,,,,,,,,,0,0'].join('\n');

		const events = parseTapLog(csv);
		expect(events[0].location).toBeUndefined();
	});
});
