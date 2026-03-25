import '../css/zeno.less';

import { createApp } from 'vue';
import App from './App.vue';
import router from './router';

const el = document.getElementById('vue-app');
if (el) {
	const app = createApp(App);
	app.use(router);
	app.mount(el);
}
