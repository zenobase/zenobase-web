import { useAuth0 } from '@auth0/auth0-vue';
import { watch } from 'vue';

export interface AuthClient {
	loginWithRedirect(options?: { screen_hint?: string; zenobase_id?: string }): Promise<void>;
	handleRedirectCallback(): Promise<void>;
	getTokenSilently(): Promise<string>;
	logout(): Promise<void>;
	isAuthenticated(): Promise<boolean>;
}

const domain = import.meta.env.VITE_AUTH0_DOMAIN || '';
const clientId = import.meta.env.VITE_AUTH0_CLIENT_ID || '';
const audience = import.meta.env.VITE_AUTH0_AUDIENCE || '';

export const isLocalDev = domain.startsWith('http://localhost');

export function buildRedirectUri(): string {
	return window.location.origin + window.location.pathname;
}

export const auth0Config = {
	domain,
	clientId,
	authorizationParams: {
		redirect_uri: buildRedirectUri(),
		audience,
	},
	cacheLocation: 'localstorage' as const,
};

class LocalAuthClient implements AuthClient {
	private token: string | null = null;

	async loginWithRedirect(_options?: { screen_hint?: string }): Promise<void> {
		const state = crypto.randomUUID();
		const params = new URLSearchParams({
			response_type: 'code',
			client_id: clientId,
			audience,
			scope: 'openid profile email',
			state,
			redirect_uri: buildRedirectUri(),
		});
		window.location.href = `${domain}/authorize?${params}`;
	}

	async handleRedirectCallback(): Promise<void> {
		const params = new URLSearchParams(window.location.search);
		const code = params.get('code');
		if (!code) throw new Error('No authorization code in callback');

		const response = await fetch('/localauth0/oauth/token', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				grant_type: 'authorization_code',
				client_id: clientId,
				client_secret: 'client_secret',
				code,
			}),
		});
		if (!response.ok) {
			const text = await response.text();
			throw new Error(`Token exchange failed: ${response.status} ${text}`);
		}
		const data = await response.json();
		this.token = data.access_token;
		localStorage.setItem('access_token', this.token!);

		window.history.replaceState({}, document.title, window.location.pathname + window.location.hash);
	}

	async getTokenSilently(): Promise<string> {
		if (this.token) return this.token;
		const stored = localStorage.getItem('access_token');
		if (stored) {
			this.token = stored;
			return stored;
		}
		throw new Error('No token available');
	}

	async logout(): Promise<void> {
		this.token = null;
		localStorage.removeItem('access_token');
	}

	async isAuthenticated(): Promise<boolean> {
		return !!(this.token || localStorage.getItem('access_token'));
	}
}

const localAuthClient = new LocalAuthClient();

export function useAuthClient(): AuthClient {
	if (isLocalDev) return localAuthClient;

	const auth0 = useAuth0();

	async function waitForInit(): Promise<void> {
		if (!auth0.isLoading.value) return;
		await new Promise<void>((resolve) => {
			const stop = watch(auth0.isLoading, (loading) => {
				if (!loading) {
					stop();
					resolve();
				}
			});
		});
	}

	return {
		async loginWithRedirect(options) {
			await auth0.loginWithRedirect({
				authorizationParams: {
					...(options?.screen_hint ? { screen_hint: options.screen_hint } : {}),
					...(options?.zenobase_id ? { zenobase_id: options.zenobase_id } : {}),
				},
			});
		},
		async handleRedirectCallback() {
			await waitForInit();
		},
		async getTokenSilently() {
			await waitForInit();
			return auth0.getAccessTokenSilently();
		},
		async logout() {
			await auth0.logout({ logoutParams: { returnTo: window.location.origin } });
		},
		async isAuthenticated() {
			await waitForInit();
			return auth0.isAuthenticated.value;
		},
	};
}
