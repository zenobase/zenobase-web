import type { ResourceRef, UnitValue, ZenoEvent } from '../../types';
import { formatAge } from './formatAge';
import { getUserName } from './userNames';

function esc(value: unknown): string {
	const div = document.createElement('div');
	div.textContent = String(value ?? '');
	return div.innerHTML;
}

function textWithUnit(value: unknown): string {
	if (typeof value === 'object' && value !== null && '@value' in value) {
		const obj = value as UnitValue;
		return obj['@value'] + ' ' + (obj.unit || '');
	}
	return String(value);
}

function formatDuration(ms: number): string {
	const parts: string[] = [];
	const totalSec = Math.floor(ms / 1000);
	const d = Math.floor(totalSec / 86400);
	const h = Math.floor((totalSec % 86400) / 3600);
	const m = Math.floor((totalSec % 3600) / 60);
	const s = totalSec % 60;
	if (d) parts.push(d + 'd');
	if (h) parts.push(h + 'h');
	if (m) parts.push(m + 'min');
	if (s && parts.length < 2) parts.push(s + 's');
	if (parts.length === 0) parts.push(ms + 'ms');
	return parts.slice(0, 2).join(' ');
}

function ratingStarsHtml(value: number): string {
	const stars = Math.round((value || 0) / 20);
	let html = '<span class="text-no-wrap" title="' + value + '%">';
	for (let i = 0; i < 5; ++i) {
		html += '<i class="mdi ' + (stars > i ? 'mdi-star' : 'mdi-star-outline') + '"></i>';
	}
	html += '</span>';
	return html;
}

function formatPace(value: unknown): string {
	if (typeof value === 'object' && value !== null && '@value' in value) {
		const obj = value as UnitValue;
		const unit = obj.unit || '';
		if (!unit.startsWith('s/')) return textWithUnit(value);
		const totalSec = Number(obj['@value']);
		const min = Math.floor(totalSec / 60);
		const sec = Math.round(totalSec % 60);
		return min + "'" + sec + '"/' + unit.substring(2);
	}
	return String(value);
}

function locationText(value: { lat: number; lon: number }): string {
	return Math.round(Number(value['lat']) * 1000) / 1000 + ', ' + Math.round(Number(value['lon']) * 1000) / 1000;
}

function ic(icon: string, title: string): string {
	return '<i class="mdi ' + icon + '" title="' + title + '"></i>';
}

type ToHtmlFn = (value: unknown, icon: string, title: string) => string;
type FieldDef = { name: string; icon: string; title: string; toHtml: (value: unknown) => string };

function field(name: string, icon: string, title: string, toHtml: ToHtmlFn): FieldDef {
	return { name, icon, title, toHtml: (v) => toHtml(v, icon, title) };
}

function simple(name: string, icon: string, title: string, format: (v: unknown) => string): FieldDef {
	return field(name, icon, title, (v, i, t) => '<span class="text-no-wrap">' + ic(i, t) + ' ' + format(v) + '</span>');
}

