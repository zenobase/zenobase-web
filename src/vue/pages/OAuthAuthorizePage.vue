<script setup lang="ts">
import { computed, inject, onMounted, ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import type { Bucket } from '../../types';
import { param } from '../../utils/helpers';
import api, { ApiError } from '../api';
import { type AlertApi, alertKey } from '../composables/useAlert';
import { type AuthApi, authKey } from '../composables/useAuth';

const route = useRoute();
const auth = inject<AuthApi>(authKey)!;
const alertApi = inject<AlertApi>(alertKey)!;

const clientId = computed(() => (route.query.client_id as string) || '');
const redirectUri = computed(() => (route.query.redirect_uri as string) || '');

const buckets = ref<Bucket[]>([]);
const selectedBucket = ref('');
const message = ref('');

const valid = computed(() => clientId.value && redirectUri.value && selectedBucket.value);

function getRedirectUri(params: Record<string, string>): string {
	const separator = /[?#]$/.test(redirectUri.value) ? '' : '#';
	return redirectUri.value + separator + param(params);
}

async function fetchBuckets() {
	if (!auth.user.value) {
		return;
	}
	try {
		const query = param({ order: 'label', offset: 0, limit: 100, label_only: true });
		const response = await api.get<{ buckets: Bucket[] }>(`/users/${auth.user.value['@id']}/buckets/?${query}`);
		buckets.value = response.data.buckets;
	} catch (e: unknown) {
		const status = (e as { status?: number }).status;
		if (status && status < 500) {
			message.value = "Can't list buckets.";
		} else {
			message.value = 'Could not list buckets. Try again later or contact support.';
		}
	}
}

async function allow() {
	message.value = '';
	const data: Record<string, string> = {
		response_type: 'token',
		client_id: clientId.value,
		redirect_uri: redirectUri.value,
		scope: selectedBucket.value,
	};
	try {
		const response = await api.post<{ access_token: string; scope: string }>('/oauth/authorize', data);
		window.location.href = getRedirectUri({
			access_token: response.data.access_token,
			scope: response.data.scope,
		});
	} catch (e: unknown) {
		const err = e as { status?: number; data?: { error?: string; error_message?: string } };
		if (err.data?.error) {
			if (err.data.error === 'invalid_redirect_uri') {
				message.value = 'Redirect URI is not valid.';
			} else {
				deny(err.data.error, err.data.error_message);
			}
		} else {
			deny('server_error');
		}
	}
}

function deny(code?: string, errorMessage?: string) {
	const params: Record<string, string> = { error: code || 'access_denied' };
	if (errorMessage) {
		params.error_message = errorMessage;
	}
	window.location.href = getRedirectUri(params);
}

onMounted(() => {
	if (!clientId.value && redirectUri.value) {
		deny('invalid_request', 'client_id is missing');
		return;
	}
	if (!redirectUri.value) {
		message.value = 'Redirect URI is missing.';
		return;
	}
	fetchBuckets();
});

watch(
	() => auth.user.value,
	(user) => {
		if (user) {
			fetchBuckets();
		} else {
			selectedBucket.value = '';
			buckets.value = [];
		}
	},
);
</script>

<template>
	<div id="oauth-view" class="container-fluid">
		<form>
			<div v-if="message" class="alert alert-block alert-error">{{ message }}</div>
			<div v-if="!auth.user.value">
				<p>Please sign in to authorize this application.</p>
			</div>
			<div v-else>
				<div class="control-group">
					<label class="control-label" for="oauth-bucket">Grant <strong>{{ clientId }}</strong> access to:</label>
				</div>
				<div class="control-group">
					<div class="controls">
						<select v-model="selectedBucket">
							<option value="" disabled>Select a bucket</option>
							<option v-for="b in buckets" :key="b['@id']" :value="b['@id']">{{ b.label }}</option>
						</select>
					</div>
				</div>
				<div>
					<button id="oauth-allow" type="button" class="btn btn-primary" :disabled="!valid" @click="allow">Allow</button>
					{{ ' ' }}
					<button id="oauth-deny" type="button" class="btn" @click="deny('access_denied', 'user did not grant access')">Deny</button>
				</div>
			</div>
		</form>
	</div>
</template>
