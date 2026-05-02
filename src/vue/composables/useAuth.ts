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
	getToken: () => Promise<string | null>;
}

export const authKey: InjectionKey<AuthApi> = Symbol('auth');

export function useAuth() {
	const authClient = useAuthClient();
	const user = ref<User | null>(null);
	const loading = ref(true);

	api.setTokenProvider(async (options) => {
		try {
			return await authClient.getTokenSilently({ ignoreCache: options?.ignoreCache });
		} catch (e) {
			if (options?.ignoreCache) {
				console.warn('[auth] tokenProvider: refresh failed', e);
				user.value = null;
			}
			return null;
		}
	});

	async function whoami(): Promise<void> {
		try {
			await authClient.getTokenSilently();
		} catch {
			// No auth session — skip /who, render signed-out
			user.value = null;
			loading.value = false;
			return;
		}
		try {
			const response = await api.get<User | null>('/who');
			if (!response.data) {
				console.warn('[auth] whoami: /who returned 204 despite valid session');
			}
			user.value = response.data;
		} catch (e) {
			console.warn('[auth] whoami: /who failed', e);
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
		user.value = null;
		await authClient.logout();
	}

	async function handleCallback(): Promise<void> {
		await authClient.handleRedirectCallback();
		await whoami();
	}

	async function getToken(): Promise<string | null> {
		try {
			return await authClient.getTokenSilently();
		} catch {
			return null;
		}
	}

	const auth: AuthApi = {
		user,
		loading,
		whoami,
		signIn,
		signUp,
		signOut,
		handleCallback,
		getToken,
	};

	return auth;
}
