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
		const zenobase_id = user.value?.['@id'];
		await authClient.loginWithRedirect({ screen_hint: 'signup', zenobase_id: zenobase_id || undefined });
	}

	async function signOut(): Promise<void> {
		api.setToken(null);
		user.value = null;
		await authClient.logout();
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
