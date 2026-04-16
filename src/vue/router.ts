import { createRouter, createWebHashHistory } from 'vue-router';
import ApiDocsPage from './pages/ApiDocsPage.vue';
import CredentialsPage from './pages/CredentialsPage.vue';
import DashboardPage from './pages/DashboardPage.vue';
import HomePage from './pages/HomePage.vue';
import NotFoundPage from './pages/NotFoundPage.vue';
import PrivacyPage from './pages/PrivacyPage.vue';
import SettingsPage from './pages/SettingsPage.vue';
import TermsPage from './pages/TermsPage.vue';

const router = createRouter({
	history: createWebHashHistory(),
	routes: [
		{ path: '/', component: HomePage },
		{ path: '/buckets/:bucketId/', component: DashboardPage, props: true },
		{ path: '/credentials/:credentialsId', component: CredentialsPage },
		{ path: '/terms', component: TermsPage },
		{ path: '/privacy', component: PrivacyPage },
		{ path: '/api/:section?', component: ApiDocsPage },
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
