export interface Role {
	principal: string;
	role: 'owner' | 'contributor' | 'viewer';
}

export interface Bucket {
	'@id': string;
	label?: string;
	description?: string;
	roles: Role[];
	aliases?: Array<{ '@id': string; filter?: string | null }>;
	fields?: BucketField[];
	widgets?: WidgetSettings[];
	version?: number;
	refresh?: boolean;
	archived?: boolean;
}

export interface BucketField {
	name: string;
	type: string;
}

export interface User {
	'@id': string;
	name?: string;
	verified?: boolean;
	suspended?: boolean;
	quota?: number | null;
}

export interface UnitValue {
	'@value': number;
	unit?: string;
}

export interface ResourceRef {
	title: string;
	url: string;
}

export interface GeoPoint {
	lat: number;
	lon: number;
}

export interface ZenoEvent {
	'@id'?: string;
	timestamp?: string | string[];
	duration?: number | UnitValue | Array<number | UnitValue>;
	tag?: string | string[];
	note?: string | string[];
	rating?: number | number[];
	location?: GeoPoint | GeoPoint[];
	resource?: ResourceRef | ResourceRef[];
	source?: ResourceRef | ResourceRef[];
	author?: string | string[];
	count?: number | number[];
	[fieldName: string]: unknown;
}

export interface Field {
	name: string;
	icon: string;
	type: 'text' | 'numeric' | 'duration' | 'location' | 'special';
	units: string[];
	readOnly: boolean;
	tokenized?: boolean;
	subfields?: string[];
	minValue?: number;
	maxValue?: number;
	toText: (value: unknown) => string;
	toHtml: (value: unknown) => string;
	toNumber: (value: unknown) => number;
	formatAxis: () => void;
}

export interface Constraint {
	field: string;
	value: string;
	negated?: boolean;
	subfield?: string | null;
}

export interface WidgetSettings {
	id: string;
	type: string;
	label?: string;
	placement?: string;
	field?: string;
	limit?: number;
	order?: string;
	filter?: string;
	[key: string]: unknown;
}

export type { BaseWidgetParams, SearchResult } from './search';

import type { BaseWidgetParams, SearchResult } from './search';

export interface Widget {
	settings: WidgetSettings;
	params: () => BaseWidgetParams | null;
	update: (result: SearchResult) => void;
	init: () => void;
}

export interface DashboardApi {
	search: (params: BaseWidgetParams[]) => Promise<SearchResult>;
	register: (widget: Widget) => void;
	addConstraint: (field: string, value: string) => void;
	addConstraints: (constraints: Constraint[]) => void;
}

export interface Alert {
	message: string;
	level: string;
	undo: string;
	onClick: (() => void) | null;
}

export interface Token {
	get: () => string | null;
	set: (token: string | null) => void;
}
