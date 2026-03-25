import api from '../api';

const cache = new Map<string, string>();

export async function resolveUserNames(ids: string[]): Promise<void> {
	const unknown = ids.filter((id) => id && !cache.has(id));
	await Promise.all(
		unknown.map(async (id) => {
			try {
				const response = await api.get<{ name?: string }>(`/users/${id}`);
				cache.set(id, response.data.name || 'guest');
			} catch {
				cache.set(id, id);
			}
		}),
	);
}

export function getUserName(id: string): string {
	return cache.get(id) || id;
}
