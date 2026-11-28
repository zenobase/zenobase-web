import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { isLocalDev, useAuthClient } from '../authClient';

// .env points VITE_AUTH0_DOMAIN at localhost, so tests get the LocalAuthClient.
const client = useAuthClient();
const fetchMock = vi.fn<typeof fetch>();

beforeEach(() => {
	vi.stubGlobal('fetch', fetchMock);
});

afterEach(async () => {
	await client.logout();
	fetchMock.mockReset();
	vi.unstubAllGlobals();
	window.history.replaceState({}, '', '/');
});

describe('LocalAuthClient', () => {
	it('is used for local development', () => {
		expect(isLocalDev).toBe(true);
	});

	it('exchanges the callback code for a token and cleans up the URL', async () => {
		window.history.replaceState({}, '', '/?code=abc&state=s#/dashboard');
		fetchMock.mockResolvedValue(new Response(JSON.stringify({ access_token: 't1' })));

		await client.handleRedirectCallback();

		expect(JSON.parse(fetchMock.mock.calls[0][1]?.body as string)).toMatchObject({ grant_type: 'authorization_code', code: 'abc' });
		expect(window.location.search).toBe('');
		expect(window.location.hash).toBe('#/dashboard');
		expect(await client.getTokenSilently()).toBe('t1');
		expect(localStorage.getItem('access_token')).toBe('t1');
	});

	it('rejects a callback without a code', async () => {
		await expect(client.handleRedirectCallback()).rejects.toThrow('No authorization code');
		expect(fetchMock).not.toHaveBeenCalled();
	});

	it('reports a failed token exchange', async () => {
		window.history.replaceState({}, '', '/?code=abc');
		fetchMock.mockResolvedValue(new Response('invalid_grant', { status: 403 }));

		await expect(client.handleRedirectCallback()).rejects.toThrow('Token exchange failed: 403 invalid_grant');
		expect(await client.isAuthenticated()).toBe(false);
	});

	it('restores the session from localStorage until logout', async () => {
		localStorage.setItem('access_token', 'stored');
		expect(await client.isAuthenticated()).toBe(true);
		expect(await client.getTokenSilently()).toBe('stored');

		await client.logout();

		expect(await client.isAuthenticated()).toBe(false);
		await expect(client.getTokenSilently()).rejects.toThrow('No token available');
	});
});
