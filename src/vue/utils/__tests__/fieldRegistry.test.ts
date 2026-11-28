import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { getStoredUnits, getUnitOptions, getUnitsForField, NUMERIC_FIELDS } from '../fieldRegistry';

describe('getUnitOptions', () => {
	it('appends stored units that are not listed, once each', () => {
		const stored = [
			{ '@value': 10, unit: 'km/h' },
			{ '@value': 12, unit: 'km/h' },
			{ '@value': 3, unit: 'mph' },
		];
		expect(getUnitOptions('velocity', stored)).toEqual([...getUnitsForField('velocity'), 'km/h']);
	});
});

describe('getStoredUnits', () => {
	it('ignores stored values without a unit', () => {
		expect(getStoredUnits([42, 'x', null, { '@value': 1 }, { '@value': 2, unit: 'hPa' }])).toEqual(['hPa']);
	});
});

describe('API docs', () => {
	const docs = readFileSync(resolve(__dirname, '../../pages/ApiDocsPage.vue'), 'utf8');

	it.each(NUMERIC_FIELDS.filter((f) => f.units.length > 0))('list the $name units', ({ name, units }) => {
		const match = new RegExp(`"${name}" : \\{\\s*"@value" : <em>&lt;Number&gt;</em>,\\s*"unit" : (.+)`).exec(docs);
		expect(match, name).not.toBeNull();
		expect([...match![1].matchAll(/"([^"]+)"/g)].map((m) => m[1])).toEqual(units);
	});
});
