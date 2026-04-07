import type { UnitValue } from '../../types';

export function unwrapValue(v: unknown): { value: string; unit: string } {
	if (typeof v === 'object' && v !== null && '@value' in v) {
		const uv = v as UnitValue;
		return { value: String(uv['@value']), unit: uv.unit ?? '' };
	}
	return { value: String(v ?? ''), unit: '' };
}

export function toFilename(label: string): string {
	return label.replace(/[^a-zA-Z0-9_-]+/g, '_').replace(/^_|_$/g, '') || 'export';
}

export function downloadCsv(rows: string[][], filename: string) {
	const blob = new Blob([rows.map((r) => r.join(',')).join('\n')], { type: 'text/csv;charset=utf-8' });
	const url = URL.createObjectURL(blob);
	const a = document.createElement('a');
	a.href = url;
	a.download = filename;
	document.body.appendChild(a);
	a.click();
	document.body.removeChild(a);
	URL.revokeObjectURL(url);
}
