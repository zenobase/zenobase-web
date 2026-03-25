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
	<div v-if="model" class="modal-backdrop fade in" @click="model = false" />
	<div class="modal" :class="{ hide: !model, in: model, fade: true }" :style="model ? { display: 'block', top: '10%' } : {}">
		<form class="modal-form" @submit.prevent="signIn()">
			<div class="modal-header">
				<a class="close" @click="model = false">&times;</a>
				<h4>Sign in</h4>
			</div>
			<div class="modal-body">
				<div v-if="message" class="alert alert-error">{{ message }}</div>
				<div class="control-group">
					<label class="control-label" for="sign-in-username"><strong>Username</strong></label>
					<div class="controls">
						<input id="sign-in-username" type="text" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false" required autofocus v-model="username" />
					</div>
				</div>
				<div class="control-group">
					<label class="control-label" for="sign-in-password"><strong>Password</strong></label>
					<div class="controls">
						<input id="sign-in-password" type="password" required v-model="password" />
					</div>
				</div>
			</div>
			<div class="modal-footer">
				<div class="pull-left">
					<a @click="$emit('lostPassword')">Lost password?</a>
				</div>
				<button type="submit" class="btn btn-primary" :disabled="!username || !password || loading">Sign in</button>
				{{ ' ' }}
				<button type="button" class="btn" @click="model = false">Cancel</button>
			</div>
		</form>
	</div>
</template>
