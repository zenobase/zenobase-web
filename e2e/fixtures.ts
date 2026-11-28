import { test as base, expect, type Request, type Route } from '@playwright/test';
import bucket from './fixtures/bucket.json' with { type: 'json' };
import buckets from './fixtures/buckets.json' with { type: 'json' };
import searchResults from './fixtures/search.json' with { type: 'json' };
import user from './fixtures/user.json' with { type: 'json' };

interface Reply {
	status?: number;
	body?: unknown;
	headers?: Record<string, string>;
}

type Handler = Reply | ((request: Request, url: URL) => Reply);

// Files served by `vite preview`; every other same-origin path is an API call and must be mocked.
const STATIC_PATH = /^\/($|index\.html$|favicon\.ico$|assets\/|img\/|dashboard\/)/;

/** In-memory stand-in for the backend. Handlers registered later win, so specs can override the defaults. */
export class MockBackend {
	private handlers: Array<{ method: string; path: string | RegExp; handler: Handler }> = [];
	readonly unmocked: string[] = [];

	on(method: string, path: string | RegExp, handler: Handler): void {
		this.handlers.unshift({ method, path, handler });
	}

	async handle(route: Route, appOrigin: string): Promise<void> {
		const request = route.request();
		const url = new URL(request.url());
		if (url.origin === appOrigin && STATIC_PATH.test(url.pathname)) {
			return route.continue();
		}
		const match = url.origin === appOrigin && this.handlers.find((h) => h.method === request.method() && (typeof h.path === 'string' ? h.path === url.pathname : h.path.test(url.pathname)));
		if (!match) {
			this.unmocked.push(`${request.method()} ${request.url()}`);
			return route.abort();
		}
		const reply = typeof match.handler === 'function' ? match.handler(request, url) : match.handler;
		await route.fulfill({ status: reply.status ?? 200, headers: reply.headers, json: reply.body ?? null });
	}
}

/** Answers dashboard searches with the fixture result of each requested widget (`facet=id:<widget>,...`). */
function search(url: URL): Reply {
	const results: Record<string, unknown> = searchResults;
	const body: Record<string, unknown> = { total: searchResults.total };
	for (const facet of url.searchParams.getAll('facet')) {
		const id = /^id:([^,]+)/.exec(facet)?.[1];
		if (id && id in results) body[id] = results[id];
	}
	return { body };
}

function installDefaults(backend: MockBackend): void {
	backend.on('POST', '/localauth0/oauth/token', { body: { access_token: 'e2e-token' } });
	backend.on('GET', '/who', { body: user });
	backend.on('GET', `/users/${user['@id']}/buckets/`, { body: buckets });
	backend.on('GET', '/buckets/b1', { body: bucket });
	backend.on('GET', '/buckets/b1/', (_request, url) => search(url));
}

export const test = base.extend<{ loggedIn: boolean; backend: MockBackend }>({
	loggedIn: [true, { option: true }],

	backend: [
		async ({ context, page, baseURL, loggedIn }, use) => {
			const backend = new MockBackend();
			installDefaults(backend);
			const appOrigin = new URL(baseURL!).origin;
			await context.route('**/*', (route) => backend.handle(route, appOrigin));
			// LocalAuthClient redirects here to sign in; send the browser straight back with an authorization code.
			await context.route('http://localhost:3000/authorize?*', (route) => {
				const params = new URL(route.request().url()).searchParams;
				const location = `${params.get('redirect_uri')}?code=e2e-code&state=${params.get('state')}`;
				return route.fulfill({ status: 302, headers: { location } });
			});
			if (loggedIn) {
				await context.addInitScript(() => localStorage.setItem('access_token', 'e2e-token'));
			}

			const errors: string[] = [];
			page.on('console', (message) => {
				if (message.type() === 'error') errors.push(message.text());
			});
			page.on('pageerror', (error) => errors.push(error.message));

			await use(backend);

			expect(backend.unmocked, 'requests without a mock').toEqual([]);
			expect(errors, 'console errors').toEqual([]);
		},
		{ auto: true },
	],
});

export { expect, user };
