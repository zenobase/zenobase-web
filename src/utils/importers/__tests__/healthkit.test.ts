import { describe, expect, it } from 'vitest';
import { parseHealthKit } from '../healthkit';

const mockDateParser = {
	parse(value: string, _format: string) {
		const ms = Date.parse(value) || 0;
		return {
			valueOf: () => ms,
			format: () => `2024-01-15T08:00:00.000+0000`,
		};
	},
};

describe('parseHealthKit', () => {
	it('parses step count data', () => {
		const csv = ['Start,Finish,Steps (count)', '15/Jan/2024 8:00:00,15/Jan/2024 9:00:00,5000'].join('\n');

		const events = parseHealthKit(csv, mockDateParser);
		expect(events).toHaveLength(1);
		expect(events[0].tag).toEqual(['Steps']);
		expect(events[0].count).toEqual([5000]);
	});

	it('parses weight data with unit', () => {
		const csv = ['Start,Finish,Body Mass (kg)', '15/Jan/2024 8:00:00,15/Jan/2024 8:00:01,70.5'].join('\n');

		const events = parseHealthKit(csv, mockDateParser);
		expect(events).toHaveLength(1);
		expect(events[0].tag).toEqual(['Body Mass']);
		expect(events[0].weight).toEqual([{ '@value': 70.5, unit: 'kg' }]);
	});

	it('parses heart rate data', () => {
		const csv = ['Start,Finish,Heart Rate (count/min)', '15/Jan/2024 8:00:00,15/Jan/2024 8:00:01,72'].join('\n');

		const events = parseHealthKit(csv, mockDateParser);
		expect(events[0].frequency).toEqual([{ '@value': 72, unit: 'bpm' }]);
	});

	it('skips zero values', () => {
		const csv = ['Start,Finish,Steps (count)', '15/Jan/2024 8:00:00,15/Jan/2024 9:00:00,0'].join('\n');

		const events = parseHealthKit(csv, mockDateParser);
		expect(events).toHaveLength(0);
	});

	it('groups values by tag within same time window', () => {
		const csv = ['Start,Finish,Blood Pressure (Diastolic) (mmHg),Blood Pressure (Systolic) (mmHg)', '15/Jan/2024 8:00:00,15/Jan/2024 8:00:01,80,120'].join('\n');

		const events = parseHealthKit(csv, mockDateParser);
		expect(events).toHaveLength(1);
		expect(events[0].tag).toEqual(['Blood Pressure']);
		expect(events[0].pressure).toEqual([
			{ '@value': 80, unit: 'mmHg' },
			{ '@value': 120, unit: 'mmHg' },
		]);
	});

	it('converts mcg to ug', () => {
		const csv = ['Start,Finish,Vitamin D (mcg)', '15/Jan/2024 8:00:00,15/Jan/2024 8:00:01,25'].join('\n');

		const events = parseHealthKit(csv, mockDateParser);
		expect(events[0].weight).toEqual([{ '@value': 25, unit: 'ug' }]);
	});

	it('converts percentage values', () => {
		const csv = ['Start,Finish,SpO2 (%)', '15/Jan/2024 8:00:00,15/Jan/2024 8:00:01,0.98'].join('\n');

		const events = parseHealthKit(csv, mockDateParser);
		expect(events[0].percentage).toEqual([98]);
	});
});
