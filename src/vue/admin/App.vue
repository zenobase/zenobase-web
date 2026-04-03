<script setup lang="ts">
import { provide, ref } from 'vue';
import api from '../api';
import SignInDialog from '../components/SignInDialog.vue';
import { authKey, useAuth } from '../composables/useAuth';

const auth = useAuth();
provide(authKey, auth);
const showSignIn = ref(false);

auth.whoami();

async function signOut() {
	await auth.signOut();
	window.location.reload();
}
</script>

<template>
	<v-app>
		<v-app-bar density="compact" color="surface" flat>
			<router-link to="/" class="d-flex align-center ml-3 mr-3">
				<img src="/img/logo_120x120.png" alt="Zenobase" width="28" height="28" />
			</router-link>
			<div id="page-toolbar" class="d-flex align-center flex-wrap ga-1" style="flex: 1; min-width: 0" />
			<v-spacer />
			<div class="d-flex align-center ga-1 mr-3 text-body-2" v-if="auth.user.value?.name">
				<v-icon icon="mdi-account" size="small" class="text-medium-emphasis" />
				<a href="/#/settings">{{ auth.user.value.name }}</a>
				<span class="text-medium-emphasis">|</span>
				<a class="text-medium-emphasis" @click="signOut()">Sign out</a>
			</div>
			<div class="mr-3" v-else-if="!auth.loading.value">
				<a @click="showSignIn = true">Sign in</a>
			</div>
		</v-app-bar>

		<v-main>
			<v-container fluid class="pa-4 pt-2">
				<RouterView />
			</v-container>

		</v-main>

		<SignInDialog v-model="showSignIn" />
	</v-app>
</template>
