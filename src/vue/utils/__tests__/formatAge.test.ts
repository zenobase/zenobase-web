import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { formatAge } from '../formatAge';

describe('formatAge', () => {
	beforeEach(() => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date('2025-06-15T12:00:00Z'));
	});
	afterEach(() => {
		vi.useRealTimers();
	});

	it('returns empty string for null', () => {
		expect(formatAge(null)).toBe('');
	});

	it('returns empty string for undefined', () => {
		expect(formatAge(undefined)).toBe('');
	});

	it('shows just now for < 1 minute', () => {
		expect(formatAge('2025-06-15T11:59:30Z')).toBe('just now');
	});

	it('shows minutes ago', () => {
		expect(formatAge('2025-06-15T11:50:00Z')).toBe('10m ago');
	});

	it('shows 1 hour ago', () => {
		expect(formatAge('2025-06-15T11:00:00Z')).toBe('1h ago');
	});

	it('shows hours ago', () => {
		expect(formatAge('2025-06-15T09:00:00Z')).toBe('3h ago');
	});

	it('shows days ago', () => {
		expect(formatAge('2025-06-12T12:00:00Z')).toBe('3d ago');
	});

	it('shows weeks ago', () => {
		expect(formatAge('2025-05-25T12:00:00Z')).toBe('3w ago');
	});

	it('shows months ago', () => {
		expect(formatAge('2025-03-15T12:00:00Z')).toBe('3mo ago');
	});

	it('shows years ago', () => {
		expect(formatAge('2023-06-15T12:00:00Z')).toBe('2y ago');
	});

	it('uses fallback for old timestamps when fallbackAfterMs is set', () => {
		const result = formatAge('2025-06-14T00:00:00Z', 79200000);
		expect(result).toContain('2025');
		expect(result).not.toContain('ago');
	});

	it('does not use fallback for recent timestamps', () => {
		expect(formatAge('2025-06-15T11:00:00Z', 79200000)).toBe('1h ago');
	});
});
