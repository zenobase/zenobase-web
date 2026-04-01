import '../../css/zeno.css';

import { createApp } from 'vue';
import vuetify from '../plugins/vuetify';
import App from './App.vue';
import router from './router';

const el = document.getElementById('vue-app');
if (el) {
	const app = createApp(App);
	app.use(router);
	app.use(vuetify);
	app.mount(el);
}
