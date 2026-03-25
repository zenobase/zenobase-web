<script setup lang="ts">
import { inject, onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import api, { ApiError } from '../api';
import { type AlertApi, alertKey } from '../composables/useAlert';
import { type AuthApi, authKey } from '../composables/useAuth';

const route = useRoute();
const router = useRouter();
const auth = inject<AuthApi>(authKey)!;
const alertApi = inject<AlertApi>(alertKey)!;

const message = ref('');

onMounted(async () => {
	let credentialsId = route.params.credentialsId as string;
	if (credentialsId === '-') {
		credentialsId = localStorage.getItem('credentials') || '';
	}

	try {
		await api.post(`/credentials/${credentialsId}`, { credentials: route.query });
		alertApi.show('Updated credentials.', 'success');
		localStorage.removeItem('credentials');
		try {
			window.close();
		} catch {
			// window.close() may fail if not opened by script
		}
		if (auth.user.value) {
			router.push(`/users/${auth.user.value.name || 'guest'}`);
		} else {
			router.push('/');
		}
	} catch (e: unknown) {
		const status = (e as { status?: number }).status;
		if (status && status < 500) {
			message.value = "Can't update credentials.";
		} else {
			message.value = "Couldn't update credentials. Try again later or contact support.";
		}
	}
});
</script>

<template>
	<div class="container-fluid">
		<div v-if="message" class="alert alert-block alert-error">{{ message }}</div>
	</div>
</template>
