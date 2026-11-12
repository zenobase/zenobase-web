import '../css/zeno.css';

import { createAuth0 } from '@auth0/auth0-vue';
import * as Sentry from '@sentry/vue';
import { createApp } from 'vue';
import App from './App.vue';
import { auth0Config, isLocalDev } from './authClient';
import vuetify from './plugins/vuetify';
import router from './router';

const el = document.getElementById('vue-app');
if (el) {
	const app = createApp(App);

	Sentry.init({
		app,
		dsn: import.meta.env.VITE_SENTRY_DSN,
		integrations: [Sentry.browserTracingIntegration({ router }), Sentry.captureConsoleIntegration({ levels: ['error'] })],
		tracesSampleRate: 1.0,
		// Sentry 11 collects everything when unset; this app holds personal tracking data, so opt out explicitly.
		dataCollection: {
			userInfo: false,
			cookies: false,
			httpHeaders: { request: false, response: false },
			httpBodies: [],
			urlQueryParams: false,
			stackFrameVariables: false,
			genAI: { inputs: false, outputs: false },
			databaseQueryData: false,
			graphQL: { document: false, variables: false },
			queues: false,
			mcp: { inputs: false, outputs: false },
			frameContextLines: 5,
		},
	});

	app.use(router);
	app.use(vuetify);
	if (!isLocalDev) {
		app.use(createAuth0(auth0Config));
	}
	app.mount(el);
}
