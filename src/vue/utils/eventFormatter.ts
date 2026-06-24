import type { GeoPoint, ResourceRef, UnitValue, ZenoEvent } from '../../types';
import { formatAge } from './formatAge';
import { getUserName } from './userNames';

/**
 * Escapes a value for safe interpolation into an HTML string. Still used by chart
 * widgets that build markup by hand; event fields are rendered structurally via
 * {@link formatEvent} + the EventField components, which let Vue handle escaping.
 */
function esc(value: unknown): string {
	const div = document.createElement('div');
	div.textContent = String(value ?? '');
	return div.innerHTML;
}

function textWithUnit(value: unknown): string {
	if (typeof value === 'object' && value !== null && '@value' in value) {
		const obj = value as UnitValue;
		return Number(obj['@value']).toLocaleString() + ' ' + (obj.unit || '');
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

/**
 * A single rendered field value. The {@link EventFieldItem} component renders this
 * structurally, so all user-supplied strings (`text`, `href`, ...) are escaped by
 * Vue per context rather than concatenated into an HTML string.
 */
export interface FieldSegment {
	/** Field name (e.g. "resource"), used for keys and styling hooks. */
	name: string;
	/** Material Design icon class, or null when the value renders its own glyphs (rating). */
	icon: string | null;
	/** Tooltip/label for the icon. */
	iconTitle: string;
	/** Whether the field should avoid wrapping. */
	nowrap: boolean;
	/** Use a non-breaking space between icon and value (longer, wrap-friendly fields). */
	tightIcon: boolean;
	kind: 'text' | 'abbr' | 'link' | 'location' | 'rating';
	/** Display text for text/abbr/link/location kinds. */
	text: string;
	/** abbr tooltip, or rating label (e.g. "80%"). */
	title?: string;
	/** Destination for link kind. */
	href?: string;
	/** Constraint expression for location kind (used when rendered as a filter link). */
	filter?: string;
	/** Number of filled stars (0-5) for rating kind. */
	filled?: number;
}

/** The value-specific part of a segment, before the field's icon/title metadata is attached. */
type SegmentBody = {
	kind: FieldSegment['kind'];
	text?: string;
	title?: string;
	href?: string;
	filter?: string;
	filled?: number;
	nowrap?: boolean;
	tightIcon?: boolean;
	noIcon?: boolean;
};

type FieldDef = { name: string; icon: string; title: string; build: (value: unknown) => SegmentBody | null };

/** A field rendered as icon + plain text, no wrapping. */
function simple(name: string, icon: string, title: string, format: (v: unknown) => string): FieldDef {
	return { name, icon, title, build: (v) => ({ kind: 'text', text: format(v) }) };
}

export const FIELD_REGISTRY: FieldDef[] = [
	simple('tag', 'mdi-tag', 'Tag', (v) => String(v ?? '')),
	{
		name: 'resource',
		icon: 'mdi-bookmark',
		title: 'Resource',
		build: (v) => {
			const obj = v as ResourceRef;
			if (!obj?.title) return null;
			return { kind: 'link', text: obj.title, href: obj.url, nowrap: false, tightIcon: true };
		},
	},
	simple('distance', 'mdi-arrow-left-right', 'Distance', textWithUnit),
	simple('height', 'mdi-arrow-up-down', 'Height', textWithUnit),
	simple('weight', 'mdi-weight', 'Weight', textWithUnit),
	{
		name: 'percentage',
		icon: 'mdi-view-grid',
		title: 'Percentage',
		build: (v) => {
			const n = Number(v);
			return { kind: 'abbr', text: Math.round(n) + '%', title: n + '%' };
		},
	},
	simple('moon', 'mdi-moon-waning-crescent', 'Moon', (v) => v + '%'),
	simple('volume', 'mdi-cup', 'Volume', textWithUnit),
	simple('concentration', 'mdi-water', 'Concentration', textWithUnit),
	simple('distance/volume', 'mdi-gas-station', 'Distance/Volume', textWithUnit),
	simple('humidity', 'mdi-water', 'Humidity', (v) => v + '%'),
	simple('pressure', 'mdi-arrow-expand-all', 'Pressure', textWithUnit),
	simple('sound', 'mdi-volume-high', 'Sound Level', textWithUnit),
	{
		name: 'location',
		icon: 'mdi-map-marker',
		title: 'Location',
		build: (v) => {
			const obj = v as GeoPoint;
			if (!obj || !('lat' in obj)) return null;
			const text = locationText(obj);
			return { kind: 'location', text, filter: text.replace(' ', '') + '~100 m' };
		},
	},
	{
		name: 'timestamp',
		icon: 'mdi-calendar-outline',
		title: 'Timestamp',
		build: (v) => ({ kind: 'abbr', text: formatAge(String(v), 79200000), title: String(v) }),
	},
	simple('velocity', 'mdi-speedometer', 'Velocity', textWithUnit),
	simple('pace', 'mdi-timer-outline', 'Pace', formatPace),
	{
		name: 'duration',
		icon: 'mdi-clock-outline',
		title: 'Duration',
		build: (v) => {
			const ms = typeof v === 'number' ? v : typeof v === 'object' && v !== null && '@value' in v ? Number((v as UnitValue)['@value']) : 0;
			return { kind: 'abbr', text: formatDuration(ms) };
		},
	},
	simple('frequency', 'mdi-heart', 'Frequency', textWithUnit),
	simple('bits', 'mdi-database', 'Bits', textWithUnit),
	simple('count', 'mdi-counter', 'Count', (v) => Number(v).toLocaleString()),
	simple('energy', 'mdi-fire', 'Energy', textWithUnit),
	simple('light', 'mdi-white-balance-sunny', 'Light', textWithUnit),
	simple('temperature', 'mdi-fire', 'Temperature', textWithUnit),
	{
		name: 'rating',
		icon: 'mdi-star',
		title: 'Rating',
		build: (v) => {
			const value = Number(v);
			return { kind: 'rating', filled: Math.round((value || 0) / 20), title: value + '%', noIcon: true };
		},
	},
	simple('currency', 'mdi-currency-usd', 'Currency', (v) => Number(v).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })),
	{
		name: 'note',
		icon: 'mdi-comment-outline',
		title: 'Note',
		build: (v) => ({ kind: 'text', text: String(v ?? ''), nowrap: false, tightIcon: true }),
	},
	{
		name: 'author',
		icon: 'mdi-account',
		title: 'User',
		build: (v) => ({ kind: 'text', text: getUserName(String(v)) }),
	},
	{
		name: 'source',
		icon: 'mdi-open-in-new',
		title: 'Source',
		build: (v) => {
			const obj = v as ResourceRef;
			if (!obj?.title) return null;
			return { kind: 'link', text: obj.title, href: obj.url };
		},
	},
];

export { esc, formatDuration, locationText, textWithUnit };

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

function toSegment(field: FieldDef, body: SegmentBody): FieldSegment {
	return {
		name: field.name,
		icon: body.noIcon ? null : field.icon,
		iconTitle: field.title,
		nowrap: body.nowrap ?? true,
		tightIcon: body.tightIcon ?? false,
		kind: body.kind,
		text: body.text ?? '',
		title: body.title,
		href: body.href,
		filter: body.filter,
		filled: body.filled,
	};
}

/**
 * Builds the renderable segments for an event, in field-registry order. Array-valued
 * fields produce one segment per item. The returned data contains raw, unescaped
 * strings; rendering safety is the responsibility of the EventField components.
 */
export function formatEvent(event: ZenoEvent, excludeFields?: Set<string>): FieldSegment[] {
	const segments: FieldSegment[] = [];
	for (const field of FIELD_REGISTRY) {
		if (excludeFields?.has(field.name)) continue;
		let value = event[field.name];
		if (value === undefined || value === null) continue;
		value = unwrap(value);
		const items = Array.isArray(value) ? value : [value];
		for (const item of items) {
			const body = field.build(item);
			if (body) segments.push(toSegment(field, body));
		}
	}
	return segments;
}
