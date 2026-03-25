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
	<div v-if="model" class="modal-backdrop fade in" @click="model = false" />
	<div class="modal" :class="{ hide: !model, in: model, fade: true }" :style="model ? { display: 'block', top: '10%' } : {}">
		<form class="modal-form" @submit.prevent="submit()">
			<div class="modal-header">
				<a class="close" @click="model = false">&times;</a>
				<h4>Sign up</h4>
			</div>
			<div class="modal-body">
				<div v-if="message" class="alert alert-error">{{ message }}</div>
				<div class="control-group">
					<label class="control-label" for="sign-up-username">Username (4-16 lowercase letters and numbers)</label>
					<div class="controls">
						<div class="input-append">
							<input id="sign-up-username" type="text" class="input-large" required minlength="4" maxlength="16" pattern="[a-z0-9]+" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false" autofocus v-model="username" />
							<span class="add-on">
								<i v-if="username && usernameRules.every(r => r(username) === true)" class="fa fa-check" title="valid" />
								<i v-else class="fa fa-exclamation" title="not valid" />
							</span>
						</div>
					</div>
				</div>
				<div class="control-group">
					<label class="control-label" for="sign-up-password">Password (min 8 characters)</label>
					<div class="controls">
						<input id="sign-up-password" type="password" class="input-large" required minlength="8" v-model="password" />
					</div>
				</div>
				<div class="control-group">
					<label class="control-label" for="sign-up-password-confirm">Password (repeat)</label>
					<div class="controls">
						<input id="sign-up-password-confirm" type="password" class="input-large" required minlength="8" v-model="passwordConfirmed" />
					</div>
				</div>
				<div class="control-group">
					<label class="control-label" for="sign-up-email">Email</label>
					<div class="controls">
						<input id="sign-up-email" type="email" class="input-large" required v-model="email" />
						<p class="help-block">We'll email you a confirmation, and use this address if you ever need to reset your password.</p>
					</div>
				</div>
			</div>
			<div class="modal-footer">
				<button type="submit" class="btn btn-primary" :disabled="loading">Sign up</button>
				{{ ' ' }}
				<button type="button" class="btn" @click="model = false">Cancel</button>
			</div>
		</form>
	</div>
</template>
