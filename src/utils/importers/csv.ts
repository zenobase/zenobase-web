import Papa from 'papaparse';

export interface CsvResult<T = Record<string, string>> {
	data: T[];
}

export function parseCSV<T = Record<string, string>>(s: string, options: { header: boolean } = { header: true }): CsvResult<T> {
	const result = Papa.parse<T>(s, { header: options.header, skipEmptyLines: true });
	// a single-column file has no delimiter to detect, but still parses fine
	const errors = result.errors.filter((e) => e.code !== 'UndetectableDelimiter');
	if (errors.length) {
		const err = errors[0];
		throw new Error(`${err.message} in row ${err.row}`);
	}
	return { data: result.data };
}
