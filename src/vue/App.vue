<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import api from './api';
import LostPasswordDialog from './components/LostPasswordDialog.vue';
import SignInDialog from './components/SignInDialog.vue';
import SignUpDialog from './components/SignUpDialog.vue';
import { useAlert } from './composables/useAlert';
import { useAuth } from './composables/useAuth';

const router = useRouter();
const auth = useAuth();
const alertApi = useAlert(async (commandId: string) => {
	await api.post('/journal/', { undo: commandId });
	router.go(0);
});

const showSignIn = ref(false);
const showSignUp = ref(false);
const showLostPassword = ref(false);

auth.whoami();

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
	<div>
		<div id="sign-up-banner" v-if="auth.user.value && !auth.user.value.name">
			<div class="alert" style="cursor: pointer" @click="showSignUp = true">
				Please <strong>sign up</strong> to preserve your data.
			</div>
		</div>

		<div id="verify-banner" v-if="auth.user.value && auth.user.value.name && !auth.user.value.verified">
			<div class="alert" style="cursor: pointer" @click="router.push(`/users/${auth.user.value.name}?settings=1`)">
				Please <strong>verify your email address</strong>, so we can contact you if your data is on fire (or you need to reset your password).
			</div>
		</div>

		<header class="container-fluid">
			<router-link to="/"><img src="/img/logo.png" alt="Zenobase" width="159" height="25" /></router-link>
			<div class="pull-right">
				<p v-if="auth.user.value">
					<i class="fa fa-user" /> {{ ' ' }}
					<router-link :to="`/users/${auth.user.value.name || 'guest'}`">{{ auth.user.value.name || 'guest' }}</router-link>
					{{ ' ' }} | {{ ' ' }}
					<a @click="signOut()">Sign out</a>
				</p>
				<p v-else-if="!auth.loading.value">
					<a @click="showSignIn = true">Sign in</a>
				</p>
			</div>
		</header>

		<div class="container-fluid" v-if="alertApi.alert.value.message">
			<div class="alert alert-block" :class="alertApi.alert.value.level === 'error' ? 'alert-error' : alertApi.alert.value.level === 'success' ? 'alert-success' : 'alert-info'">
				<a class="close" @click="alertApi.clear()">&times;</a>
				<span>{{ alertApi.alert.value.message }}</span>
				<span v-if="alertApi.alert.value.undoId">{{ ' ' }}<a @click="alertApi.undo(alertApi.alert.value.undoId)">Undo.</a></span>
			</div>
		</div>

		<div class="container-fluid" v-if="auth.user.value?.suspended">
			<div class="alert alert-block alert-error">
				This account has been suspended. Please contact support.
			</div>
		</div>

		<div id="content" v-if="!auth.user.value?.suspended">
			<RouterView />
			<div class="container-fluid" style="margin-top: 14px" v-if="auth.loading.value">Loading...</div>
		</div>

		<footer class="container-fluid">
			&copy; 2012&ndash;{{ new Date().getFullYear() }} Zenobase LLC
			&bull; <router-link to="/legal/" class="footer-link">Legal</router-link>
			&bull; <router-link to="/api/" class="footer-link">API</router-link>
			&bull; <a href="mailto:info@zenobase.com" class="footer-link">Contact</a>
		</footer>

		<SignInDialog v-model="showSignIn" @lost-password="showSignIn = false; showLostPassword = true" />
		<SignUpDialog v-model="showSignUp" />
		<LostPasswordDialog v-model="showLostPassword" />
	</div>
</template>
