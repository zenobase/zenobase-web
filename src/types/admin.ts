export interface AdminUser {
	'@id': string;
	name?: string;
	email?: string;
	external_id?: string;
	verified?: boolean;
	suspended?: boolean;
	optedout?: boolean;
	superuser?: boolean;
	quota?: number | null;
	created?: string;
	modified?: string;
}

export interface AdminBucket {
	'@id': string;
	label?: string;
	description?: string;
	roles: Array<{ principal: string; role: string }>;
	aliases?: Array<{ '@id': string; filter?: string | null }>;
	events?: number;
	size?: number;
	archived?: boolean;
	created?: string;
	modified?: string;
}

export interface JournalCommand {
	'@id': string;
	principal: string;
	bucket?: string;
	action: string;
	created: string;
	[key: string]: unknown;
}

export interface Credential {
	'@id': string;
	principal: string;
	type: string;
	authorizationUrl?: string;
	created?: string;
}

/**
 * Admin view of a user's connected third-party app. {@code principal} is the owning user (set client-side
 * after fetching from {@code /users/{userId}/external-clients/}).
 */
export interface AdminExternalClient {
	principal: string;
	client_id: string;
	client_name?: string;
	created: string;
	readable_buckets: string[];
}

export interface AdminTask {
	'@id': string;
	principal: string;
	bucket?: string;
	type: string;
	schedule?: string;
	created?: string;
	modified?: string;
	[key: string]: unknown;
}

export interface SchedulerJob {
	'@id'?: string;
	status?: string;
	nextRun?: string;
	[key: string]: unknown;
}

export interface Snapshot {
	'@id': string;
	timestamp?: string;
	[key: string]: unknown;
}

export interface ClusterStatus {
	nodes: number | string;
	health: string;
	read_only?: boolean;
	scheduler_disabled?: boolean;
	[key: string]: unknown;
}

export interface PaginationParams {
	offset: number;
	limit: number;
	q?: string;
}
