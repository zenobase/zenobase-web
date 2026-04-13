import '../../css/zeno.css';

import { createAuth0 } from '@auth0/auth0-vue';
import { createApp } from 'vue';
import { auth0Config, isLocalDev } from '../authClient';
import vuetify from '../plugins/vuetify';
import App from './App.vue';
import router from './router';

const el = document.getElementById('vue-app');
if (el) {
	const app = createApp(App);
	app.use(router);
	app.use(vuetify);
	if (!isLocalDev) {
		app.use(createAuth0(auth0Config));
	}
	app.mount(el);
}
