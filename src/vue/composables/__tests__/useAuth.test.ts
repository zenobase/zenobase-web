import { beforeEach, describe, expect, it, vi } from 'vitest';
import { apiResponse } from '../../__tests__/mount';
import api from '../../api';
import type { AuthClient } from '../../authClient';
import { useAuth } from '../useAuth';

const client = vi.hoisted(() => ({
	loginWithRedirect: vi.fn(),
	handleRedirectCallback: vi.fn(),
	getTokenSilently: vi.fn(),
	logout: vi.fn(),
	isAuthenticated: vi.fn(),
})) satisfies AuthClient;

vi.mock('../../authClient', () => ({ isLocalDev: true, useAuthClient: () => client }));

type TokenProvider = (options?: { ignoreCache?: boolean }) => Promise<string | null>;

function setup() {
	const setTokenProvider = vi.spyOn(api, 'setTokenProvider');
	const auth = useAuth();
	return { auth, tokenProvider: setTokenProvider.mock.calls[0][0] as TokenProvider };
}

describe('useAuth', () => {
	beforeEach(() => {
		vi.spyOn(console, 'warn').mockImplementation(() => {});
		for (const fn of Object.values(client)) fn.mockReset();
	});

	it('signs out the user when a forced token refresh fails', async () => {
		const { auth, tokenProvider } = setup();
		auth.user.value = { '@id': 'u1' } as never;
		client.getTokenSilently.mockRejectedValue(new Error('login_required'));

		expect(await tokenProvider()).toBeNull();
		expect(auth.user.value).not.toBeNull();

		expect(await tokenProvider({ ignoreCache: true })).toBeNull();
		expect(client.getTokenSilently).toHaveBeenLastCalledWith({ ignoreCache: true });
		expect(auth.user.value).toBeNull();
	});

	it('loads the user after the redirect callback', async () => {
		const { auth } = setup();
		client.isAuthenticated.mockResolvedValue(true);
		const get = vi.spyOn(api, 'get').mockResolvedValue(apiResponse({ '@id': 'u1' }));

		await auth.handleCallback();

		expect(client.handleRedirectCallback).toHaveBeenCalled();
		expect(get).toHaveBeenCalledWith('/who');
		expect(auth.user.value).toEqual({ '@id': 'u1' });
		expect(auth.loading.value).toBe(false);
	});

	it('skips /who without a session', async () => {
		const { auth } = setup();
		client.isAuthenticated.mockResolvedValue(false);
		const get = vi.spyOn(api, 'get');

		await auth.whoami();

		expect(get).not.toHaveBeenCalled();
		expect(auth.user.value).toBeNull();
		expect(auth.loading.value).toBe(false);
	});

	it('clears the user when /who fails', async () => {
		const { auth } = setup();
		auth.user.value = { '@id': 'u1' } as never;
		client.isAuthenticated.mockResolvedValue(true);
		vi.spyOn(api, 'get').mockRejectedValue(new Error('500'));

		await auth.whoami();

		expect(auth.user.value).toBeNull();
		expect(auth.loading.value).toBe(false);
	});

	it('passes the signup hint and clears the user on sign out', async () => {
		const { auth } = setup();
		await auth.signIn();
		await auth.signUp();
		expect(client.loginWithRedirect.mock.calls).toEqual([[], [{ screen_hint: 'signup' }]]);

		auth.user.value = { '@id': 'u1' } as never;
		await auth.signOut();
		expect(auth.user.value).toBeNull();
		expect(client.logout).toHaveBeenCalled();
	});

	it('returns a token only for an authenticated session', async () => {
		const { auth } = setup();
		client.isAuthenticated.mockResolvedValueOnce(false).mockResolvedValue(true);
		client.getTokenSilently.mockResolvedValueOnce('t1').mockRejectedValueOnce(new Error('expired'));

		expect(await auth.getToken()).toBeNull();
		expect(await auth.getToken()).toBe('t1');
		expect(await auth.getToken()).toBeNull();
	});
});
