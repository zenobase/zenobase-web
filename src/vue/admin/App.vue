<script setup lang="ts">
import { provide, ref } from 'vue';
import api from '../api';
import SignInDialog from '../components/SignInDialog.vue';
import { authKey, useAuth } from '../composables/useAuth';

const auth = useAuth();
provide(authKey, auth);
const showSignIn = ref(false);
const drawer = ref(true);

const sectionKey = 'adminSection';
const section = ref(localStorage.getItem(sectionKey) || 'journal');
provide('adminSection', section);

const sections = [
	{ value: 'journal', title: 'History', icon: 'mdi-history' },
	{ value: 'buckets', title: 'Buckets', icon: 'mdi-view-dashboard' },
	{ value: 'users', title: 'Users', icon: 'mdi-account-group' },
	{ value: 'authorizations', title: 'Authorizations', icon: 'mdi-shield-key' },
	{ value: 'credentials', title: 'Credentials', icon: 'mdi-key' },
	{ value: 'tasks', title: 'Tasks', icon: 'mdi-cog-sync' },
	{ value: 'scheduler', title: 'Scheduler', icon: 'mdi-calendar-clock' },
	{ value: 'snapshots', title: 'Snapshots', icon: 'mdi-camera' },
];

function selectSection(value: string) {
	section.value = value;
	localStorage.setItem(sectionKey, value);
}

auth.whoami();

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
						<span class="ml-1">{{ auth.user.value.name || 'guest' }}</span>
					</v-btn>
				</template>
				<v-list density="compact">
					<v-list-item @click="signOut()">
						<v-list-item-title>Sign out</v-list-item-title>
					</v-list-item>
				</v-list>
			</v-menu>
			<div class="mr-3" v-else-if="!auth.loading.value">
				<a @click="showSignIn = true">Sign in</a>
			</div>
		</v-app-bar>

		<v-navigation-drawer v-model="drawer" :width="220">
			<v-list nav density="compact">
				<v-list-item
					v-for="s in sections"
					:key="s.value"
					:prepend-icon="s.icon"
					:title="s.title"
					:active="section === s.value"
					@click="selectSection(s.value)"
				/>
			</v-list>
		</v-navigation-drawer>

		<v-main>
			<v-container fluid class="pa-4 pt-2">
				<RouterView />
			</v-container>

		</v-main>

		<SignInDialog v-model="showSignIn" />
	</v-app>
</template>
