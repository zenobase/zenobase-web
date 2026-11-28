import { expect, test, user } from './fixtures';

test.use({ loggedIn: false });

test('signs in and lists buckets', async ({ page }) => {
	await page.goto('/');
	const tokenRequest = page.waitForRequest('**/localauth0/oauth/token');
	await page.getByText('sign in', { exact: true }).click();

	expect((await tokenRequest).postDataJSON()).toMatchObject({ grant_type: 'authorization_code', code: 'e2e-code' });
	await expect(page.getByRole('button', { name: user.name })).toBeVisible();
	expect(new URL(page.url()).search).toBe('');

	await page.locator('.v-app-bar-nav-icon').click();
	const drawer = page.locator('.v-navigation-drawer');
	await expect(drawer.getByRole('link', { name: /Sleep/ })).toBeVisible();
	await expect(drawer.getByRole('link', { name: /Workouts/ })).toBeVisible();
});
