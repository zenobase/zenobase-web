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

async function request<T = unknown>(url: string, options: RequestOptions = {}): Promise<ApiResponse<T>> {
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

const api = {
	get: <T = unknown>(url: string) => request<T>(url),
	post: <T = unknown>(url: string, body?: unknown) => request<T>(url, { method: 'POST', body }),
	postForm: <T = unknown>(url: string, body: string) => request<T>(url, { method: 'POST', body, contentType: 'application/x-www-form-urlencoded' }),
	put: <T = unknown>(url: string, body?: unknown) => request<T>(url, { method: 'PUT', body }),
	del: <T = unknown>(url: string) => request<T>(url, { method: 'DELETE' }),
	getToken,
	setToken,
	ApiError,
};

export default api;
export { ApiError };
