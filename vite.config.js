import { sentryVitePlugin } from '@sentry/vite-plugin';
/// <reference types="vitest/config" />

import vue from '@vitejs/plugin-vue';
import { defineConfig } from 'vite';
import vuetify from 'vite-plugin-vuetify';

export default defineConfig({
	plugins: [
		vue(),
		vuetify({ autoImport: true }),
		sentryVitePlugin({
			org: 'zenobase',
			project: 'zenobase-web',
		}),
	],
	test: {
		globals: true,
		environment: 'jsdom',
		setupFiles: ['./src/vue/__tests__/setup.ts'],
		server: {
			deps: {
				inline: ['vuetify'],
			},
		},
	},
	build: {
		cssMinify: false,

		// @ts-expect-error codeSplitting types not yet in vite's RolldownOptions
		rolldownOptions: {
			output: {
				codeSplitting: {
					groups: [
						{
							name: 'vendor',
							test: /node_modules/,
							priority: 0,
						},
					],
				},
			},
		},

		sourcemap: true,
	},
	server: {
		port: 5173,
		proxy: {
			'/localauth0': {
				target: 'http://localhost:3000',
				rewrite: (path) => path.replace(/^\/localauth0/, ''),
			},
			'/who': 'http://localhost:9000',
			'/status': 'http://localhost:9000',
			'/users': 'http://localhost:9000',
			'/buckets': 'http://localhost:9000',
			'/events': 'http://localhost:9000',
			'/credentials': 'http://localhost:9000',
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
	css: {},
});
