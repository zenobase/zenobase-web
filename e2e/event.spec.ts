import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';

test.beforeEach(async ({ page, backend }) => {
	backend.on('GET', '/buckets/b1/schema', { body: { properties: {} } });
	backend.on('GET', '/buckets/b1/tags/', { body: ['sleep', 'nap'] });
	backend.on('POST', '/buckets/b1/', { status: 201 });
	backend.on('PUT', '/buckets/b1/e1', { headers: { 'X-Command-ID': 'c1' } });
	await page.goto('/#/buckets/b1/');
});

async function addTag(page: Page, tag: string) {
	const dialog = page.getByRole('dialog');
	await dialog.getByRole('combobox', { name: 'Field' }).fill('tag');
	await page.getByRole('option', { name: 'tag', exact: true }).click();
	await dialog.getByRole('combobox', { name: 'Value' }).fill(tag);
	await dialog.getByRole('button', { name: 'Add' }).click();
}

test('creates an event', async ({ page }) => {
	await page.getByTitle('Create Event...').click();
	await addTag(page, 'dream');

	const request = page.waitForRequest((r) => r.method() === 'POST' && r.url().endsWith('/buckets/b1/'));
	await page.getByRole('dialog').getByRole('button', { name: 'Create' }).click();
	expect((await request).postDataJSON()).toEqual({ tag: 'dream', timestamp: expect.any(String) });
	await expect(page.getByRole('dialog')).toBeHidden();
});

test('edits an event', async ({ page }) => {
	const row = page.locator('.event-row').first();
	await row.hover();
	await row.getByTitle('Edit').click();
	await expect(page.getByRole('dialog')).toContainText('Update Event');
	await addTag(page, 'dream');

	const request = page.waitForRequest((r) => r.method() === 'PUT');
	await page.getByRole('dialog').getByRole('button', { name: 'Update' }).click();
	expect((await request).postDataJSON()).toMatchObject({ '@id': 'e1', tag: ['sleep', 'dream'], duration: 28800000 });
	await expect(page.getByText('Updated an event.')).toBeVisible();
});
