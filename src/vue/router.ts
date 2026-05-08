import { createRouter, createWebHashHistory } from 'vue-router';
import HomePage from './pages/HomePage.vue';

const router = createRouter({
	history: createWebHashHistory(),
	scrollBehavior(to, _from, savedPosition) {
		if (savedPosition) return savedPosition;
		// API page has its own scroll-to-section logic for the :section? param.
		if (to.params.section) return false;
		return { top: 0 };
	},
	routes: [
		{ path: '/', component: HomePage },
		{ path: '/buckets/:bucketId/', component: () => import('./pages/DashboardPage.vue'), props: true },
		{ path: '/credentials/:credentialsId', component: () => import('./pages/CredentialsPage.vue') },
		{ path: '/terms', component: () => import('./pages/TermsPage.vue') },
		{ path: '/privacy', component: () => import('./pages/PrivacyPage.vue') },
		{ path: '/api/:section?', component: () => import('./pages/ApiDocsPage.vue') },
		{ path: '/settings', component: () => import('./pages/SettingsPage.vue') },
		{ path: '/users/:username', redirect: '/' },
		{ path: '/users/:username/reset', redirect: '/' },
		{ path: '/users/:username/verify', redirect: '/' },
		{ path: '/:pathMatch(.*)*', component: () => import('./pages/NotFoundPage.vue') },
	],
});

router.beforeEach((to) => {
	const title = to.meta.title ? `${to.meta.title} | Zenobase` : 'Zenobase';
	document.title = title as string;
});

export default router;
