import vue from '@vitejs/plugin-vue';
import { defineConfig } from 'vite';
import vuetify from 'vite-plugin-vuetify';

export default defineConfig({
	plugins: [
		vue(),
		vuetify({ autoImport: true }),
	],
	build: {
		cssMinify: false,
		// @ts-expect-error codeSplitting types not yet in vite's RolldownOptions
		rolldownOptions: {
			input: {
				admin: 'admin/index.html',
			},
			output: {
				codeSplitting: {
					groups: [
						{
							name: 'admin-vendor',
							test: /node_modules/,
							priority: 0,
						},
					],
				},
			},
		},
		outDir: 'dist',
		emptyOutDir: false,
		sourcemap: true,
	},
});
