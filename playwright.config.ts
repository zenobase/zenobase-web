import { defineConfig, devices } from '@playwright/test';

const port = 4173;

export default defineConfig({
	testDir: './e2e',
	forbidOnly: !!process.env.CI,
	retries: process.env.CI ? 1 : 0,
	reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
	use: {
		baseURL: `http://localhost:${port}`,
		timezoneId: 'America/Los_Angeles',
		trace: 'on-first-retry',
	},
	projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
	webServer: {
		command: `vite build --outDir dist-e2e && vite preview --outDir dist-e2e --port ${port} --strictPort`,
		url: `http://localhost:${port}`,
		timeout: 180_000,
		// LocalAuthClient instead of Auth0, and API calls to the app's own origin, where e2e/fixtures.ts mocks them.
		env: { VITE_AUTH0_DOMAIN: 'http://localhost:3000', VITE_API_BASE_URL: '' },
	},
});
