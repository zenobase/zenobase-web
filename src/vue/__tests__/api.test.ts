import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import api, { ApiError } from '../api';

const fetchMock = vi.fn<typeof fetch>();

function json(body: unknown, status = 200) {
	return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

function authorization(init?: RequestInit): string | undefined {
	return ((init?.headers ?? {}) as Record<string, string>)['Authorization'];
}

function authHeader(call: number): string | undefined {
	return authorization(fetchMock.mock.calls[call][1]);
}

/** A token provider whose cache picks up the refreshed token, like the Auth0 SDK's. */
function cachingProvider(refreshed: string | null) {
	let cached = 'stale';
	return vi.fn(async (options?: { ignoreCache?: boolean }) => {
		if (options?.ignoreCache && refreshed) cached = refreshed;
		return options?.ignoreCache ? refreshed : cached;
	});
}

/** Rejects requests that don't carry the `valid` token with a 401. */
function serverAccepting(valid: string) {
	fetchMock.mockImplementation(async (_url, init) => {
		return authorization(init) === `Bearer ${valid}` ? json({ ok: true }) : json({ message: 'expired' }, 401);
	});
}

beforeEach(() => {
	vi.stubGlobal('fetch', fetchMock);
	vi.spyOn(console, 'log').mockImplementation(() => {});
	vi.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
	api.setTokenProvider(null);
	fetchMock.mockReset();
	vi.unstubAllGlobals();
	vi.unstubAllEnvs();
});

describe('request', () => {
	it('sends JSON bodies with a bearer token', async () => {
		api.setTokenProvider(async () => 't1');
		fetchMock.mockResolvedValue(json({ id: 1 }));

		const response = await api.post('/buckets/', { label: 'x' });

		expect(response.data).toEqual({ id: 1 });
		expect(fetchMock).toHaveBeenCalledWith('/buckets/', {
			method: 'POST',
			headers: { Authorization: 'Bearer t1', 'Content-Type': 'application/json' },
			body: '{"label":"x"}',
		});
	});

	it('sends form bodies as-is and omits the token when there is none', async () => {
		fetchMock.mockResolvedValue(new Response('ok'));

		const response = await api.postForm('/oauth/token', 'a=1&b=2');

		expect(response.data).toBe('ok');
		expect(fetchMock).toHaveBeenCalledWith('/oauth/token', {
			method: 'POST',
			headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
			body: 'a=1&b=2',
		});
	});

	it('treats a failing token provider as signed out', async () => {
		api.setTokenProvider(async () => {
			throw new Error('login required');
		});
		fetchMock.mockResolvedValue(json({}));

		await api.get('/who');

		expect(authHeader(0)).toBeUndefined();
	});

	it('prefixes the base URL and includes credentials', async () => {
		vi.stubEnv('VITE_API_BASE_URL', 'https://api.example.com');
		fetchMock.mockResolvedValue(json({}));

		await api.del('/buckets/b1');

		expect(fetchMock).toHaveBeenCalledWith('https://api.example.com/buckets/b1', expect.objectContaining({ method: 'DELETE', credentials: 'include' }));
	});

	it('exposes response headers', async () => {
		fetchMock.mockResolvedValue(new Response(null, { status: 201, headers: { Location: '/buckets/b2' } }));

		const response = await api.put('/buckets/b2', {});

		expect(response.status).toBe(201);
		expect(response.headers('Location')).toBe('/buckets/b2');
	});

	it('throws an ApiError with the parsed body on failure', async () => {
		fetchMock.mockResolvedValue(json({ message: 'bad label' }, 400));

		const error = await api.get('/buckets/b1').catch((e) => e);

		expect(error).toBeInstanceOf(ApiError);
		expect(error).toMatchObject({ status: 400, data: { message: 'bad label' } });
	});
});

describe('401 handling', () => {
	it('refreshes the token once and retries', async () => {
		const provider = cachingProvider('fresh');
		api.setTokenProvider(provider);
		serverAccepting('fresh');

		const response = await api.get('/who');

		expect(response.data).toEqual({ ok: true });
		expect(provider).toHaveBeenCalledWith({ ignoreCache: true });
		expect(fetchMock).toHaveBeenCalledTimes(2);
		expect(authHeader(1)).toBe('Bearer fresh');
	});

	it('shares one in-flight refresh between concurrent 401s', async () => {
		let resolveRefresh!: (token: string) => void;
		const refresh = vi.fn(() => new Promise<string>((resolve) => (resolveRefresh = resolve)));
		let current = 'stale';
		api.setTokenProvider(async (options) => (options?.ignoreCache ? refresh() : current));
		serverAccepting('fresh');

		const requests = [api.get('/a'), api.get('/b'), api.get('/c')];
		await vi.waitFor(() => expect(refresh).toHaveBeenCalled());
		await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3));
		current = 'fresh';
		resolveRefresh('fresh');
		await Promise.all(requests);

		expect(refresh).toHaveBeenCalledTimes(1);
		expect(fetchMock).toHaveBeenCalledTimes(6);
	});

	it('starts a new refresh after the previous one settled', async () => {
		const refresh = vi.fn().mockRejectedValueOnce(new Error('network')).mockResolvedValueOnce(null);
		api.setTokenProvider(async (options) => (options?.ignoreCache ? refresh() : 'stale'));
		serverAccepting('fresh');

		await expect(api.get('/a')).rejects.toThrow('network');
		await expect(api.get('/b')).rejects.toMatchObject({ status: 401, data: { message: 'expired' } });
		expect(refresh).toHaveBeenCalledTimes(2);
	});

	it('does not retry more than once', async () => {
		api.setTokenProvider(async () => 'rejected');
		serverAccepting('never');

		await expect(api.get('/who')).rejects.toMatchObject({ status: 401 });
		expect(fetchMock).toHaveBeenCalledTimes(2);
	});

	it('does not refresh when the request had no token', async () => {
		const provider = vi.fn(async () => null);
		api.setTokenProvider(provider);
		serverAccepting('never');

		await expect(api.get('/who')).rejects.toMatchObject({ status: 401 });
		expect(provider).not.toHaveBeenCalledWith({ ignoreCache: true });
		expect(fetchMock).toHaveBeenCalledTimes(1);
	});
});

describe('download', () => {
	it('saves the response body under the given filename', async () => {
		vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:1');
		const revokeObjectURL = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
		const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
			expect(this.download).toBe('b1.csv');
			expect(this.href).toBe('blob:1');
		});
		api.setTokenProvider(cachingProvider('fresh'));
		let calls = 0;
		fetchMock.mockImplementation(async () => (calls++ === 0 ? new Response('', { status: 401 }) : new Response('a,b')));

		await api.download('/buckets/b1/?accept=text/plain', 'b1.csv');

		expect(fetchMock).toHaveBeenCalledTimes(2);
		expect(authHeader(1)).toBe('Bearer fresh');
		expect(click).toHaveBeenCalledOnce();
		expect(revokeObjectURL).toHaveBeenCalledWith('blob:1');
	});

	it('throws an ApiError instead of saving an error page', async () => {
		const click = vi.spyOn(HTMLAnchorElement.prototype, 'click');
		fetchMock.mockResolvedValue(new Response('boom', { status: 500 }));

		await expect(api.download('/buckets/b1/', 'b1.json')).rejects.toMatchObject({ status: 500, data: 'boom' });
		expect(click).not.toHaveBeenCalled();
	});
});
