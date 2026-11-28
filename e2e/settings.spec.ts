import { expect, test, user } from './fixtures';

test('updates the email address', async ({ page, backend }) => {
	const id = user['@id'];
	backend.on('GET', `/users/${id}/quota`, { body: { used: 120, limit: 10000 } });
	backend.on('GET', `/users/${id}/passkeys`, { body: [] });
	backend.on('GET', `/users/${id}/external-clients/`, { body: { total: 0, external_clients: [] } });
	backend.on('GET', `/users/${id}/credentials/`, { body: { total: 0, items: [] } });
	backend.on('POST', `/users/@${user.name}`, { headers: { 'X-Command-ID': 'c1' } });

	await page.goto('/#/settings');
	await expect(page.getByText('120 / 10,000 events')).toBeVisible();
	const email = page.getByRole('textbox', { name: 'Email' });
	await expect(email).toHaveValue(user.email);

	await email.fill('alice@example.org');
	const request = page.waitForRequest((r) => r.method() === 'POST');
	await page.getByRole('button', { name: 'Save' }).click();
	expect((await request).postDataJSON()).toEqual({ email: 'alice@example.org' });
	await expect(page.getByText('Email updated.')).toBeVisible();
});
