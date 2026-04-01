import '../css/zeno.css';

import * as Sentry from '@sentry/vue';
import { createApp } from 'vue';
import App from './App.vue';
import vuetify from './plugins/vuetify';
import router from './router';

const el = document.getElementById('vue-app');
if (el) {
	const app = createApp(App);

	Sentry.init({
		app,
		dsn: import.meta.env.VITE_SENTRY_DSN,
		integrations: [Sentry.browserTracingIntegration({ router })],
		tracesSampleRate: 1.0,
	});

	app.use(router);
	app.use(vuetify);
	app.mount(el);
}