export const FIELD_REGISTRY: FieldDef[] = [
	simple('tag', 'mdi-tag', 'Tag', (v) => esc(v)),
	field('resource', 'mdi-bookmark', 'Resource', (v, i, t) => {
		const obj = v as ResourceRef;
		if (!obj || !obj.title) return '';
		return '<span>' + ic(i, t) + '&nbsp;<a href="/to?url=' + esc(obj.url) + '" target="_blank" rel="nofollow noopener noreferrer">' + esc(obj['title']) + '</a></span>';
	}),
	simple('distance', 'mdi-arrow-left-right', 'Distance', (v) => esc(textWithUnit(v))),
	simple('height', 'mdi-arrow-up-down', 'Height', (v) => esc(textWithUnit(v))),
	simple('weight', 'mdi-weight', 'Weight', (v) => esc(textWithUnit(v))),
	field('percentage', 'mdi-view-grid', 'Percentage', (v, i, t) => {
		const n = Number(v);
		return '<span class="text-no-wrap">' + ic(i, t) + ' <abbr title="' + n + '%">' + Math.round(n) + '%</abbr></span>';
	}),
	simple('moon', 'mdi-moon-waning-crescent', 'Moon', (v) => v + '%'),
	simple('volume', 'mdi-cup', 'Volume', (v) => esc(textWithUnit(v))),
	simple('concentration', 'mdi-water', 'Concentration', (v) => esc(textWithUnit(v))),
	simple('distance/volume', 'mdi-gas-station', 'Distance/Volume', (v) => esc(textWithUnit(v))),
	simple('humidity', 'mdi-water', 'Humidity', (v) => v + '%'),
	simple('pressure', 'mdi-arrow-expand-all', 'Pressure', (v) => esc(textWithUnit(v))),
	simple('sound', 'mdi-volume-high', 'Sound Level', (v) => esc(textWithUnit(v))),
	field('location', 'mdi-map-marker', 'Location', (v, i, t) => {
		const obj = v as { lat: number; lon: number };
		if (!obj || !('lat' in obj)) return '';
		const text = locationText(obj);
		return '<span class="text-no-wrap">' + ic(i, t) + ' ' + esc(text) + '</span>';
	}),
	field(
		'timestamp',
		'mdi-calendar-outline',
		'Timestamp',
		(v, i, t) => '<span class="text-no-wrap">' + ic(i, t) + ' <abbr title="' + esc(v) + '">' + esc(formatAge(String(v), 79200000)) + '</abbr></span>',
	),
	simple('velocity', 'mdi-speedometer', 'Velocity', (v) => esc(textWithUnit(v))),
	simple('pace', 'mdi-timer-outline', 'Pace', (v) => esc(formatPace(v))),
	field('duration', 'mdi-clock-outline', 'Duration', (v, i, t) => {
		const ms = typeof v === 'number' ? v : typeof v === 'object' && v !== null && '@value' in v ? Number((v as UnitValue)['@value']) : 0;
		return '<span class="text-no-wrap">' + ic(i, t) + ' <abbr>' + esc(formatDuration(ms)) + '</abbr></span>';
	}),
	simple('frequency', 'mdi-heart', 'Frequency', (v) => esc(textWithUnit(v))),
	simple('bits', 'mdi-database', 'Bits', (v) => esc(textWithUnit(v))),
	simple('count', 'mdi-counter', 'Count', (v) => Number(v).toLocaleString()),
	simple('energy', 'mdi-fire', 'Energy', (v) => esc(textWithUnit(v))),
	simple('light', 'mdi-white-balance-sunny', 'Light', (v) => esc(textWithUnit(v))),
	simple('temperature', 'mdi-fire', 'Temperature', (v) => esc(textWithUnit(v))),
	{ name: 'rating', icon: 'mdi-star', title: 'Rating', toHtml: (v) => ratingStarsHtml(Number(v)) },
	simple('currency', 'mdi-currency-usd', 'Currency', (v) => Number(v).toFixed(2)),
	field('note', 'mdi-comment-outline', 'Note', (v, i, t) => '<span>' + ic(i, t) + '&nbsp;' + esc(v) + '</span>'),
	field('author', 'mdi-account', 'User', (v, i, t) => '<span class="text-no-wrap">' + ic(i, t) + ' ' + esc(getUserName(String(v))) + '</span>'),
	field('source', 'mdi-open-in-new', 'Source', (v, i, t) => {
		const obj = v as ResourceRef;
		if (!obj || !obj.title) return '';
		return '<span class="text-no-wrap">' + ic(i, t) + ' <a href="/to?url=' + esc(obj.url) + '" target="_blank" rel="nofollow noopener noreferrer">' + esc(obj.title) + '</a></span>';
	}),
];

export { esc, formatDuration, locationText, ratingStarsHtml, textWithUnit };

export function getFieldIcon(fieldName: string): string {
	const dot = fieldName.indexOf('.');
	const baseName = dot !== -1 ? fieldName.substring(0, dot) : fieldName;
	const entry = FIELD_REGISTRY.find((f) => f.name === baseName);
	return entry?.icon ?? 'mdi-filter';
}

function unwrap(value: unknown): unknown {
	if (Array.isArray(value) && value.length === 1) return value[0];
	return value;
}

export function formatEventHtml(event: ZenoEvent, excludeFields?: Set<string>, fieldOverrides?: Record<string, (value: unknown) => string>): string {
	const parts: string[] = [];
	for (const field of FIELD_REGISTRY) {
		if (excludeFields?.has(field.name)) continue;
		let value = event[field.name];
		if (value === undefined || value === null) continue;
		value = unwrap(value);
		const toHtml = fieldOverrides?.[field.name] ?? field.toHtml;
		if (Array.isArray(value)) {
			for (const item of value) {
				const html = toHtml(item);
				if (html) parts.push(html);
			}
		} else {
			const html = toHtml(value);
			if (html) parts.push(html);
		}
	}
	return parts.join(' &nbsp; ');
}
