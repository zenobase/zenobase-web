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
	<div v-if="model" class="modal-backdrop fade in" @click="model = false" />
	<div class="modal" :class="{ hide: !model, in: model, fade: true }" :style="model ? { display: 'block', top: '10%' } : {}">
		<form class="modal-form" @submit.prevent="submit()">
			<div class="modal-header">
				<a class="close" @click="model = false">&times;</a>
				<h4>Reset Password</h4>
			</div>
			<div class="modal-body">
				<div v-if="message" class="alert alert-error">{{ message }}</div>
				<div class="control-group">
					<label class="control-label" for="lost-password-username">Username</label>
					<div class="controls">
						<input id="lost-password-username" type="text" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false" required autofocus v-model="username" />
					</div>
				</div>
				<div class="control-group">
					<label class="control-label" for="lost-password-email">Email</label>
					<div class="controls">
						<input id="lost-password-email" type="email" required v-model="email" />
					</div>
				</div>
			</div>
			<div class="modal-footer">
				<button type="submit" class="btn btn-primary" :disabled="!username || !email || loading">Reset</button>
				{{ ' ' }}
				<button type="button" class="btn" @click="model = false">Cancel</button>
			</div>
		</form>
	</div>
</template>
