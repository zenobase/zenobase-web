import { onScopeDispose, ref } from 'vue';

const CHECK_INTERVAL_MS = 60_000;
const INDEX_URL = `${import.meta.env.BASE_URL || '/'}index.html`;

async function fetchEtag(): Promise<string | null> {
	try {
		const res = await fetch(INDEX_URL, { method: 'HEAD', cache: 'no-cache' });
		if (!res.ok) return null;
		return res.headers.get('etag');
	} catch {
		return null;
	}
}

export function useVersionCheck() {
	const isStale = ref(false);
	let initialEtag: string | null = null;
	let timer: ReturnType<typeof setInterval> | null = null;

	async function check() {
		const etag = await fetchEtag();
		if (etag === null) return;
		if (initialEtag === null) {
			initialEtag = etag;
			return;
		}
		if (etag !== initialEtag) {
			isStale.value = true;
		}
	}

	function startTimer() {
		if (timer === null) {
			timer = setInterval(check, CHECK_INTERVAL_MS);
		}
	}

	function stopTimer() {
		if (timer !== null) {
			clearInterval(timer);
			timer = null;
		}
	}

	function onVisibilityChange() {
		if (document.hidden) {
			stopTimer();
		} else {
			check();
			startTimer();
		}
	}

	check();
	if (!document.hidden) {
		startTimer();
	}
	document.addEventListener('visibilitychange', onVisibilityChange);

	onScopeDispose(() => {
		stopTimer();
		document.removeEventListener('visibilitychange', onVisibilityChange);
	});

	return { isStale, check };
}
