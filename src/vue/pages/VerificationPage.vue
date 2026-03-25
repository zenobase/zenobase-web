<script setup lang="ts">
import { inject, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import api from '../api';
import { type AlertApi, alertKey } from '../composables/useAlert';
import { type AuthApi, authKey } from '../composables/useAuth';

const route = useRoute();
const router = useRouter();
const auth = inject<AuthApi>(authKey)!;
const alertApi = inject<AlertApi>(alertKey)!;

const username = route.params.username as string;
const key = route.query.key as string;

onMounted(async () => {
	try {
		await api.post(`/users/@${username}`, { key, verified: true });
		alertApi.show('Your email address has been verified.', 'success');
		await auth.whoami();
	} catch {
		alertApi.show('Your email address could not be verified.', 'error');
	}
	router.push(`/users/${username}`);
});
</script>

<template>
	<div class="container-fluid">
		Verifying...
	</div>
</template>
