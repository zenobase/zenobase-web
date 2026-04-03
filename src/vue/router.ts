import { createRouter, createWebHashHistory } from 'vue-router';
import ApiDocsPage from './pages/ApiDocsPage.vue';
import CredentialsPage from './pages/CredentialsPage.vue';
import DashboardPage from './pages/DashboardPage.vue';
import HomePage from './pages/HomePage.vue';
import LegalPage from './pages/LegalPage.vue';
import NotFoundPage from './pages/NotFoundPage.vue';
import OAuthAuthorizePage from './pages/OAuthAuthorizePage.vue';
import PasswordResetPage from './pages/PasswordResetPage.vue';
import SettingsPage from './pages/SettingsPage.vue';
import UserPage from './pages/UserPage.vue';
import VerificationPage from './pages/VerificationPage.vue';

const router = createRouter({
	history: createWebHashHistory(),
	routes: [
		{ path: '/', component: HomePage },
		{ path: '/buckets/:bucketId/', component: DashboardPage, props: true },
		{ path: '/credentials/:credentialsId', component: CredentialsPage },
		{ path: '/oauth/authorize', component: OAuthAuthorizePage },
		{ path: '/legal/:section?', component: LegalPage },
		{ path: '/api/:section?', component: ApiDocsPage },
		{ path: '/settings', component: SettingsPage },
		{ path: '/users/:username', component: UserPage, props: true },
		{ path: '/users/:username/reset', component: PasswordResetPage, props: true },
		{ path: '/users/:username/verify', component: VerificationPage, props: true },
		{ path: '/:pathMatch(.*)*', component: NotFoundPage },
	],
});

router.beforeEach((to) => {
	const title = to.meta.title ? `${to.meta.title} | Zenobase` : 'Zenobase';
	document.title = title as string;
});

export default router;
