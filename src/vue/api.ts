const TOKEN_KEY = 'access_token';

function getBaseUrl(): string {
	return (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_BASE_URL) || '';
}

function getToken(): string | null {
	return localStorage.getItem(TOKEN_KEY);
}

function setToken(token: string | null): void {
	if (token) {
		localStorage.setItem(TOKEN_KEY, token);
	} else {
		localStorage.removeItem(TOKEN_KEY);
	}
}

type AuthRefresher = () => Promise<void>;
let authRefresher: AuthRefresher | null = null;
let refreshInFlight: Promise<void> | null = null;

function setAuthRefresher(fn: AuthRefresher | null): void {
	authRefresher = fn;
}

async function refreshOnce(): Promise<void> {
	if (!authRefresher) throw new Error('no auth refresher registered');
	if (!refreshInFlight) {
		refreshInFlight = authRefresher().finally(() => {
			refreshInFlight = null;
		});
	}
	return refreshInFlight;
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

	const token = getToken();
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

	if (response.status === 401 && !retried && authRefresher) {
		try {
			await refreshOnce();
		} catch {
			throw new ApiError(401, await readBody(response));
		}
		return request<T>(url, options, true);
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

	const token = getToken();
	if (token) {
		headers['Authorization'] = `Bearer ${token}`;
	}

	const fetchOptions: RequestInit = { method: 'GET', headers };
	if (baseUrl) {
		fetchOptions.credentials = 'include';
	}

	const response = await fetch(fullUrl, fetchOptions);

	if (response.status === 401 && !retried && authRefresher) {
		try {
			await refreshOnce();
		} catch {
			throw new ApiError(401, await response.text());
		}
		return download(url, filename, true);
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
	getToken,
	setToken,
	setAuthRefresher,
	ApiError,
};

export default api;
export { ApiError };
