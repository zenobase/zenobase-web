import { isLocalDev } from './authClient';

// Migration: api.ts no longer maintains its own access_token cache; the Auth0
// SDK is the single source of truth. LocalAuthClient still uses this key for
// its own session cache in local dev, so leave it alone there.
if (!isLocalDev) {
	localStorage.removeItem('access_token');
}

function getBaseUrl(): string {
	return (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_BASE_URL) || '';
}

type TokenProvider = (options?: { ignoreCache?: boolean }) => Promise<string | null>;

let tokenProvider: TokenProvider | null = null;
let refreshInFlight: Promise<string | null> | null = null;

function setTokenProvider(fn: TokenProvider | null): void {
	tokenProvider = fn;
}

async function getToken(forceRefresh: boolean): Promise<string | null> {
	if (!tokenProvider) return null;
	if (forceRefresh) {
		if (!refreshInFlight) {
			console.log('[auth] tokenProvider: refreshing token');
			refreshInFlight = (async () => {
				try {
					return await tokenProvider!({ ignoreCache: true });
				} finally {
					refreshInFlight = null;
				}
			})();
		}
		return refreshInFlight;
	}
	try {
		return await tokenProvider();
	} catch {
		return null;
	}
}

interface RequestOptions {
	method?: string;
	body?: unknown;
	headers?: Record<string, string>;
	contentType?: string;
}

interface ApiResponse<T = unknown> {
	data: T;
	status: number;
	headers: (name: string) => string | null;
}

class ApiError extends Error {
	status: number;
	data: unknown;

	constructor(status: number, data: unknown) {
		super(`API error: ${status}`);
		this.status = status;
		this.data = data;
	}
}

async function request<T = unknown>(url: string, options: RequestOptions = {}, retried = false): Promise<ApiResponse<T>> {
	const baseUrl = getBaseUrl();
	const fullUrl = baseUrl ? baseUrl + url : url;
	const headers: Record<string, string> = { ...options.headers };

	const token = await getToken(false);
	if (token) {
		headers['Authorization'] = `Bearer ${token}`;
	}

	if (options.body && !options.contentType) {
		headers['Content-Type'] = 'application/json';
	}
	if (options.contentType) {
		headers['Content-Type'] = options.contentType;
	}

	const fetchOptions: RequestInit = {
		method: options.method || 'GET',
		headers,
	};

	if (baseUrl) {
		fetchOptions.credentials = 'include';
	}

	if (options.body) {
		fetchOptions.body = typeof options.body === 'string' ? options.body : JSON.stringify(options.body);
	}

	const response = await fetch(fullUrl, fetchOptions);
	const responseHeaders = response.headers;

	if (response.status === 401 && !retried && token) {
		console.log('[auth] api: 401 received, refreshing', { url });
		const fresh = await getToken(true);
		if (fresh) {
			console.log('[auth] api: refresh succeeded, retrying', { url });
			return request<T>(url, options, true);
		}
		console.warn('[auth] api: refresh failed, propagating 401', { url });
		throw new ApiError(401, await readBody(response));
	}

	let data: T;
	const contentType = response.headers.get('content-type');
	if (contentType?.includes('application/json')) {
		data = (await response.json()) as T;
	} else {
		data = (await response.text()) as unknown as T;
	}

	if (!response.ok) {
		throw new ApiError(response.status, data);
	}

	return {
		data,
		status: response.status,
		headers: (name: string) => responseHeaders.get(name),
	};
}

async function readBody(response: Response): Promise<unknown> {
	try {
		const contentType = response.headers.get('content-type');
		if (contentType?.includes('application/json')) {
			return await response.json();
		}
		return await response.text();
	} catch {
		return null;
	}
}

async function download(url: string, filename: string, retried = false): Promise<void> {
	const baseUrl = getBaseUrl();
	const fullUrl = baseUrl ? baseUrl + url : url;
	const headers: Record<string, string> = {};

	const token = await getToken(false);
	if (token) {
		headers['Authorization'] = `Bearer ${token}`;
	}

	const fetchOptions: RequestInit = { method: 'GET', headers };
	if (baseUrl) {
		fetchOptions.credentials = 'include';
	}

	const response = await fetch(fullUrl, fetchOptions);

	if (response.status === 401 && !retried && token) {
		console.log('[auth] api: 401 received, refreshing', { url });
		const fresh = await getToken(true);
		if (fresh) {
			console.log('[auth] api: refresh succeeded, retrying', { url });
			return download(url, filename, true);
		}
		console.warn('[auth] api: refresh failed, propagating 401', { url });
		throw new ApiError(401, await response.text());
	}

	if (!response.ok) {
		throw new ApiError(response.status, await response.text());
	}

	const blob = await response.blob();
	const objectUrl = URL.createObjectURL(blob);
	const a = document.createElement('a');
	a.href = objectUrl;
	a.download = filename;
	a.click();
	URL.revokeObjectURL(objectUrl);
}

const api = {
	get: <T = unknown>(url: string) => request<T>(url),
	post: <T = unknown>(url: string, body?: unknown) => request<T>(url, { method: 'POST', body }),
	postForm: <T = unknown>(url: string, body: string) => request<T>(url, { method: 'POST', body, contentType: 'application/x-www-form-urlencoded' }),
	put: <T = unknown>(url: string, body?: unknown) => request<T>(url, { method: 'PUT', body }),
	del: <T = unknown>(url: string) => request<T>(url, { method: 'DELETE' }),
	download: (url: string, filename: string) => download(url, filename),
	setTokenProvider,
	ApiError,
};

export default api;
export { ApiError };
