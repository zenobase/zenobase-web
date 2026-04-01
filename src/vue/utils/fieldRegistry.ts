export interface FieldDefinition {
	name: string;
	type: 'text' | 'numeric' | 'object';
	units: string[];
	subfields?: string[];
}

export const TEXT_FIELDS: FieldDefinition[] = [
	{ name: 'tag', type: 'text', units: [] },
	{ name: 'resource', type: 'text', units: [] },
	{ name: 'author', type: 'text', units: [] },
	{ name: 'source', type: 'text', units: [] },
	{ name: 'note', type: 'text', units: [] },
];

export const NUMERIC_FIELDS: FieldDefinition[] = [
	{ name: 'distance', type: 'numeric', units: ['mi', 'yd', 'ft', 'in', 'km', 'm', 'cm', 'mm'] },
	{ name: 'distance/volume', type: 'numeric', units: ['mpg', 'kpl'] },
	{ name: 'height', type: 'numeric', units: ['mi', 'ft', 'in', 'km', 'm', 'cm', 'mm'] },
	{ name: 'weight', type: 'numeric', units: ['lb', 'oz', 'kg', 'g', 'mg', 'ug', 'ng', 'st'] },
	{ name: 'percentage', type: 'numeric', units: [] },
	{ name: 'volume', type: 'numeric', units: ['L', 'dL', 'cL', 'mL', 'gal', 'qt', 'pt', 'cups', 'fl_oz'] },
	{ name: 'concentration', type: 'numeric', units: ['g/L', 'mg/L', 'ug/L', 'ng/L', 'pg/L', 'g/dL', 'mg/dL', 'ug/dL', 'ng/dL', 'pg/dL', 'g/mL', 'mg/mL', 'ug/mL', 'ng/mL', 'pg/mL'] },
	{ name: 'pressure', type: 'numeric', units: ['Pa', 'hPa', 'kPa', 'mbar', 'bar', 'mmHg', 'inHg', 'psi', 'cm_wg'] },
	{ name: 'velocity', type: 'numeric', units: ['m/s', 'mph', 'kmh', 'kn', 'Mach'] },
	{ name: 'pace', type: 'numeric', units: ['s/km', 's/mi'] },
	{ name: 'duration', type: 'numeric', units: [] },
	{ name: 'frequency', type: 'numeric', units: ['bpm', 'rpm', 'Hz'] },
	{ name: 'bits', type: 'numeric', units: ['bit', 'B', 'KB', 'MB', 'GB', 'TB', 'PB', 'KiB', 'MiB', 'GiB', 'TiB', 'PiB'] },
	{ name: 'count', type: 'numeric', units: [] },
	{ name: 'energy', type: 'numeric', units: ['J', 'kJ', 'cal', 'kcal', 'kWh'] },
	{ name: 'light', type: 'numeric', units: ['lx'] },
	{ name: 'temperature', type: 'numeric', units: ['C', 'F', 'K'] },
	{ name: 'rating', type: 'numeric', units: [] },
	{ name: 'currency', type: 'numeric', units: [] },
	{ name: 'humidity', type: 'numeric', units: [] },
	{ name: 'sound', type: 'numeric', units: ['dB'] },
	{ name: 'moon', type: 'numeric', units: [] },
];

export const TIMESTAMP_FIELD: FieldDefinition = {
	name: 'timestamp',
	type: 'object',
	units: [],
	subfields: ['', 'min', 'max'],
};

export const TIMESTAMP_SUBFIELDS = TIMESTAMP_FIELD.subfields!.map((subfield) => ({
	label: subfield || '(default)',
	value: subfield ? 'timestamp$' + subfield : 'timestamp',
}));

export const TIMELINE_INTERVALS = [{ name: 'year' }, { name: 'month' }, { name: 'week' }, { name: 'day' }, { name: 'hour' }, { name: 'minute' }, { name: 'second' }];

export const POLAR_INTERVALS = [
	{ id: 'hour_of_day', label: 'hour of day' },
	{ id: 'day_of_week', label: 'day of week' },
	{ id: 'day_of_month', label: 'day of month' },
	{ id: 'month_of_year', label: 'month of year' },
];

export const REGRESSION_METHODS = ['linear'];

export function getUnitsForField(fieldName: string): string[] {
	const all = [...NUMERIC_FIELDS, TIMESTAMP_FIELD, ...TEXT_FIELDS];
	const field = all.find((f) => f.name === fieldName);
	return field?.units ?? [];
}

export function getNumericFieldNames(): string[] {
	return NUMERIC_FIELDS.map((f) => f.name).sort();
}

export function getTextFieldNames(): string[] {
	return TEXT_FIELDS.map((f) => f.name);
}

/**
 * Returns the list of numeric fields with timestamp prepended,
 * used for timeline/polar/scatterplot value selection.
 */
export function getNumericAndTimestampFieldNames(): string[] {
	return [TIMESTAMP_FIELD.name, ...getNumericFieldNames()];
}

export function getStatisticsForField(fieldName: string): string[] {
	return fieldName === 'timestamp' ? ['count'] : ['sum', 'avg', 'min', 'max'];
}
