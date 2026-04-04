<script setup lang="ts">
import { computed, inject, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import { param } from '../../utils/helpers';
import api, { ApiError } from '../api';
import { type AlertApi, alertKey } from '../composables/useAlert';
import { type AuthApi, authKey } from '../composables/useAuth';
import { formatDuration } from '../utils/eventFormatter';

const router = useRouter();
const auth = inject<AuthApi>(authKey)!;
const alertApi = inject<AlertApi>(alertKey)!;

// Account settings
const settingsEmail = ref('');
const settingsMessage = ref('');
const quota = ref<{ used: number; limit: number } | null>(null);
const emailDirty = computed(() => settingsEmail.value !== ((auth.user.value as (typeof auth.user.value) & { email?: string })?.email || ''));
const quotaResetLabel = computed(() => {
	const now = new Date();
	const nextReset = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
	return 'Resets in ' + formatDuration(nextReset.getTime() - now.getTime());
});

// Credentials
const credentials = ref<Array<{ '@id': string; type: string; authorizationUrl?: string }> | null>(null);
const credOffset = ref(0);
const credLimit = 10;
const credTotal = ref(0);

// Authorizations
const authorizations = ref<Array<{ '@id': string; client: string; scope?: string }> | null>(null);
const authzOffset = ref(0);
const authzLimit = 10;
const authzTotal = ref(0);
const bucketLabels = ref<Record<string, string>>({});

async function loadQuota() {
	try {
		const response = await api.get<{ used: number; limit: number }>(`/users/${auth.user.value!['@id']}/quota`);
		quota.value = response.data;
	} catch {
		// silently fail
	}
}

async function saveSettings() {
	alertApi.clear();
	settingsMessage.value = '';
	const data: Record<string, string> = {};
	const currentEmail = (auth.user.value as typeof auth.user.value & { email?: string })?.email || '';
	if ((settingsEmail.value && settingsEmail.value !== currentEmail) || !auth.user.value?.verified) {
		data.email = settingsEmail.value;
	}
	if (Object.keys(data).length === 0) return;
	try {
		const response = await api.post(`/users/@${auth.user.value!.name}`, data);
		alertApi.show('Updated account settings.', 'success', response.headers('X-Command-ID') || '');
		await auth.whoami();
	} catch (e: unknown) {
		const status = (e as { status?: number }).status;
		settingsMessage.value = status && status < 500 ? "Can't save these changes." : "Couldn't save these changes. Try again later or contact support.";
	}
}

async function closeAccount() {
	if (!confirm('Close your account and delete all associated data?')) return;
	try {
		await api.del(`/users/@${auth.user.value!.name}`);
		await auth.signOut();
	} catch (e: unknown) {
		const status = (e as { status?: number }).status;
		settingsMessage.value = status && status < 500 ? "Can't close this account." : "Couldn't close this account. Try again later or contact support.";
	}
}

async function loadCredentials() {
	try {
		const response = await api.get<{ total: number; items: typeof credentials.value }>(`/users/${auth.user.value!['@id']}/credentials/?${param({ offset: credOffset.value, limit: credLimit })}`);
		credTotal.value = response.data.total;
		credentials.value = response.data.items;
	} catch {
		// silently fail
	}
}

async function deleteCredentials(id: string) {
	alertApi.clear();
	try {
		const response = await api.del(`/credentials/${id}`);
		alertApi.show('Deleted credentials.', 'success', response.headers('X-Command-ID') || '');
		credOffset.value = 0;
		await loadCredentials();
	} catch (e: unknown) {
		const status = (e as { status?: number }).status;
		alertApi.show(status && status < 500 ? "Can't delete credentials." : "Couldn't delete credentials. Try again later or contact support.", 'error');
	}
}

async function loadAuthorizations() {
	try {
		const response = await api.get<{ total: number; authorizations: typeof authorizations.value }>(
			`/users/${auth.user.value!['@id']}/authorizations/?${param({ has_client: true, offset: authzOffset.value, limit: authzLimit })}`,
		);
		authzTotal.value = response.data.total;
		authorizations.value = response.data.authorizations;
		if (authorizations.value) {
			for (const a of authorizations.value) {
				if (a.scope) resolveBucketLabel(a.scope);
			}
		}
	} catch {
		// silently fail
	}
}

async function revokeAuthorization(id: string) {
	alertApi.clear();
	try {
		const response = await api.del(`/authorizations/${id}`);
		alertApi.show('Revoked an authorization.', 'success', response.headers('X-Command-ID') || '');
		authzOffset.value = 0;
		await loadAuthorizations();
	} catch (e: unknown) {
		const status = (e as { status?: number }).status;
		alertApi.show(status && status < 500 ? "Can't revoke the authorization." : "Couldn't revoke the authorization. Try again later or contact support.", 'error');
	}
}

async function resolveBucketLabel(id: string): Promise<string> {
	if (bucketLabels.value[id]) return bucketLabels.value[id];
	try {
		const response = await api.get<{ label: string }>(`/buckets/${id}/label`);
		bucketLabels.value[id] = response.data.label;
		return response.data.label;
	} catch {
		return id;
	}
}

const longPressedRowId = ref<string | null>(null);

function onRowLongPress(id: string) {
	longPressedRowId.value = id;
	setTimeout(() => { longPressedRowId.value = null; }, 3000);
}

function formatClient(client: string): string {
	if (!client) return '';
	return client.replace(/^\/users\//, '');
}

function refresh() {
	loadQuota();
	loadCredentials();
	loadAuthorizations();
}

watch(
	() => auth.user.value,
	async () => {
		if (!auth.user.value?.name) return;
		settingsEmail.value = (auth.user.value as typeof auth.user.value & { email?: string }).email || '';
		await Promise.all([loadQuota(), loadCredentials(), loadAuthorizations()]);
	},
	{ immediate: true },
);
</script>

<template>
	<div>
		<Teleport to="#page-toolbar">
			<span class="text-subtitle-1 font-weight-bold mr-1">Settings</span>
			<v-btn icon size="small" variant="text" @click="refresh()" title="Refresh">
				<v-icon icon="mdi-refresh" />
			</v-btn>
		</Teleport>

		<div style="max-width: 800px; margin: 0 auto" class="pt-4">
			<!-- Quota -->
			<v-card variant="elevated" elevation="1" class="mb-6" v-if="quota">
				<v-card-title>Quota</v-card-title>
				<v-card-text>
					<v-progress-linear :model-value="quota.used / quota.limit * 100" :color="quota.used >= quota.limit ? 'error' : quota.used >= quota.limit * 0.8 ? 'warning' : 'success'" height="10" rounded class="mb-2" />
					<p class="text-body-2">{{ quota.used.toLocaleString() }} / {{ quota.limit.toLocaleString() }} events. {{ quotaResetLabel }}. <a href="mailto:support@zenobase.com">Contact support</a> to increase your quota.</p>
				</v-card-text>
			</v-card>

			<!-- Email -->
			<v-card variant="elevated" elevation="1" class="mb-6">
				<v-card-title>Email</v-card-title>
				<v-card-text>
					<v-alert v-if="settingsMessage" type="error" variant="tonal" class="mb-4">{{ settingsMessage }}</v-alert>
					<form @submit.prevent="saveSettings()">
						<v-text-field
							type="email"
							label="Email"
							required
							v-model="settingsEmail"
							hint="For important, account-related messages."
							persistent-hint
						>
							<template v-slot:append>
								<v-icon v-if="auth.user.value?.verified && !emailDirty" icon="mdi-check-circle" color="success" title="This email address has been verified" />
								<v-icon v-else-if="!emailDirty" icon="mdi-alert-circle" color="warning" title="This email address has not been verified" />
							</template>
						</v-text-field>
					</form>
				</v-card-text>
				<v-card-actions>
					<v-spacer />
					<v-btn color="primary" :disabled="!emailDirty" @click="saveSettings()">Save &amp; Verify</v-btn>
				</v-card-actions>
			</v-card>

			<!-- Credentials -->
			<v-card variant="elevated" elevation="1" class="mb-6">
				<v-card-title>Credentials</v-card-title>
				<v-card-subtitle>You have granted Zenobase access to data in these services</v-card-subtitle>
				<v-card-text>
					<v-table>
						<tbody>
							<tr v-if="credentials === null"><td colspan="2"><i>Loading...</i></td></tr>
							<tr v-else-if="credentials.length === 0"><td colspan="2"><i>None</i></td></tr>
							<tr v-for="c in credentials" :key="c['@id']" class="credentials-row" @contextmenu.prevent="onRowLongPress(c['@id'])">
								<td><span :class="{ 'credentials-invalid': c.authorizationUrl }">{{ c.type }}</span></td>
								<td style="text-align: right; position: relative; overflow: visible">
									<div class="row-actions" :class="{ 'row-actions--visible': longPressedRowId === c['@id'] }">
										<v-btn icon="mdi-delete-outline" size="small" variant="elevated" color="error" title="Delete" @click.stop="deleteCredentials(c['@id'])" />
									</div>
								</td>
							</tr>
						</tbody>
					</v-table>
				</v-card-text>
				<v-card-actions v-if="credentials?.length">
					<v-spacer />
					<v-btn icon variant="text" title="Previous" :disabled="credOffset <= 0" @click="() => { credOffset -= credLimit; loadCredentials() }"><v-icon icon="mdi-chevron-left" /></v-btn>
					<span style="color: rgba(0,0,0,0.5)"><b>{{ credOffset + 1 }}</b>&ndash;<b>{{ credOffset + (credentials?.length ?? 0) }}</b> of <b>{{ credTotal }}</b></span>
					<v-btn icon variant="text" title="Next" :disabled="credOffset + credLimit >= credTotal" @click="() => { credOffset += credLimit; loadCredentials() }"><v-icon icon="mdi-chevron-right" /></v-btn>
				</v-card-actions>
			</v-card>

			<!-- Authorizations -->
			<v-card variant="elevated" elevation="1" class="mb-6">
				<v-card-title>Authorizations</v-card-title>
				<v-card-subtitle>These services have been granted access to data in Zenobase</v-card-subtitle>
				<v-card-text>
					<v-table>
						<tbody>
							<tr v-if="authorizations === null"><td colspan="2"><i>Loading</i></td></tr>
							<tr v-else-if="authorizations.length === 0"><td colspan="2"><i>None</i></td></tr>
							<tr v-for="a in authorizations" :key="a['@id']" @contextmenu.prevent="onRowLongPress(a['@id'])">
								<td>{{ formatClient(a.client) }} {{ ' ' }} <span v-if="a.scope">({{ bucketLabels[a.scope] || a.scope }})</span><span v-else>(*)</span></td>
								<td style="text-align: right; position: relative; overflow: visible">
									<div class="row-actions" :class="{ 'row-actions--visible': longPressedRowId === a['@id'] }">
										<v-btn icon="mdi-delete-outline" size="small" variant="elevated" color="error" title="Revoke" @click.stop="revokeAuthorization(a['@id'])" />
									</div>
								</td>
							</tr>
						</tbody>
					</v-table>
				</v-card-text>
				<v-card-actions v-if="authorizations?.length">
					<v-spacer />
					<v-btn icon variant="text" title="Previous" :disabled="authzOffset <= 0" @click="() => { authzOffset -= authzLimit; loadAuthorizations() }"><v-icon icon="mdi-chevron-left" /></v-btn>
					<span style="color: rgba(0,0,0,0.5)"><b>{{ authzOffset + 1 }}</b>&ndash;<b>{{ authzOffset + (authorizations?.length ?? 0) }}</b> of <b>{{ authzTotal }}</b></span>
					<v-btn icon variant="text" title="Next" :disabled="authzOffset + authzLimit >= authzTotal" @click="() => { authzOffset += authzLimit; loadAuthorizations() }"><v-icon icon="mdi-chevron-right" /></v-btn>
				</v-card-actions>
			</v-card>

			<div class="mb-6">
				<v-btn variant="text" color="error" @click="closeAccount()">Close account...</v-btn>
			</div>
		</div>
	</div>
</template>

<style scoped>
.v-card-title {
	text-transform: uppercase;
	font-size: 0.875rem !important;
	font-weight: 600;
}
:deep(.v-card-subtitle) {
	white-space: normal !important;
}
</style>
