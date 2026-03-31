import { sentryVitePlugin } from '@sentry/vite-plugin';
/// <reference types="vitest/config" />

import vue from '@vitejs/plugin-vue';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [
		vue(),
		sentryVitePlugin({
			org: 'zenobase',
			project: 'zenobase-web',
		}),
	],
	test: {
		globals: true,
		environment: 'jsdom',
		setupFiles: ['./src/vue/__tests__/setup.ts'],
	},
	build: {
		cssMinify: false,

		rollupOptions: {
			input: {
				main: 'index.html',
				admin: 'admin/index.html',
			},
		},

		sourcemap: true,
	},
	server: {
		port: 5173,
		proxy: {
			'/who': 'http://localhost:9000',
			'/reset': 'http://localhost:9000',
			'/status': 'http://localhost:9000',
			'/users': 'http://localhost:9000',
			'/buckets': 'http://localhost:9000',
			'/events': 'http://localhost:9000',
			'/credentials': 'http://localhost:9000',
			'/authorizations': 'http://localhost:9000',
			'/tasks': 'http://localhost:9000',
			'/jobs': 'http://localhost:9000',
			'/journal': 'http://localhost:9000',
			'/payments': 'http://localhost:9000',
			'/oauth': 'http://localhost:9000',
			'/snapshots': 'http://localhost:9000',
			'/to': 'http://localhost:9000',
			'/og': 'http://localhost:9000',
		},
	},
	css: {
		preprocessorOptions: {
			less: {
				math: 'always',
			},
		},
	},
});
