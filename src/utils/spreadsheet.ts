export class Spreadsheet {
	headers: string[];
	records: unknown[][];

	constructor(headers: string[]) {
		this.headers = headers;
		this.records = [];
	}

	addHeader(header: string): void {
		this.headers.push(header);
	}

	addRecord(record: unknown[]): void {
		this.records.push(record);
	}

	mergeRecord(record: unknown[]): void {
		console.assert(record.length === 2);
		for (let i = 0; i < this.records.length; ++i) {
			if (this.records[i][0] === record[0]) {
				this.records[i].push(record.slice(1));
				return;
			}
			if ((this.records[i][0] as string) > (record[0] as string)) {
				this.records.splice(i, 0, [record[0], '', record[1]]);
				return;
			}
		}
		this.records.push([record[0], '', record[1]]);
	}

	toBlob(): Blob {
		let data = `${this.headers.join('\t')}\n`;
		for (const record of this.records) {
			data += `${record.join('\t')}\n`;
		}
		return new Blob([data], { type: 'text/plain' });
	}
}
