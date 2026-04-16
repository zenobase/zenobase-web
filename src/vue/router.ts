import { createRouter, createWebHashHistory } from 'vue-router';
import CredentialsPage from './pages/CredentialsPage.vue';
import DashboardPage from './pages/DashboardPage.vue';
import HomePage from './pages/HomePage.vue';
import NotFoundPage from './pages/NotFoundPage.vue';
import SettingsPage from './pages/SettingsPage.vue';

const router = createRouter({
	history: createWebHashHistory(),
	routes: [
		{ path: '/', component: HomePage },
		{ path: '/buckets/:bucketId/', component: DashboardPage, props: true },
		{ path: '/credentials/:credentialsId', component: CredentialsPage },
		{ path: '/terms', component: () => import('./pages/TermsPage.vue') },
		{ path: '/privacy', component: () => import('./pages/PrivacyPage.vue') },
		{ path: '/api/:section?', component: () => import('./pages/ApiDocsPage.vue') },
		{ path: '/settings', component: SettingsPage },
		{ path: '/users/:username', redirect: '/' },
		{ path: '/users/:username/reset', redirect: '/' },
		{ path: '/users/:username/verify', redirect: '/' },
		{ path: '/:pathMatch(.*)*', component: NotFoundPage },
	],
});

router.beforeEach((to) => {
	const title = to.meta.title ? `${to.meta.title} | Zenobase` : 'Zenobase';
	document.title = title as string;
});

export default router;
