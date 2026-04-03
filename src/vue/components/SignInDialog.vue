<script setup lang="ts">
import { inject, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import { type AuthApi, authKey } from '../composables/useAuth';

const model = defineModel<boolean>();
defineEmits<{ lostPassword: [] }>();

watch(model, (val) => {
	if (val) init();
});
const auth = inject<AuthApi>(authKey)!;
const router = useRouter();

const username = ref('');
const password = ref('');
const message = ref('');
const loading = ref(false);

function init() {
	username.value = '';
	password.value = '';
	message.value = '';
}

async function signIn() {
	if (username.value.includes('@')) {
		message.value = 'Please enter your username, not your email address.';
		return;
	}
	loading.value = true;
	message.value = '';
	try {
		await auth.signIn(username.value, password.value);
		model.value = false;
		if (router.currentRoute.value.path === '/') {
			router.push(`/users/${username.value}`);
		}
	} catch (e: unknown) {
		const status = (e as { status?: number }).status;
		if (status && status < 500) {
			message.value = 'The username or password you entered is incorrect.';
		} else {
			message.value = 'Unable to sign in, please try again later or contact support.';
		}
	} finally {
		loading.value = false;
	}
}
</script>

<template>
	<v-dialog v-model="model" max-width="500">
		<v-card>
			<v-card-title>Sign in</v-card-title>
			<v-form @submit.prevent="signIn()">
				<v-card-text>
					<v-alert v-if="message" type="error" variant="tonal" class="mb-4">{{ message }}</v-alert>
					<v-text-field label="Username *" v-model="username" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false" required />
					<v-text-field label="Password *" type="password" v-model="password" required />
				</v-card-text>
				<v-card-actions>
					<a class="ml-2" @click="$emit('lostPassword')">Lost password?</a>
					<v-spacer />
					<v-btn type="submit" color="primary" :disabled="!username || !password || loading">Sign in</v-btn>
					<v-btn variant="text" @click="model = false">Cancel</v-btn>
				</v-card-actions>
			</v-form>
		</v-card>
	</v-dialog>
</template>
