import type { GeoPoint, ResourceRef, UnitValue, ZenoEvent } from '../../types';
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

function formatRelativeTime(isoStr: string): string {
	const diff = Math.abs(Date.now() - new Date(isoStr).getTime());
	if (diff < 60000) return 'just now';
	if (diff >= 79200000) {
		const d = new Date(isoStr);
		const mo = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][d.getMonth()];
		const pad = (n: number) => (n < 10 ? '0' + n : String(n));
		return `${mo} ${d.getDate()}, ${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
	}
	const minutes = Math.floor(diff / 60000);
	if (minutes < 60) return minutes + ' minutes ago';
	const hours = Math.floor(minutes / 60);
	return hours + ' hours ago';
}

function ratingStarsHtml(value: number): string {
	const stars = Math.round((value || 0) / 20);
	let html = '<span class="nowrap" title="' + value + '%">';
	for (let i = 0; i < 5; ++i) {
		html += '<i class="fa ' + (stars > i ? 'fa-star' : 'fa-star-o') + '"></i>';
	}
	html += '</span>';
	return html;
}

function locationText(value: { lat: number; lon: number }): string {
	return Math.round(Number(value['lat']) * 1000) / 1000 + ', ' + Math.round(Number(value['lon']) * 1000) / 1000;
}

type FieldDef = { name: string; icon: string; title: string; toHtml: (value: unknown) => string };

export const FIELD_REGISTRY: FieldDef[] = [
	{
		name: 'tag',
		icon: 'fa-tag',
		title: 'Tag',
		toHtml: (v) => '<span class="nowrap"><i class="fa fa-tag" title="Tag"></i> ' + esc(v) + '</span>',
	},
	{
		name: 'resource',
		icon: 'fa-bookmark',
		title: 'Resource',
		toHtml: (v) => {
			const obj = v as ResourceRef;
			if (!obj || !obj.title) return '';
			return (
				'<span><i class="fa fa-bookmark" title="Resource"></i>&nbsp;<a href="/to?url=' +
				esc(obj.url) +
				'" target="_blank" rel="nofollow noopener noreferrer">' +
				esc(obj['title']) +
				'</a></span>'
			);
		},
	},
	{ name: 'distance', icon: 'fa-arrows-h', title: 'Distance', toHtml: (v) => '<span class="nowrap"><i class="fa fa-arrows-h" title="Distance"></i> ' + esc(textWithUnit(v)) + '</span>' },
	{ name: 'height', icon: 'fa-arrows-v', title: 'Height', toHtml: (v) => '<span class="nowrap"><i class="fa fa-arrows-v" title="Height"></i> ' + esc(textWithUnit(v)) + '</span>' },
	{
		name: 'weight',
		icon: 'fa-caret-square-o-down',
		title: 'Weight',
		toHtml: (v) => '<span class="nowrap"><i class="fa fa-caret-square-o-down" title="Weight"></i> ' + esc(textWithUnit(v)) + '</span>',
	},
	{
		name: 'percentage',
		icon: 'fa-th',
		title: 'Percentage',
		toHtml: (v) => {
			const n = Number(v);
			return '<span class="nowrap"><i class="fa fa-th" title="Percentage"></i> <abbr title="' + n + '%">' + Math.round(n) + '%</abbr></span>';
		},
	},
	{ name: 'moon', icon: 'fa-moon-o', title: 'Moon', toHtml: (v) => '<span class="nowrap"><i class="fa fa-moon-o" title="Moon"></i> ' + v + '%</span>' },
	{ name: 'volume', icon: 'fa-flask', title: 'Volume', toHtml: (v) => '<span class="nowrap"><i class="fa fa-flask" title="Volume"></i> ' + esc(textWithUnit(v)) + '</span>' },
	{ name: 'concentration', icon: 'fa-tint', title: 'Concentration', toHtml: (v) => '<span class="nowrap"><i class="fa fa-tint" title="Concentration"></i> ' + esc(textWithUnit(v)) + '</span>' },
	{
		name: 'distance/volume',
		icon: 'fa-flask',
		title: 'Distance/Volume',
		toHtml: (v) => '<span class="nowrap"><i class="fa fa-flask" title="Distance/Volume"></i> ' + esc(textWithUnit(v)) + '</span>',
	},
	{ name: 'humidity', icon: 'fa-tint', title: 'Humidity', toHtml: (v) => '<span class="nowrap"><i class="fa fa-tint" title="Humidity"></i> ' + v + '%</span>' },
	{ name: 'pressure', icon: 'fa-arrows-alt', title: 'Pressure', toHtml: (v) => '<span class="nowrap"><i class="fa fa-arrows-alt" title="Pressure"></i> ' + esc(textWithUnit(v)) + '</span>' },
	{ name: 'sound', icon: 'fa-volume-up', title: 'Sound Level', toHtml: (v) => '<span class="nowrap"><i class="fa fa-volume-up" title="Sound Level"></i> ' + esc(textWithUnit(v)) + '</span>' },
	{
		name: 'location',
		icon: 'fa-map-marker',
		title: 'Location',
		toHtml: (v) => {
			const obj = v as { lat: number; lon: number };
			if (!obj || !('lat' in obj)) return '';
			const text = locationText(obj);
			return '<span class="nowrap"><i class="fa fa-map-marker" title="Location"></i> ' + esc(text) + '</span>';
		},
	},
	{
		name: 'timestamp',
		icon: 'fa-calendar-o',
		title: 'Timestamp',
		toHtml: (v) => '<span class="nowrap"><i class="fa fa-calendar-o" title="Timestamp"></i> <abbr title="' + esc(v) + '">' + esc(formatRelativeTime(String(v))) + '</abbr></span>',
	},
	{ name: 'velocity', icon: 'fa-tachometer', title: 'Velocity', toHtml: (v) => '<span class="nowrap"><i class="fa fa-tachometer" title="Velocity"></i> ' + esc(textWithUnit(v)) + '</span>' },
	{ name: 'pace', icon: 'fa-clock-o', title: 'Pace', toHtml: (v) => '<span class="nowrap"><i class="fa fa-clock-o" title="Pace"></i> ' + esc(textWithUnit(v)) + '</span>' },
	{
		name: 'duration',
		icon: 'fa-clock-o',
		title: 'Duration',
		toHtml: (v) => {
			const ms = typeof v === 'number' ? v : typeof v === 'object' && v !== null && '@value' in v ? Number((v as UnitValue)['@value']) : 0;
			return '<span class="nowrap"><i class="fa fa-clock-o" title="Duration"></i> <abbr>' + esc(formatDuration(ms)) + '</abbr></span>';
		},
	},
	{ name: 'frequency', icon: 'fa-heart', title: 'Frequency', toHtml: (v) => '<span class="nowrap"><i class="fa fa-heart" title="Frequency"></i> ' + esc(textWithUnit(v)) + '</span>' },
	{ name: 'bits', icon: 'fa-hdd-o', title: 'Bits', toHtml: (v) => '<span class="nowrap"><i class="fa fa-hdd-o" title="Bits"></i> ' + esc(textWithUnit(v)) + '</span>' },
	{ name: 'count', icon: 'fa-th', title: 'Count', toHtml: (v) => '<span class="nowrap"><i class="fa fa-th" title="Count"></i> ' + Number(v).toLocaleString() + '</span>' },
	{ name: 'energy', icon: 'fa-fire', title: 'Energy', toHtml: (v) => '<span class="nowrap"><i class="fa fa-fire" title="Energy"></i> ' + esc(textWithUnit(v)) + '</span>' },
	{ name: 'light', icon: 'fa-sun-o', title: 'Light', toHtml: (v) => '<span class="nowrap"><i class="fa fa-sun-o" title="Light"></i> ' + esc(textWithUnit(v)) + '</span>' },
	{ name: 'temperature', icon: 'fa-fire', title: 'Temperature', toHtml: (v) => '<span class="nowrap"><i class="fa fa-fire" title="Temperature"></i> ' + esc(textWithUnit(v)) + '</span>' },
	{ name: 'rating', icon: 'fa-star', title: 'Rating', toHtml: (v) => ratingStarsHtml(Number(v)) },
	{
		name: 'currency',
		icon: 'fa-money',
		title: 'Currency',
		toHtml: (v) => '<span class="nowrap"><i class="fa fa-money" title="Currency"></i> ' + Number(v).toFixed(2) + '</span>',
	},
	{ name: 'note', icon: 'fa-comment-o', title: 'Note', toHtml: (v) => '<span><i class="fa fa-comment-o" title="Note"></i>&nbsp;' + esc(v) + '</span>' },
	{
		name: 'author',
		icon: 'fa-user',
		title: 'User',
		toHtml: (v) => '<span class="nowrap"><i class="fa fa-user" title="User"></i> ' + esc(getUserName(String(v))) + '</span>',
	},
	{
		name: 'source',
		icon: 'fa-external-link',
		title: 'Source',
		toHtml: (v) => {
			const obj = v as ResourceRef;
			if (!obj || !obj.title) return '';
			return (
				'<span class="nowrap"><i class="fa fa-external-link" title="Source"></i> <a href="/to?url=' +
				esc(obj.url) +
				'" target="_blank" rel="nofollow noopener noreferrer">' +
				esc(obj.title) +
				'</a></span>'
			);
		},
	},
];

export { esc, formatDuration, formatRelativeTime, locationText, ratingStarsHtml, textWithUnit };

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
