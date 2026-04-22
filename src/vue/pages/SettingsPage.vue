<script setup lang="ts">
import { computed, inject, ref, watch } from 'vue';
import { param } from '../../utils/helpers';
import api, { listSessions, revokeSession, type Session } from '../api';
import LoadingState from '../components/LoadingState.vue';
import { type AlertApi, alertKey } from '../composables/useAlert';
import { type AuthApi, authKey } from '../composables/useAuth';
import { formatDuration } from '../utils/eventFormatter';
import { formatAge } from '../utils/formatAge';
import { parseUserAgent } from '../utils/parseUserAgent';

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

// API token
const tokenExpiry = computed(() => {
	const token = api.getToken();
	if (!token) return null;
	try {
		const payload = JSON.parse(atob(token.split('.')[1]));
		return typeof payload.exp === 'number' ? new Date(payload.exp * 1000) : null;
	} catch {
		return null;
	}
});
const tokenExpiryLabel = computed(() => {
	const exp = tokenExpiry.value;
	if (!exp) return '';
	const diff = exp.getTime() - Date.now();
	return diff > 0 ? `Expires in ${formatDuration(diff)}` : 'Expired';
});

async function copyToken() {
	const token = api.getToken();
	if (!token) return;
	try {
		await navigator.clipboard.writeText(token);
		alertApi.show('API token copied to clipboard.', 'success', '');
	} catch {
		alertApi.show("Couldn't copy token to clipboard.", 'error');
	}
}

// Credentials
const credentials = ref<Array<{ '@id': string; type: string; authorizationUrl?: string }> | null>(null);
const credOffset = ref(0);
const credLimit = 10;
const credTotal = ref(0);


async function loadQuota() {
	try {
		const response = await api.get<{ used: number; limit: number }>(`/users/${auth.user.value!['@id']}/quota`);
		quota.value = response.data;
	} catch {
		// silently fail
	}
}

