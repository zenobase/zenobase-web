import moment from 'moment';

export function formatAge(date: string | null | undefined, fallbackAfterMs?: number): string {
	if (!date) return '';
	const now = moment();
	const m = moment.parseZone(date);
	const diff = now.valueOf() - m.valueOf();
	if (fallbackAfterMs !== undefined && diff >= fallbackAfterMs) {
		const wallClock = new Date(m.valueOf() + m.utcOffset() * 60000);
		return wallClock.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short', timeZone: 'UTC' });
	}
	if (diff < 60000) return 'just now';
	const years = now.diff(m, 'years');
	if (years >= 1) return `${years}y ago`;
	const months = now.diff(m, 'months');
	if (months >= 1) return `${months}mo ago`;
	const weeks = now.diff(m, 'weeks');
	if (weeks >= 1) return `${weeks}w ago`;
	const days = now.diff(m, 'days');
	if (days >= 1) return `${days}d ago`;
	const hours = now.diff(m, 'hours');
	if (hours >= 1) return `${hours}h ago`;
	const minutes = now.diff(m, 'minutes');
	return `${minutes}m ago`;
}
