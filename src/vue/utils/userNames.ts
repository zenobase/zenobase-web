import api from '../api';

const cache = new Map<string, string>();
const pending = new Map<string, Promise<void>>();

export async function resolveUserNames(ids: string[]): Promise<void> {
	const promises = ids
		.filter((id) => id && !cache.has(id))
		.map((id) => {
			if (!pending.has(id)) {
				const promise = api
					.get<{ name?: string }>(`/users/${id}`)
					.then((response) => {
						cache.set(id, response.data.name || 'guest');
					})
					.catch(() => {
						cache.set(id, id);
					})
					.finally(() => {
						pending.delete(id);
					});
				pending.set(id, promise);
			}
			return pending.get(id)!;
		});
	await Promise.all(promises);
}

export function getUserName(id: string): string {
	return cache.get(id) || id;
}
