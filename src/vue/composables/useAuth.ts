import { type InjectionKey, provide, type Ref, ref } from 'vue';
import type { User } from '../../types';
import { param } from '../../utils/helpers';
import api, { ApiError } from '../api';

export interface AuthApi {
	user: Ref<User | null>;
	loading: Ref<boolean>;
	whoami: () => Promise<void>;
	signIn: (username: string, password: string) => Promise<void>;
	signOut: () => Promise<void>;
	signUp: (username: string, password: string, email: string) => Promise<User>;
	requestPasswordReset: (username: string, email: string) => Promise<void>;
	resetPassword: (username: string, key: string, expires: string, password: string) => Promise<void>;
}

export const authKey: InjectionKey<AuthApi> = Symbol('auth');

export function useAuth() {
	const user = ref<User | null>(null);
	const loading = ref(true);

	async function whoami(): Promise<void> {
		try {
			const response = await api.get<User | null>('/who');
			user.value = response.data;
		} catch {
			user.value = null;
		} finally {
			loading.value = false;
		}
	}

	async function signIn(username: string, password: string): Promise<void> {
		const body = param({ grant_type: 'password', username, password });
		const response = await api.postForm<{ access_token: string }>('/oauth/token', body);
		api.setToken(response.data.access_token);
		await whoami();
	}

	async function signOut(): Promise<void> {
		const token = api.getToken();
		if (token) {
			try {
				await api.del(`/authorizations/${token}`);
			} catch {
				// ignore errors during sign out
			}
			api.setToken(null);
			user.value = null;
		}
	}

	async function signUp(username: string, password: string, email: string): Promise<User> {
		const response = await api.post<User>('/users/', { username, password, email });
		user.value = response.data;
		return response.data;
	}

	async function requestPasswordReset(username: string, email: string): Promise<void> {
		await api.post('/reset', { username, email });
	}

	async function resetPassword(username: string, key: string, expires: string, password: string): Promise<void> {
		const response = await api.post<{ access_token: string }>(`/users/@${username}`, { key, expires, password });
		api.setToken(response.data.access_token);
		await whoami();
	}

	const auth: AuthApi = { user, loading, whoami, signIn, signOut, signUp, requestPasswordReset, resetPassword };
	provide(authKey, auth);

	return auth;
}
