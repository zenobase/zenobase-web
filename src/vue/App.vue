<script setup lang="ts">
import { computed, provide, ref } from 'vue';
import { useRouter } from 'vue-router';
import api from './api';
import LostPasswordDialog from './components/LostPasswordDialog.vue';
import SignInDialog from './components/SignInDialog.vue';
import SignUpDialog from './components/SignUpDialog.vue';
import { alertKey, useAlert } from './composables/useAlert';
import { authKey, useAuth } from './composables/useAuth';

const router = useRouter();
const auth = useAuth();
provide(authKey, auth);
const alertApi = useAlert(async (commandId: string) => {
	await api.post('/journal/', { undo: commandId });
	router.go(0);
});
provide(alertKey, alertApi);

const showSignIn = ref(false);
const showSignUp = ref(false);
const showLostPassword = ref(false);
provide('showSignIn', showSignIn);

auth.whoami();

const showFooter = computed(() => {
	const path = router.currentRoute.value.path;
	return !path.startsWith('/buckets/') && !path.startsWith('/users/');
});

async function signOut() {
	alertApi.clear();
	await auth.signOut();
	if (router.currentRoute.value.path === '/') {
		router.go(0);
	} else {
		router.push('/');
	}
}
</script>

<template>
	<v-app>
		<v-system-bar v-if="auth.user.value && !auth.user.value.name" color="warning" variant="tonal" style="cursor: pointer; height: auto; padding: 8px 16px; justify-content: flex-start" @click="showSignUp = true">
			<v-icon icon="$warning" class="mr-2" />
			<span>Please <strong>sign up</strong> to preserve your data.</span>
		</v-system-bar>

		<v-system-bar v-if="auth.user.value?.name && !auth.user.value.verified" color="warning" style="cursor: pointer; height: auto; padding: 8px 16px; justify-content: flex-start" @click="router.push(`/users/${auth.user.value.name}?settings=1`)">
			<v-icon icon="$warning" class="mr-2" />
			<span>Please <strong>verify your email address</strong>, so we can contact you if your data is on fire (or you need to reset your password).</span>
		</v-system-bar>

		<v-system-bar v-if="auth.user.value?.suspended" color="error" variant="tonal" style="height: auto; padding: 8px 16px; justify-content: flex-start">
			<v-icon icon="$error" class="mr-2" />
			<span>This account has been suspended. Please contact support.</span>
		</v-system-bar>

		<v-app-bar v-if="router.currentRoute.value.path !== '/'" density="compact" color="surface" flat>
			<router-link to="/" class="d-flex align-center ml-3 mr-3">
				<img src="/img/logo_120x120.png" alt="Zenobase" width="28" height="28" />
			</router-link>
			<div id="page-toolbar" class="d-flex align-center ga-1" style="flex: 1; min-width: 0" />
			<div class="d-none d-sm-flex align-center ga-1 mr-3 text-body-2" v-if="auth.user.value">
				<v-icon icon="mdi-account" size="small" class="text-medium-emphasis" />
				<router-link :to="`/users/${auth.user.value.name || 'guest'}`">{{ auth.user.value.name || 'guest' }}</router-link>
				<span class="text-medium-emphasis">|</span>
				<a class="text-medium-emphasis" @click="signOut()">Sign out</a>
			</div>
			<v-menu v-if="auth.user.value" class="d-sm-none">
				<template v-slot:activator="{ props }">
					<v-btn icon size="small" variant="text" v-bind="props" class="mr-1 d-sm-none">
						<v-icon icon="mdi-account" />
					</v-btn>
				</template>
				<v-list density="compact">
					<v-list-item :to="`/users/${auth.user.value.name || 'guest'}`">
						<v-list-item-title>{{ auth.user.value.name || 'guest' }}</v-list-item-title>
					</v-list-item>
					<v-list-item @click="signOut()">
						<v-list-item-title>Sign out</v-list-item-title>
					</v-list-item>
				</v-list>
			</v-menu>
			<div class="mr-3" v-else-if="!auth.loading.value">
				<a @click="showSignIn = true">Sign in</a>
			</div>
		</v-app-bar>

		<v-main>
			<v-container fluid :class="router.currentRoute.value.path === '/' ? 'pa-0' : 'pa-4 pt-2'">
				<v-snackbar :model-value="!!alertApi.alert.value.message" :timeout="alertApi.alert.value.level === 'error' ? -1 : 5000" :color="alertApi.alert.value.level || 'info'" @update:model-value="alertApi.clear()">
					{{ alertApi.alert.value.message }}
					<template #actions>
						<v-btn v-if="alertApi.alert.value.undoId" variant="text" @click="alertApi.undo(alertApi.alert.value.undoId)">Undo</v-btn>
						<v-btn variant="text" @click="alertApi.clear()">Close</v-btn>
					</template>
				</v-snackbar>

				<div v-if="!auth.user.value?.suspended">
					<RouterView />
					<div v-if="auth.loading.value" class="mt-4 text-medium-emphasis">Loading...</div>
				</div>
			</v-container>

			<v-footer v-if="showFooter" class="zeno-footer text-disabled pa-4 flex-column align-center ga-2">
				<div class="d-flex justify-center ga-4">
					<span>&copy; 2012&ndash;{{ new Date().getFullYear() }} Zenobase</span>
					<router-link to="/legal/" class="text-disabled">Legal</router-link>
					<router-link to="/api/" class="text-disabled">API</router-link>
					<a href="mailto:info@zenobase.com" class="text-disabled">Contact</a>
				</div>
				<div class="d-flex justify-center ga-4">
					<a href="https://blog.zenobase.com/" class="text-disabled" title="Blog"><v-icon icon="mdi-rss" size="small" /></a>
					<a href="https://github.com/zenobase" class="text-disabled" title="GitHub"><v-icon icon="mdi-github" size="small" /></a>
					<a href="https://www.linkedin.com/company/2676455" class="text-disabled" title="LinkedIn"><v-icon icon="mdi-linkedin" size="small" /></a>
				</div>
				<div class="d-flex justify-center align-center ga-1">
					<span>Built with</span>
					<v-icon icon="mdi-heart" size="small" />
					<span>in Seattle</span>
				</div>
			</v-footer>
		</v-main>

		<SignInDialog v-model="showSignIn" @lost-password="() => { showSignIn = false; showLostPassword = true }" />
		<SignUpDialog v-model="showSignUp" />
		<LostPasswordDialog v-model="showLostPassword" />
	</v-app>
</template>
