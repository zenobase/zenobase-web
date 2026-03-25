import Papa from 'papaparse';

export interface CsvResult<T = Record<string, string>> {
	data: T[];
}

export function parseCSV<T = Record<string, string>>(s: string, options: { header: boolean } = { header: true }): CsvResult<T> {
	const result = Papa.parse<T>(s, { header: options.header, skipEmptyLines: true });
	if (result.errors.length) {
		const err = result.errors[0];
		throw new Error(`${err.message} in row ${err.row}`);
	}
	return { data: result.data };
}
