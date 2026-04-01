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
	<div id="password-reset-view">
		<form novalidate @submit.prevent="submit()">
			<v-alert v-if="message" type="error" variant="tonal" class="mb-4">{{ message }}</v-alert>
			<div class="mb-4">
				<v-text-field
					id="password-reset-password"
					type="password"
					label="Password (min 8 characters)"
					autofocus
					required
					:rules="[(v: string) => v.length >= 8 || 'Min 8 characters']"
					v-model="password"
				/>
			</div>
			<div class="mb-4">
				<v-text-field
					id="password-reset-password-confirm"
					type="password"
					label="Confirm Password"
					required
					:rules="[(v: string) => v.length >= 8 || 'Min 8 characters']"
					v-model="passwordConfirmed"
				/>
			</div>
			<v-btn id="password-reset-button" type="submit" color="primary" :disabled="!password || !passwordConfirmed || loading">Reset Password</v-btn>
		</form>
	</div>
</template>
