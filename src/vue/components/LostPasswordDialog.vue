<script setup lang="ts">
import { inject, ref, watch } from 'vue';
import { type AlertApi, alertKey } from '../composables/useAlert';
import { type AuthApi, authKey } from '../composables/useAuth';

const model = defineModel<boolean>();

watch(model, (val) => {
	if (val) init();
});
const auth = inject<AuthApi>(authKey)!;
const alertApi = inject<AlertApi>(alertKey)!;

const username = ref('');
const email = ref('');
const message = ref('');
const loading = ref(false);

function init() {
	username.value = '';
	email.value = '';
	message.value = '';
}

async function submit() {
	loading.value = true;
	message.value = '';
	try {
		await auth.requestPasswordReset(username.value, email.value);
		model.value = false;
		alertApi.show('A password reset request has been sent by email. Check your inbox.', 'info');
	} catch (e: unknown) {
		const status = (e as { status?: number }).status;
		if (status === 400) {
			message.value = "The username and email address you entered don't match our records.";
		} else {
			message.value = 'Unable to reset your password, please try again later or contact support.';
		}
	} finally {
		loading.value = false;
	}
}
</script>

<template>
	<v-dialog v-model="model" max-width="500">
		<v-card>
			<v-card-title>Reset Password</v-card-title>
			<v-form @submit.prevent="submit()">
				<v-card-text>
					<v-alert v-if="message" type="error" variant="tonal" class="mb-4">{{ message }}</v-alert>
					<v-text-field label="Username *" v-model="username" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false" required />
					<v-text-field label="Email *" type="email" v-model="email" required />
				</v-card-text>
				<v-card-actions>
					<v-spacer />
					<v-btn type="submit" color="primary" :disabled="!username || !email || loading">Reset</v-btn>
					<v-btn variant="text" @click="model = false">Cancel</v-btn>
				</v-card-actions>
			</v-form>
		</v-card>
	</v-dialog>
</template>
