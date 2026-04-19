<script setup lang="ts">
import { computed, provide, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import api from '../api';
import LoadingState from '../components/LoadingState.vue';
import { authKey, useAuth } from '../composables/useAuth';

const auth = useAuth();
provide(authKey, auth);
const drawer = ref(true);

const route = useRoute();
const router = useRouter();
const currentSection = computed(() => (route.params.section as string) || 'journal');

const sections = [
	{ value: 'journal', title: 'History', icon: 'mdi-history' },
	{ value: 'buckets', title: 'Buckets', icon: 'mdi-view-dashboard' },
	{ value: 'users', title: 'Users', icon: 'mdi-account-group' },
	{ value: 'credentials', title: 'Credentials', icon: 'mdi-key' },
	{ value: 'tasks', title: 'Tasks', icon: 'mdi-cog-sync' },
	{ value: 'scheduler', title: 'Scheduler', icon: 'mdi-calendar-clock' },
	{ value: 'snapshots', title: 'Snapshots', icon: 'mdi-camera' },
];

const authReady = ref(false);
async function initAuth() {
	const params = new URLSearchParams(window.location.search);
	if (params.has('code') && params.has('state')) {
		try {
			await auth.handleCallback();
		} catch (e) {
			console.error('Auth callback failed:', e);
		}
	}
	await auth.whoami();
}
initAuth().finally(() => {
	authReady.value = true;
});

async function signOut() {
	await auth.signOut();
	window.location.reload();
}
</script>

<template>
	<v-app>
		<v-app-bar density="compact" color="surface" flat>
			<v-app-bar-nav-icon @click="drawer = !drawer" />
			<router-link to="/" class="d-flex align-center ml-3 mr-3">
				<img src="/img/logo_120x120.png" alt="Zenobase" width="28" height="28" />
			</router-link>
			<div id="page-toolbar" class="d-flex align-center ga-1" style="flex: 1; min-width: 0" />
			<v-menu v-if="auth.user.value">
				<template v-slot:activator="{ props }">
					<v-btn size="small" variant="text" v-bind="props" class="mr-1" style="--v-btn-size: 1rem">
						<v-icon icon="mdi-account" size="small" class="text-medium-emphasis" />
						<span class="ml-1">{{ auth.user.value.name }}</span>
					</v-btn>
				</template>
				<v-list density="compact">
					<v-list-item @click="signOut()">
						<v-list-item-title>Sign out</v-list-item-title>
					</v-list-item>
				</v-list>
			</v-menu>
			<div class="mr-3" v-else-if="!auth.loading.value">
				<a @click="auth.signIn()">Sign in</a>
			</div>
		</v-app-bar>

		<v-navigation-drawer v-model="drawer" :width="220">
			<v-list nav density="compact">
				<v-list-item
					v-for="s in sections"
					:key="s.value"
					:prepend-icon="s.icon"
					:title="s.title"
					:active="currentSection === s.value"
					@click="router.push('/' + s.value)"
				/>
			</v-list>
		</v-navigation-drawer>

		<v-main>
			<v-container fluid class="pa-4 pt-2">
				<RouterView v-if="authReady" />
				<LoadingState v-else state="loading" />
			</v-container>

		</v-main>
	</v-app>
</template>
