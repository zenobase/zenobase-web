import { createRouter, createWebHashHistory } from 'vue-router';
import AdminPage from './AdminPage.vue';

const router = createRouter({
	history: createWebHashHistory(),
	routes: [
		{ path: '/', component: AdminPage },
		{ path: '/:pathMatch(.*)*', component: { template: '<div class="container-fluid"><h3>Not found</h3></div>' } },
	],
});

export default router;
