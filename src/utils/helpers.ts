export function deepExtend<T extends Record<string, unknown>>(target: T, ...sources: Array<Record<string, unknown> | null | undefined>): T {
	for (const source of sources) {
		if (source) {
			for (const key of Object.keys(source)) {
				const val = source[key];
				if (val && typeof val === 'object' && !Array.isArray(val) && Object.getPrototypeOf(val) === Object.prototype) {
					(target as Record<string, unknown>)[key] = deepExtend(((target as Record<string, unknown>)[key] as Record<string, unknown>) || {}, val as Record<string, unknown>);
				} else {
					(target as Record<string, unknown>)[key] = val;
				}
			}
		}
	}
	return target;
}

export function compactNumber(value: number | string): string {
	const n = typeof value === 'string' ? Number(value) : value;
	if (!Number.isFinite(n)) return String(value);
	const abs = Math.abs(n);
	if (abs >= 1_000_000) return `${+(n / 1_000_000).toPrecision(3)}M`;
	if (abs >= 1_000) return `${+(n / 1_000).toPrecision(3)}k`;
	return String(n);
}

export function param(obj: Record<string, unknown>, traditional?: boolean): string {
	const params = new URLSearchParams();
	for (const key of Object.keys(obj)) {
		const value = obj[key];
		if (value === null || value === undefined) {
			continue;
		}
		if (Array.isArray(value)) {
			for (const item of value) {
				params.append(traditional ? key : `${key}[]`, String(item));
			}
		} else {
			params.append(key, String(value));
		}
	}
	return params.toString();
}
