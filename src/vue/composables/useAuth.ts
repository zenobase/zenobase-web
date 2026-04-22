import { type InjectionKey, type Ref, ref } from 'vue';
import type { User } from '../../types';
import api from '../api';
import { useAuthClient } from '../authClient';

export interface AuthApi {
	user: Ref<User | null>;
	loading: Ref<boolean>;
	whoami: () => Promise<void>;
	signIn: () => Promise<void>;
	signUp: () => Promise<void>;
	signOut: () => Promise<void>;
	handleCallback: () => Promise<void>;
}

export const authKey: InjectionKey<AuthApi> = Symbol('auth');

export function useAuth() {
	const authClient = useAuthClient();
	const user = ref<User | null>(null);
	const loading = ref(true);

	api.setAuthRefresher(async () => {
		try {
			const fresh = await authClient.getTokenSilently({ ignoreCache: true });
			console.log('[auth] getTokenSilently returned fresh token');
			api.setToken(fresh);
		} catch (e) {
			console.warn('[auth] getTokenSilently failed; signing out', e);
			api.setToken(null);
			user.value = null;
			throw e;
		}
	});

	async function whoami(): Promise<void> {
		if (!api.getToken()) {
			try {
				// No token set -- try to get one from the auth client (Auth0 or local)
				const token = await authClient.getTokenSilently();
				api.setToken(token);
			} catch {
				// No auth session available
				loading.value = false;
				return;
			}
		}
		try {
			const response = await api.get<User | null>('/who');
			user.value = response.data;
		} catch {
			api.setToken(null);
			user.value = null;
		} finally {
			loading.value = false;
		}
	}

	async function signIn(): Promise<void> {
		await authClient.loginWithRedirect();
	}

	async function signUp(): Promise<void> {
		await authClient.loginWithRedirect({ screen_hint: 'signup' });
	}

	async function signOut(): Promise<void> {
		console.log('[auth] sign-out requested');
		const token = api.getToken();
		const claims = token ? decodeClaims(token) : null;
		const sid = claims?.sid ?? null;
		// Fall back to the JWT's username claim if user.value has been cleared (e.g. after a 401),
		// so we still revoke the session server-side instead of orphaning its refresh token.
		const username = user.value?.name ?? claims?.username ?? null;
		if (sid && username) {
			try {
				await api.del(`/users/@${encodeURIComponent(username)}/sessions/${encodeURIComponent(sid)}`);
				console.log('[auth] current session revoked');
			} catch (e) {
				// don't block logout on a revoke failure
				console.warn('[auth] current-session revoke failed; continuing with logout', e);
			}
		} else {
			console.log('[auth] skipping current-session revoke', { hasSid: !!sid, hasUsername: !!username });
		}
		api.setToken(null);
		user.value = null;
		await authClient.logout();
	}

	function decodeClaims(jwt: string): { sid: string | null; username: string | null } | null {
		try {
			const parts = jwt.split('.');
			if (parts.length < 2) return null;
			const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
			const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
			const payload = JSON.parse(atob(padded)) as Record<string, unknown>;
			const sid = typeof payload.sid === 'string' ? payload.sid : null;
			const usernameClaim = payload['https://zenobase.com/username'];
			const username = typeof usernameClaim === 'string' ? usernameClaim : null;
			return { sid, username };
		} catch {
			return null;
		}
	}

	async function handleCallback(): Promise<void> {
		await authClient.handleRedirectCallback();
		const token = await authClient.getTokenSilently();
		api.setToken(token);
		await whoami();
	}

	const auth: AuthApi = {
		user,
		loading,
		whoami,
		signIn,
		signUp,
		signOut,
		handleCallback,
	};

	return auth;
}
