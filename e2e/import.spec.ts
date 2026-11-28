import { expect, test } from './fixtures';

test('imports a CSV file', async ({ page, backend }) => {
	backend.on('POST', '/buckets/b1/', { headers: { 'X-Command-ID': 'c1' } });
	await page.goto('/#/buckets/b1/');
	await page.getByTitle('More...').click();
	await page.getByRole('listitem').filter({ hasText: 'Import...' }).click();

	const dialog = page.getByRole('dialog');
	await dialog.locator('input[type=file]').setInputFiles({
		name: 'events.csv',
		mimeType: 'text/csv',
		buffer: Buffer.from('timestamp,tag\n2026-11-25T07:00:00.000-08:00,sleep\n2026-11-26T07:00:00.000-08:00,nap\n'),
	});
	await expect(dialog).toContainText('1 of 2');

	const request = page.waitForRequest((r) => r.method() === 'POST');
	await dialog.getByRole('button', { name: 'Import' }).click();
	expect((await request).postDataJSON()).toEqual({
		events: [
			{ timestamp: '2026-11-25T07:00:00.000-08:00', tag: 'sleep' },
			{ timestamp: '2026-11-26T07:00:00.000-08:00', tag: 'nap' },
		],
	});
	await expect(page.getByText('Imported events.')).toBeVisible();
});
