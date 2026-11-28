import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { effectScope } from 'vue';
import { useVersionCheck } from '../useVersionCheck';

const fetchMock = vi.fn<typeof fetch>();

function serve(...etags: Array<string | null>) {
	for (const etag of etags) {
		fetchMock.mockResolvedValueOnce(etag === null ? new Response(null, { status: 503 }) : new Response(null, { headers: { etag } }));
	}
}

function setHidden(hidden: boolean) {
	Object.defineProperty(document, 'hidden', { configurable: true, value: hidden });
	document.dispatchEvent(new Event('visibilitychange'));
}

describe('useVersionCheck', () => {
	let scope: ReturnType<typeof effectScope>;

	beforeEach(() => {
		vi.useFakeTimers();
		vi.stubGlobal('fetch', fetchMock);
		vi.spyOn(console, 'log').mockImplementation(() => {});
		scope = effectScope();
	});

	afterEach(() => {
		scope.stop();
		fetchMock.mockReset();
		vi.unstubAllGlobals();
		vi.useRealTimers();
		Object.defineProperty(document, 'hidden', { configurable: true, value: false });
	});

	it('flags a stale page once the ETag changes, ignoring the weak prefix and failed checks', async () => {
		serve('W/"v1"', '"v1"', null, '"v2"');
		const { isStale } = scope.run(() => useVersionCheck())!;

		await vi.advanceTimersByTimeAsync(120_000);
		expect(isStale.value).toBe(false);

		await vi.advanceTimersByTimeAsync(60_000);
		expect(isStale.value).toBe(true);
		expect(fetchMock).toHaveBeenCalledWith('/index.html', { method: 'HEAD', cache: 'no-cache' });
	});

	it('pauses while the page is hidden and checks again when it is shown', async () => {
		serve('"v1"', '"v2"');
		const { isStale } = scope.run(() => useVersionCheck())!;
		await vi.advanceTimersByTimeAsync(0);

		setHidden(true);
		await vi.advanceTimersByTimeAsync(300_000);
		expect(fetchMock).toHaveBeenCalledTimes(1);

		setHidden(false);
		await vi.advanceTimersByTimeAsync(0);
		expect(isStale.value).toBe(true);
	});

	it('stops checking when its scope is disposed', async () => {
		serve('"v1"');
		scope.run(() => useVersionCheck());
		scope.stop();

		setHidden(false);
		await vi.advanceTimersByTimeAsync(300_000);

		expect(fetchMock).toHaveBeenCalledTimes(1);
	});
});
