<script setup lang="ts">
import { inject, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { type AlertApi, alertKey } from '../composables/useAlert';
import { type AuthApi, authKey } from '../composables/useAuth';

const route = useRoute();
const router = useRouter();
const auth = inject<AuthApi>(authKey)!;
const alertApi = inject<AlertApi>(alertKey)!;

const username = route.params.username as string;
const key = (route.query.key as string) || '';
const expires = (route.query.expires as string) || '';

const password = ref('');
const passwordConfirmed = ref('');
const message = ref('');
const loading = ref(false);

async function submit() {
	if (password.value !== passwordConfirmed.value) {
		message.value = "Passwords don't match.";
		return;
	}
	loading.value = true;
	message.value = '';
	try {
		await auth.resetPassword(username, key, expires, password.value);
		alertApi.show('Your password has been changed.', 'success');
		router.push(`/users/${username}`);
	} catch (e: unknown) {
		const status = (e as { status?: number }).status;
		if (status && status < 500) {
			alertApi.show("Your password can't be changed.", 'error');
		} else {
			alertApi.show('Your password could not be changed. Try again later or contact support.', 'error');
		}
	} finally {
		loading.value = false;
	}
}
</script>

<template>
	<div id="password-reset-view" class="container-fluid">
		<form novalidate @submit.prevent="submit()">
			<div v-if="message" class="alert alert-block alert-error">{{ message }}</div>
			<div class="control-group">
				<label class="control-label" for="password-reset-password">Password (min 8 characters)</label>
				<div class="controls">
					<input id="password-reset-password" type="password" class="large" autofocus required minlength="8" v-model="password" />
				</div>
			</div>
			<div class="control-group">
				<label class="control-label" for="password-reset-password-confirm">Confirm Password</label>
				<div class="controls">
					<input id="password-reset-password-confirm" type="password" class="large" required minlength="8" v-model="passwordConfirmed" />
				</div>
			</div>
			<button id="password-reset-button" type="submit" class="btn btn-primary" :disabled="!password || !passwordConfirmed || loading">Reset Password</button>
		</form>
	</div>
</template>
