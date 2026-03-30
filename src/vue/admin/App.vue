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
	<div>
		<header class="container-fluid">
			<a href="/#/"><img src="/img/logo.png" alt="Zenobase" width="159" height="25" /></a>
			<div class="pull-right ng-cloak">
				<p v-if="auth.user.value?.name">
					<i class="fa fa-user" />
					{{ ' ' }}
					<a :href="`/#/users/${auth.user.value.name}`">{{ auth.user.value.name }}</a>
					{{ ' ' }} | {{ ' ' }}
					<a @click="signOut()">Sign out</a>
				</p>
				<p v-else-if="!auth.loading.value">
					<a @click="showSignIn = true">Sign in</a>
				</p>
			</div>
		</header>

		<RouterView />

		<footer class="container-fluid">
			&copy; 2012&ndash;{{ new Date().getFullYear() }} Zenobase LLC
		</footer>

		<SignInDialog v-model="showSignIn" />
	</div>
</template>