async function saveEmail() {
	alertApi.clear();
	settingsMessage.value = '';
	if (!emailDirty.value) return;
	try {
		const response = await api.post(`/users/@${auth.user.value!.name}`, { email: settingsEmail.value });
		alertApi.show('Email updated. Please check your inbox to verify your new address.', 'success', response.headers('X-Command-ID') || '');
		await auth.whoami();
	} catch (e: unknown) {
		const status = (e as { status?: number }).status;
		settingsMessage.value = status && status < 500 ? "Can't update this email address." : "Couldn't update email. Try again later or contact support.";
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

const longPressedRowId = ref<string | null>(null);

function onRowLongPress(id: string) {
	longPressedRowId.value = id;
	setTimeout(() => { longPressedRowId.value = null; }, 3000);
}

// Sessions
const sessions = ref<Session[] | null>(null);
const revokeTarget = ref<Session | null>(null);
const revokeDialog = ref(false);
const revoking = ref(false);

function describeDevice(s: Session): string {
	const { browser, os } = parseUserAgent(s.userAgent);
	return `${browser} on ${os}`;
}

async function loadSessions() {
	try {
		const username = auth.user.value?.name;
		sessions.value = username ? await listSessions(username) : [];
	} catch {
		sessions.value = [];
	}
}

function askRevokeSession(s: Session) {
	revokeTarget.value = s;
	revokeDialog.value = true;
}

async function confirmRevokeSession() {
	const target = revokeTarget.value;
	if (!target) return;
	alertApi.clear();
	revoking.value = true;
	const previous = sessions.value;
	// optimistic removal
	sessions.value = previous ? previous.filter((s) => s.id !== target.id) : previous;
	try {
		await revokeSession(auth.user.value!.name as string, target.id);
		alertApi.show('Sign-out requested \u2014 may take a moment.', 'success', '');
	} catch {
		// restore on failure
		sessions.value = previous;
		alertApi.show("Couldn't revoke session. Try again later or contact support.", 'error');
	} finally {
		revoking.value = false;
		revokeDialog.value = false;
		revokeTarget.value = null;
	}
}

function refresh() {
	loadQuota();
	loadCredentials();
	loadSessions();
}

watch(
	() => auth.user.value,
	async () => {
		if (!auth.user.value?.name) return;
		settingsEmail.value = (auth.user.value as typeof auth.user.value & { email?: string }).email || '';
		await Promise.all([loadQuota(), loadCredentials(), loadSessions()]);
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
					<form @submit.prevent="saveEmail()">
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
					<v-btn color="primary" :disabled="!emailDirty" @click="saveEmail()">Save</v-btn>
				</v-card-actions>
			</v-card>

			<!-- Credentials -->
			<v-card variant="elevated" elevation="1" class="mb-6">
				<v-card-title>Credentials</v-card-title>
				<v-card-subtitle>You have granted Zenobase access to data in these services</v-card-subtitle>
				<v-card-text>
					<LoadingState v-if="credentials === null" state="loading" />
					<p v-else-if="credentials.length === 0"><i>None</i></p>
					<v-table v-else>
						<tbody>
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

			<!-- Sessions -->
			<v-card variant="elevated" elevation="1" class="mb-6">
				<v-card-title>Sessions</v-card-title>
				<v-card-subtitle>Browsers and apps signed in to your account. Revocations may take a moment to take effect.</v-card-subtitle>
				<v-card-text>
					<LoadingState v-if="sessions === null" state="loading" />
					<p v-else-if="sessions.length === 0"><i>None</i></p>
					<v-table v-else>
						<thead>
							<tr>
								<th style="width: 99%">Device</th>
								<th style="width: 0" class="text-no-wrap">IP</th>
								<th style="width: 0" class="text-no-wrap">Created</th>
								<th style="width: 0" class="text-no-wrap">Last active</th>
								<th style="width: 0"></th>
							</tr>
						</thead>
						<tbody>
							<tr v-for="s in sessions" :key="s.id">
								<td>{{ describeDevice(s) }}</td>
								<td>{{ s.ip || '' }}</td>
								<td class="text-no-wrap"><abbr :title="s.createdAt || ''">{{ formatAge(s.createdAt) }}</abbr></td>
								<td class="text-no-wrap"><abbr :title="s.lastActiveAt || ''">{{ formatAge(s.lastActiveAt) }}</abbr></td>
								<td style="text-align: right">
									<span v-if="s.current" class="text-medium-emphasis">This device</span>
									<v-btn v-else icon="mdi-logout" size="small" variant="elevated" color="error" title="Revoke" @click="askRevokeSession(s)" />
								</td>
							</tr>
						</tbody>
					</v-table>
				</v-card-text>
			</v-card>

			<v-dialog v-model="revokeDialog" max-width="400">
				<v-card v-if="revokeTarget">
					<v-card-title>Revoke session?</v-card-title>
					<v-card-text>
						<p class="mb-2">Sign this device out:</p>
						<p class="text-body-2"><b>{{ describeDevice(revokeTarget) }}</b></p>
						<p class="text-body-2" v-if="revokeTarget.ip">{{ revokeTarget.ip }}</p>
					</v-card-text>
					<v-card-actions>
						<v-spacer />
						<v-btn variant="text" @click="revokeDialog = false" :disabled="revoking">Cancel</v-btn>
						<v-btn color="error" @click="confirmRevokeSession()" :loading="revoking">Revoke</v-btn>
					</v-card-actions>
				</v-card>
			</v-dialog>

			<!-- API token -->
			<v-card variant="elevated" elevation="1" class="mb-6">
				<v-card-title>API Token</v-card-title>
				<v-card-subtitle>
					Use this token for <a href="/#/api">API calls</a>.
					<span class="text-body-2" v-if="tokenExpiryLabel">{{ tokenExpiryLabel }}.</span>
				</v-card-subtitle>
				<v-card-actions>
					<v-spacer />
					<v-btn color="primary" :disabled="!tokenExpiry" @click="copyToken()">Copy token</v-btn>
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
