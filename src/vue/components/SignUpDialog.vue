<script setup lang="ts">
import { inject, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import { type AuthApi, authKey } from '../composables/useAuth';

const model = defineModel<boolean>();

watch(model, (val) => {
	if (val) init();
});
const auth = inject<AuthApi>(authKey)!;
const router = useRouter();

const username = ref('');
const password = ref('');
const passwordConfirmed = ref('');
const email = ref('');
const message = ref('');
const loading = ref(false);

function init() {
	username.value = '';
	password.value = '';
	passwordConfirmed.value = '';
	email.value = '';
	message.value = '';
}

const usernameRules = [
	(v: string) => !!v || 'Required',
	(v: string) => v.length >= 4 || 'Min 4 characters',
	(v: string) => v.length <= 16 || 'Max 16 characters',
	(v: string) => /^[a-z0-9]+$/.test(v) || 'Lowercase letters and numbers only',
];
const passwordRules = [(v: string) => !!v || 'Required', (v: string) => v.length >= 8 || 'Min 8 characters'];
const emailRules = [(v: string) => !!v || 'Required', (v: string) => /.+@.+\..+/.test(v) || 'Valid email required'];

async function submit() {
	if (password.value !== passwordConfirmed.value) {
		message.value = "Passwords don't match.";
		return;
	}
	loading.value = true;
	message.value = '';
	try {
		const user = await auth.signUp(username.value, password.value, email.value);
		model.value = false;
		if (user.name) {
			router.push(`/users/${user.name}`);
		}
	} catch (e: unknown) {
		const status = (e as { status?: number }).status;
		if (status === 409) {
			message.value = 'The chosen username is not available.';
		} else {
			message.value = 'Unable to sign up, please try again later or contact support.';
		}
	} finally {
		loading.value = false;
	}
}
</script>

<template>
	<v-dialog v-model="model" max-width="500">
		<v-card>
			<v-card-title>Sign up</v-card-title>
			<v-form @submit.prevent="submit()">
				<v-card-text>
					<v-alert v-if="message" type="error" variant="tonal" class="mb-4">{{ message }}</v-alert>
					<v-text-field label="Username (4-16 lowercase letters and numbers)" v-model="username" :rules="usernameRules" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false" required autofocus>
						<template #append-inner>
							<v-icon v-if="username && usernameRules.every(r => r(username) === true)" icon="mdi-check" color="success" />
							<v-icon v-else icon="mdi-exclamation" color="warning" />
						</template>
					</v-text-field>
					<v-text-field label="Password (min 8 characters)" type="password" v-model="password" :rules="passwordRules" required />
					<v-text-field label="Password (repeat)" type="password" v-model="passwordConfirmed" required />
					<v-text-field label="Email" type="email" v-model="email" :rules="emailRules" required hint="We'll email you a confirmation, and use this address if you ever need to reset your password." persistent-hint />
				</v-card-text>
				<v-card-actions>
					<v-spacer />
					<v-btn type="submit" color="primary" :disabled="loading">Sign up</v-btn>
					<v-btn variant="text" @click="model = false">Cancel</v-btn>
				</v-card-actions>
			</v-form>
		</v-card>
	</v-dialog>
</template>
