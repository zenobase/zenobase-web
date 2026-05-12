<script setup lang="ts">
import { computed, inject, onMounted, ref, watch } from 'vue';
import type { ConnectedApp } from '../../types';
import { param } from '../../utils/helpers';
import api from '../api';
import EditConnectedAppDialog from '../components/EditConnectedAppDialog.vue';
import LoadingState from '../components/LoadingState.vue';
import { type AlertApi, alertKey } from '../composables/useAlert';
import { type AuthApi, authKey } from '../composables/useAuth';
import { SUPPORT_EMAIL } from '../constants';
import { formatDuration } from '../utils/eventFormatter';
import { formatAge } from '../utils/formatAge';

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
const currentToken = ref<string | null>(null);
onMounted(async () => {
	currentToken.value = await auth.getToken();
});
const tokenExpiry = computed(() => {
	const token = currentToken.value;
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
	const token = currentToken.value;
	if (!token) return;
	try {
		await navigator.clipboard.writeText(token);
		alertApi.show('API token copied to clipboard.', 'success', '');
	} catch {
		alertApi.show("Couldn't copy token to clipboard.", 'error');
	}
}

// Passkeys
type Passkey = { id: string; name?: string; created: string; last_auth?: string; user_agent?: string };
const passkeys = ref<Passkey[] | null>(null);

async function loadPasskeys() {
	try {
		const response = await api.get<Passkey[]>(`/users/${auth.user.value!['@id']}/passkeys`);
		passkeys.value = response.data;
	} catch {
		passkeys.value = [];
	}
}

async function deletePasskey(id: string) {
	if (!confirm('Remove this passkey? You will no longer be able to sign in with it.')) return;
	alertApi.clear();
	try {
		await api.del(`/users/${auth.user.value!['@id']}/passkeys/${id}`);
		alertApi.show('Passkey removed.', 'success', '');
		await loadPasskeys();
	} catch (e: unknown) {
		const status = (e as { status?: number }).status;
		alertApi.show(status && status < 500 ? "Can't remove this passkey." : "Couldn't remove passkey. Try again later or contact support.", 'error');
	}
}

function passkeyLabel(p: Passkey): string {
	return p.name || passkeyDeviceLabel(p.user_agent) || 'Passkey';
}

function passkeyDeviceLabel(ua: string | undefined): string | null {
	if (!ua) return null;
	if (/iPhone/i.test(ua)) return 'iPhone';
	if (/iPad/i.test(ua)) return 'iPad';
	if (/Android/i.test(ua)) return 'Android';
	if (/Mac OS X/i.test(ua)) return 'Mac';
	if (/Windows/i.test(ua)) return 'Windows';
	if (/Linux/i.test(ua)) return 'Linux';
	return null;
}

// Credentials
const credentials = ref<Array<{ '@id': string; type: string; authorizationUrl?: string }> | null>(null);
const credOffset = ref(0);
const credLimit = 10;
const credTotal = ref(0);

// Connected apps (MCP / third-party clients)
const connectedApps = ref<ConnectedApp[] | null>(null);
const connectedAppsBuckets = ref<Array<{ '@id': string; label?: string }>>([]);
const editingApp = ref<ConnectedApp | null>(null);
const showEditApp = ref(false);

async function loadConnectedApps() {
	try {
		const response = await api.get<{ total: number; connected_apps: ConnectedApp[] }>(
			`/users/${auth.user.value!['@id']}/connected-apps/`,
		);
		connectedApps.value = response.data.connected_apps;
	} catch {
		connectedApps.value = [];
	}
}

async function loadConnectedAppsBuckets() {
	if (!auth.user.value) return;
	try {
		const response = await api.get<{ buckets: Array<{ '@id': string; label?: string }> }>(
			`/users/${auth.user.value['@id']}/buckets/?${param({ order: 'label', offset: 0, limit: 100, labels_only: true })}`,
		);
		connectedAppsBuckets.value = response.data.buckets;
	} catch {
		connectedAppsBuckets.value = [];
	}
}

function editConnectedApp(app: ConnectedApp) {
	editingApp.value = app;
	showEditApp.value = true;
}

function onConnectedAppSaved(updated: ConnectedApp) {
	if (!connectedApps.value) return;
	const index = connectedApps.value.findIndex((a) => a.client_id === updated.client_id);
	if (index >= 0) {
		connectedApps.value[index] = updated;
	}
}

async function revokeConnectedApp(app: ConnectedApp) {
	const name = app.client_name || app.client_id;
	if (!confirm(`Revoke ${name}? It will lose access to all your buckets.`)) return;
	alertApi.clear();
	try {
		await api.del(`/users/${auth.user.value!['@id']}/connected-apps/${encodeURIComponent(app.client_id)}`);
		alertApi.show(`Revoked ${name}.`, 'success', '');
		await loadConnectedApps();
	} catch (e: unknown) {
		const status = (e as { status?: number }).status;
		alertApi.show(status && status < 500 ? "Can't revoke this app." : "Couldn't revoke this app. Try again later or contact support.", 'error');
	}
}

function readableBucketsLabel(app: ConnectedApp): string {
	const n = app.readable_buckets.length;
	if (n === 0) return 'No buckets granted';
	if (n === 1) return '1 bucket';
	return `${n} buckets`;
}


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

function refresh() {
	loadQuota();
	loadPasskeys();
	loadCredentials();
	loadConnectedApps();
	loadConnectedAppsBuckets();
}

watch(
	() => auth.user.value,
	async () => {
		if (!auth.user.value?.name) return;
		settingsEmail.value = (auth.user.value as typeof auth.user.value & { email?: string }).email || '';
		await Promise.all([loadQuota(), loadPasskeys(), loadCredentials(), loadConnectedApps(), loadConnectedAppsBuckets()]);
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

		<div class="settings-container pt-4 px-4">
			<!-- Quota -->
			<template v-if="quota">
				<section>
					<h2 class="settings-heading">Quota</h2>
					<v-progress-linear :model-value="quota.used / quota.limit * 100" :color="quota.used >= quota.limit ? 'error' : quota.used >= quota.limit * 0.8 ? 'warning' : 'success'" height="10" rounded class="mb-2" />
					<p class="text-body-2">{{ quota.used.toLocaleString() }} / {{ quota.limit.toLocaleString() }} events. {{ quotaResetLabel }}. <a :href="`mailto:${SUPPORT_EMAIL}`">Contact support</a> to increase your quota.</p>
				</section>
				<v-divider class="my-8" />
			</template>

			<!-- Email -->
			<section>
				<h2 class="settings-heading">Email</h2>
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
				<div class="settings-actions">
					<v-spacer />
					<v-btn color="primary" :disabled="!emailDirty" @click="saveEmail()">Save</v-btn>
				</div>
			</section>

			<v-divider class="my-8" />

			<!-- Passkeys -->
			<section>
				<h2 class="settings-heading">Passkeys</h2>
				<p class="settings-subtitle">
					Sign in without a password using a fingerprint, face scan, or PIN.
					To add a passkey, sign out and sign back in on the device you'd like to enroll &mdash; you'll be prompted to create one.
				</p>
				<v-table>
					<tbody>
						<tr v-if="passkeys === null"><td colspan="2"><LoadingState state="loading" /></td></tr>
						<tr v-else-if="passkeys.length === 0"><td colspan="2"><i>No passkeys enrolled</i></td></tr>
						<tr v-for="p in passkeys" :key="p.id" class="credentials-row" @contextmenu.prevent="onRowLongPress(p.id)">
							<td>
								<div>{{ passkeyLabel(p) }}</div>
								<div class="text-caption" style="color: rgba(0,0,0,0.6)">
									Added {{ formatAge(p.created, 7 * 24 * 60 * 60 * 1000) }}<span v-if="p.last_auth"> &middot; last used {{ formatAge(p.last_auth, 30 * 24 * 60 * 60 * 1000) }}</span>
								</div>
							</td>
							<td style="text-align: right; position: relative; overflow: visible">
								<div class="row-actions" :class="{ 'row-actions--visible': longPressedRowId === p.id }">
									<v-btn icon="mdi-delete-outline" size="small" variant="elevated" color="error" title="Remove" @click.stop="deletePasskey(p.id)" />
								</div>
							</td>
						</tr>
					</tbody>
				</v-table>
			</section>

			<v-divider class="my-8" />

			<!-- Connected apps -->
			<section>
				<h2 class="settings-heading">Connected apps</h2>
				<p class="settings-subtitle">Third-party apps you've allowed to read your data.</p>
				<v-table>
					<tbody>
						<tr v-if="connectedApps === null"><td colspan="2"><LoadingState state="loading" /></td></tr>
						<tr v-else-if="connectedApps.length === 0"><td colspan="2"><i>No apps connected</i></td></tr>
						<tr v-for="app in connectedApps" :key="app.client_id" class="credentials-row" @contextmenu.prevent="onRowLongPress(app.client_id)">
							<td @click="editConnectedApp(app)" style="cursor: pointer">
								<div class="d-flex align-center ga-2">
									<span>{{ app.client_name || app.client_id }}</span>
									<v-chip v-if="app.readable_buckets.length === 0" color="warning" size="x-small" variant="tonal">Pending</v-chip>
								</div>
								<div class="text-caption" style="color: rgba(0,0,0,0.6)">
									{{ readableBucketsLabel(app) }} &middot; connected {{ formatAge(app.first_seen_at, 30 * 24 * 60 * 60 * 1000) }}
								</div>
							</td>
							<td style="text-align: right; position: relative; overflow: visible">
								<div class="row-actions" :class="{ 'row-actions--visible': longPressedRowId === app.client_id }">
									<v-btn icon="mdi-pencil-outline" size="small" variant="elevated" color="primary" title="Edit access" class="mr-1" @click.stop="editConnectedApp(app)" />
									<v-btn icon="mdi-delete-outline" size="small" variant="elevated" color="error" title="Revoke" @click.stop="revokeConnectedApp(app)" />
								</div>
							</td>
						</tr>
					</tbody>
				</v-table>
			</section>

			<EditConnectedAppDialog
				v-if="editingApp"
				v-model="showEditApp"
				:user-id="auth.user.value!['@id']"
				:app="editingApp"
				:buckets="connectedAppsBuckets"
				@saved="onConnectedAppSaved"
			/>

			<v-divider class="my-8" />

			<!-- Credentials -->
			<section>
				<h2 class="settings-heading">Credentials</h2>
				<p class="settings-subtitle">You have granted Zenobase access to data in these services</p>
				<v-table>
					<tbody>
						<tr v-if="credentials === null"><td colspan="2"><LoadingState state="loading" /></td></tr>
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
				<div class="settings-actions" v-if="credentials?.length">
					<v-spacer />
					<v-btn icon variant="text" title="Previous" :disabled="credOffset <= 0" @click="() => { credOffset -= credLimit; loadCredentials() }"><v-icon icon="mdi-chevron-left" /></v-btn>
					<span style="color: rgba(0,0,0,0.5)"><b>{{ credOffset + 1 }}</b>&ndash;<b>{{ credOffset + (credentials?.length ?? 0) }}</b> of <b>{{ credTotal }}</b></span>
					<v-btn icon variant="text" title="Next" :disabled="credOffset + credLimit >= credTotal" @click="() => { credOffset += credLimit; loadCredentials() }"><v-icon icon="mdi-chevron-right" /></v-btn>
				</div>
			</section>

			<v-divider class="my-8" />

			<!-- API token -->
			<section>
				<h2 class="settings-heading">API Token</h2>
				<p class="settings-subtitle">
					Use this token for <a href="/#/api">API calls</a>.
					<span v-if="tokenExpiryLabel">{{ tokenExpiryLabel }}.</span>
				</p>
				<div class="settings-actions">
					<v-spacer />
					<v-btn color="primary" :disabled="!tokenExpiry" @click="copyToken()">Copy token</v-btn>
				</div>
			</section>

			<v-divider class="my-8" />

			<div>
				<v-btn variant="text" color="error" @click="closeAccount()">Close account...</v-btn>
			</div>
		</div>
	</div>
</template>

<style scoped>
.settings-container {
	max-width: 800px;
	margin: 0 auto;
}
.settings-heading {
	font-size: 1.125rem;
	font-weight: 600;
	margin: 0 0 0.75rem;
}
.settings-subtitle {
	color: rgba(0, 0, 0, 0.6);
	margin: -0.25rem 0 1rem;
	font-size: 0.875rem;
}
.settings-actions {
	display: flex;
	align-items: center;
	margin-top: 1rem;
}
</style>
