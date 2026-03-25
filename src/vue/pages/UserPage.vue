<script setup lang="ts">
import { computed, inject, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import type { Bucket, User, WidgetSettings } from '../../types';
import { Constraint } from '../../utils/constraint';
import { param } from '../../utils/helpers';
import api, { ApiError } from '../api';
import { type AlertApi, alertKey } from '../composables/useAlert';
import { type AuthApi, authKey } from '../composables/useAuth';

const route = useRoute();
const router = useRouter();
const auth = inject<AuthApi>(authKey)!;
const alertApi = inject<AlertApi>(alertKey)!;

const username = computed(() => route.params.username as string);
const profile = ref<User | null>(null);
const message = ref('');

const isSelf = computed(() => auth.user.value && profile.value && (profile.value.name || 'guest') === (auth.user.value.name || 'guest'));

// Bucket list
const buckets = ref<Array<Bucket & { size: number }> | null>(null);
const bucketOffset = ref(0);
const bucketLimit = 10;
const bucketTotal = ref(0);
const includeArchived = ref(false);

// Credentials list
const credentials = ref<Array<{ '@id': string; type: string; authorizationUrl?: string }> | null>(null);
const credOffset = ref(0);
const credLimit = 10;
const credTotal = ref(0);

// Authorizations list
const authorizations = ref<Array<{ '@id': string; client: string; scope?: string }> | null>(null);
const authzOffset = ref(0);
const authzLimit = 10;
const authzTotal = ref(0);

// Bucket refresh loading state
const loadingBuckets = ref<Record<string, boolean>>({});

async function runBucket(bucketId: string) {
	loadingBuckets.value[bucketId] = true;
	alertApi.clear();
	try {
		const response = await api.get<{ tasks: Array<{ '@id': string }> }>(`/buckets/${bucketId}/tasks/`);
		for (const task of response.data.tasks) {
			await api.get(`/tasks/${task['@id']}`);
		}
		setTimeout(() => loadBuckets(), 1000);
	} catch {
		// silently fail
	} finally {
		delete loadingBuckets.value[bucketId];
	}
}

// Account settings dialog
const showSettings = ref(false);
const settingsEmail = ref('');
const settingsMessage = ref('');
const quota = ref<{ used: number; limit: number } | null>(null);

// Create view dialog
const showCreateView = ref(false);
const createViewLabel = ref('My View');
const createViewAliases = ref<Array<{ '@id': string; label: string; filter?: string }>>([]);
const createViewSelected = ref<{ '@id': string; label: string; aliases?: unknown[] } | null>(null);
const createViewFilter = ref('');
const createViewBuckets = ref<Array<{ '@id': string; label: string; aliases?: unknown[] }>>([]);
const createViewMessage = ref('');

const createViewFilterValid = computed(() => {
	if (!createViewFilter.value) return true;
	try {
		const parts = createViewFilter.value.split('|');
		return parts.every((part) => {
			Constraint.parse(part.trim());
			return true;
		});
	} catch {
		return false;
	}
});

const listViewBuckets = computed(() => {
	return createViewBuckets.value.filter((bucket) => !bucket.aliases && !createViewAliases.value.some((alias) => alias['@id'] === bucket['@id']));
});

async function openCreateView() {
	createViewLabel.value = 'My View';
	createViewMessage.value = '';
	createViewAliases.value = [];
	createViewSelected.value = null;
	createViewFilter.value = '';
	showCreateView.value = true;
	try {
		const response = await api.get<{ buckets: typeof createViewBuckets.value }>(`/users/${profile.value!['@id']}/buckets/?${param({ order: 'label', offset: 0, limit: 100, labels_only: true })}`);
		createViewBuckets.value = response.data.buckets;
	} catch {
		// silently fail
	}
}

function addBucketToView() {
	if (!createViewSelected.value) return;
	const alias: { '@id': string; label: string; filter?: string } = {
		'@id': createViewSelected.value['@id'],
		label: createViewSelected.value.label,
	};
	if (createViewFilter.value) {
		alias.filter = createViewFilter.value;
	}
	createViewAliases.value = [...createViewAliases.value, alias];
	createViewSelected.value = null;
	createViewFilter.value = '';
}

function removeBucketFromView(bucketId: string) {
	createViewAliases.value = createViewAliases.value.filter((alias) => alias['@id'] !== bucketId);
}

async function createView() {
	alertApi.clear();
	createViewMessage.value = '';
	try {
		const aliases = createViewAliases.value.map((alias) => ({ '@id': alias['@id'], filter: alias.filter }));
		const response = await api.post<unknown>('/buckets/', { label: createViewLabel.value, aliases });
		showCreateView.value = false;
		const location = response.headers('Location');
		if (location) {
			window.location.hash = `#${location}`;
		}
		await loadBuckets();
	} catch (e: unknown) {
		const status = (e as { status?: number }).status;
		createViewMessage.value = status === 400 ? "Can't create view." : "Couldn't create view. Please try again later or contact support.";
	}
}

// Create bucket dialog
const showCreateBucket = ref(false);
const newBucketLabel = ref('My Data');
const createBucketMessage = ref('');

// Template data for create bucket
interface BucketTemplate {
	source: string;
	category: string;
	label?: string;
	widgets: WidgetSettings[];
	task?: Record<string, unknown>;
	importer?: Record<string, unknown>;
}
const templates = ref<BucketTemplate[]>([]);
const templateSource = ref('');
const templateCategory = ref('');
const selectedTemplate = computed(() => {
	if (templateSource.value && templateCategory.value) {
		return templates.value.find((t) => t.source === templateSource.value && t.category === templateCategory.value) || null;
	}
	return null;
});
const templateSources = computed(() => {
	const sources: string[] = [];
	templates.value.forEach((t) => {
		if (!templateCategory.value || templateCategory.value === t.category) {
			if (!sources.includes(t.source)) {
				sources.push(t.source);
			}
		}
	});
	return sources.sort((a, b) => a.localeCompare(b));
});
const templateCategories = computed(() => {
	const categories: string[] = [];
	templates.value.forEach((t) => {
		if (!templateSource.value || templateSource.value === t.source) {
			if (!categories.includes(t.category)) {
				categories.push(t.category);
			}
		}
	});
	return categories.sort();
});
const createBucketValid = computed(() => (templateSource.value && templateCategory.value) || (!templateSource.value && !templateCategory.value));

async function openCreateBucket() {
	newBucketLabel.value = 'My Data';
	createBucketMessage.value = '';
	templateSource.value = '';
	templateCategory.value = '';
	showCreateBucket.value = true;
	try {
		const response = await api.get<BucketTemplate[]>('/dashboard/templates.json');
		templates.value = Array.isArray(response.data) ? response.data : [];
	} catch {
		// silently fail
	}
}

function formatClient(client: string): string {
	if (!client) return '';
	return client.replace(/^\/users\//, '');
}

const bucketLabels = ref<Record<string, string>>({});

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

async function loadProfile() {
	message.value = '';
	profile.value = null;

	if (auth.user.value && username.value === (auth.user.value.name || 'guest')) {
		profile.value = auth.user.value;
	} else if (username.value !== 'guest') {
		try {
			const response = await api.get<User>(`/users/@${username.value}`);
			profile.value = response.data;
		} catch (e: unknown) {
			const status = (e as { status?: number }).status;
			if (status && status < 500) {
				message.value = "Can't retrieve this user.";
			} else {
				message.value = "Couldn't retrieve this user. Try again later or contact support.";
			}
		}
	}
}

async function loadBuckets(overrides: Record<string, unknown> = {}) {
	if (!profile.value || !isSelf.value) return;
	const params = { order: 'label', offset: bucketOffset.value, limit: bucketLimit, include_archived: includeArchived.value, ...overrides };
	try {
		const response = await api.get<{ total: number; buckets: Array<Bucket & { size: number }> }>(`/users/${profile.value['@id']}/buckets/?${param(params)}`);
		Object.assign(params, overrides);
		bucketOffset.value = params.offset as number;
		includeArchived.value = params.include_archived as boolean;
		if (response.data.total === 0 && !includeArchived.value) {
			await loadBuckets({ include_archived: true });
		} else {
			bucketTotal.value = response.data.total;
			buckets.value = response.data.buckets;
		}
	} catch {
		// silently fail
	}
}

async function loadCredentials() {
	if (!profile.value || !isSelf.value) return;
	try {
		const response = await api.get<{ total: number; items: typeof credentials.value }>(`/users/${profile.value['@id']}/credentials/?${param({ offset: credOffset.value, limit: credLimit })}`);
		credTotal.value = response.data.total;
		credentials.value = response.data.items;
	} catch {
		// silently fail
	}
}

async function loadAuthorizations() {
	if (!profile.value || !isSelf.value) return;
	try {
		const response = await api.get<{ total: number; authorizations: typeof authorizations.value }>(
			`/users/${profile.value['@id']}/authorizations/?${param({ has_client: true, offset: authzOffset.value, limit: authzLimit })}`,
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

async function revokeAuthorization(id: string) {
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

async function openSettings() {
	settingsEmail.value = (profile.value as User & { email?: string }).email || '';
	settingsMessage.value = '';
	showSettings.value = true;
	try {
		const response = await api.get<{ used: number; limit: number }>(`/users/${auth.user.value!['@id']}/quota`);
		quota.value = response.data;
	} catch {
		// silently fail
	}
}

async function saveSettings() {
	alertApi.clear();
	const data: Record<string, string> = {};
	const currentEmail = (profile.value as User & { email?: string }).email || '';
	if ((settingsEmail.value && settingsEmail.value !== currentEmail) || !profile.value?.verified) {
		data.email = settingsEmail.value;
	}
	if (Object.keys(data).length === 0) {
		showSettings.value = false;
		return;
	}
	try {
		const response = await api.post(`/users/@${username.value}`, data);
		alertApi.show('Updated account settings.', 'success', response.headers('X-Command-ID') || '');
		showSettings.value = false;
		await auth.whoami();
	} catch (e: unknown) {
		const status = (e as { status?: number }).status;
		settingsMessage.value = status && status < 500 ? "Can't save these changes." : "Couldn't save these changes. Try again later or contact support.";
	}
}

async function closeAccount() {
	if (!confirm('Close your account and delete all associated data?')) return;
	try {
		await api.del(`/users/@${username.value}`);
		showSettings.value = false;
		await auth.signOut();
	} catch (e: unknown) {
		const status = (e as { status?: number }).status;
		settingsMessage.value = status && status < 500 ? "Can't close this account." : "Couldn't close this account. Try again later or contact support.";
	}
}

async function createBucket() {
	alertApi.clear();
	createBucketMessage.value = '';
	try {
		const template = selectedTemplate.value;
		const widgets = template ? template.widgets : [];
		const payload: Record<string, unknown> = { label: newBucketLabel.value, widgets };
		if (template?.task) {
			payload.task = template.task;
		}
		if (template?.importer) {
			payload.importer = template.importer;
		}
		const response = await api.post<unknown>('/buckets/', payload);
		showCreateBucket.value = false;
		const location = response.headers('Location');
		if (location) {
			window.location.hash = `#${location}`;
		}
		await loadBuckets();
	} catch (e: unknown) {
		const status = (e as { status?: number }).status;
		createBucketMessage.value = status === 400 ? "Can't create bucket." : "Couldn't create bucket. Please try again later or contact support.";
	}
}

watch(
	() => auth.user.value,
	async () => {
		await loadProfile();
		if (isSelf.value) {
			await Promise.all([loadBuckets(), loadCredentials(), loadAuthorizations()]);
			if (route.query.settings) {
				router.replace({ query: {} });
				openSettings();
			}
			if (route.query.openCreateBucket) {
				router.replace({ query: {} });
				setTimeout(() => {
					openCreateBucket();
				}, 1000);
			}
		}
	},
	{ immediate: true },
);

watch(
	() => route.params.username,
	async () => {
		await loadProfile();
		if (isSelf.value) {
			await Promise.all([loadBuckets(), loadCredentials(), loadAuthorizations()]);
		}
	},
);
</script>

<template>
	<div class="container-fluid">
		<div v-if="message" class="alert alert-block alert-error">{{ message }}</div>

		<div v-if="!profile && !message">Loading...</div>

		<div v-if="profile">
			<!-- Title bar -->
			<div class="row-fluid page-titlebar">
				<p class="pull-left page-title">
					<span class="page-title-text">{{ username }}</span>
					{{ ' ' }}
					<a class="page-title-decoration" @click="loadBuckets(); loadCredentials(); loadAuthorizations()" v-if="isSelf" title="Refresh"><i class="fa fa-refresh" /></a>
				</p>

				<div class="pull-right page-title dropdown" v-if="isSelf && profile.name">
					<a class="dropdown-toggle" data-toggle="dropdown" title="More..."> {{ ' ' }} <i class="fa fa-bars" /> {{ ' ' }} <b class="caret" /></a>
					<ul class="dropdown-menu" role="menu">
						<li role="presentation">
							<a role="menuitem" @click="openSettings()">Settings...</a>
						</li>
					</ul>
				</div>
			</div>

			<div class="alert alert-block alert-info" v-if="!isSelf">
				Sign in as this user for more information.
			</div>

			<div class="row-fluid" v-if="isSelf">
				<!-- Buckets -->
				<div class="span4">
					<table class="table">
						<thead>
							<tr>
								<th style="width: 100%">Buckets</th>
								<th style="width: 0px" />
							</tr>
						</thead>
						<tbody>
							<tr v-if="buckets === null"><td colspan="2"><i>Loading...</i></td></tr>
							<tr v-else-if="buckets.length === 0"><td colspan="2"><i>None</i></td></tr>
							<tr v-for="b in buckets" :key="b['@id']" class="bucket-row" :class="{ 'bucket-archived': b.archived, 'bucket-virtual': b.aliases && b.aliases.length }">
								<td style="white-space: nowrap">
									<router-link class="bucket-link" :to="`/buckets/${b['@id']}/`">{{ b.label }}</router-link>
									{{ ' ' }} ({{ b.size?.toLocaleString() }})
								</td>
								<td style="text-align: right; white-space: nowrap">
									<a class="action bucket-refresh-action" @click="runBucket(b['@id'])"><i class="fa fa-refresh" :class="{ 'fa-spin': loadingBuckets[b['@id']] }" title="Refresh" /></a>
								</td>
							</tr>
						</tbody>
					</table>
					<div class="btn-toolbar">
						<div class="btn-group pull-left">
							<a class="btn dropdown-toggle" data-toggle="dropdown" title="Create..."><i class="fa fa-plus" /> {{ ' ' }} <span class="caret" /></a>
							<ul class="dropdown-menu">
								<li role="presentation"><a role="menuitem" @click="openCreateBucket()">Bucket...</a></li>
								<li role="presentation"><a role="menuitem" @click="openCreateView()">View...</a></li>
							</ul>
						</div>
						<div class="btn-group pull-right" v-if="buckets?.length">
							<button class="btn" title="Previous" :disabled="bucketOffset <= 0" @click="bucketOffset -= bucketLimit; loadBuckets()"><i class="fa fa-chevron-left" /></button>
							<button class="btn" title="Next" :disabled="bucketOffset + bucketLimit >= bucketTotal" @click="bucketOffset += bucketLimit; loadBuckets()"><i class="fa fa-chevron-right" /></button>
						</div>
						<div class="btn-group pull-right" v-if="buckets?.length">
							<button class="btn disabled zeno-paging">
								<b>{{ bucketOffset + 1 }}</b> &ndash; <b>{{ bucketOffset + (buckets?.length ?? 0) }}</b> of <b>{{ bucketTotal }}</b>
								{{ ' ' }}
								<a v-if="!includeArchived" @click="includeArchived = true; loadBuckets()">excluding</a>
								<a v-else @click="includeArchived = false; loadBuckets()">including</a>
								{{ ' ' }} archived
							</button>
						</div>
					</div>
				</div>

				<!-- Credentials -->
				<div class="span4">
					<table class="table">
						<thead>
							<tr>
								<th>Credentials</th>
								<th />
							</tr>
						</thead>
						<tbody>
							<tr v-if="credentials === null"><td colspan="2"><i>Loading...</i></td></tr>
							<tr v-else-if="credentials.length === 0"><td colspan="2"><i>None</i></td></tr>
							<tr v-for="c in credentials" :key="c['@id']" class="credentials-row">
								<td><span :class="{ 'credentials-invalid': c.authorizationUrl }">{{ c.type }}</span></td>
								<td style="text-align: right">
									<a class="action credentials-delete-action" @click="deleteCredentials(c['@id'])"><i class="fa fa-trash-o" title="Delete" /></a>
								</td>
							</tr>
						</tbody>
					</table>
					<div class="btn-toolbar" v-if="credentials?.length">
						<div class="btn-group pull-right">
							<button class="btn" title="Previous" :disabled="credOffset <= 0" @click="credOffset -= credLimit; loadCredentials()"><i class="fa fa-chevron-left" /></button>
							<button class="btn" title="Next" :disabled="credOffset + credLimit >= credTotal" @click="credOffset += credLimit; loadCredentials()"><i class="fa fa-chevron-right" /></button>
						</div>
						<div class="btn-group pull-right">
							<button class="btn disabled zeno-paging"><b>{{ credOffset + 1 }}</b> &ndash; <b>{{ credOffset + (credentials?.length ?? 0) }}</b> of <b>{{ credTotal }}</b></button>
						</div>
					</div>
				</div>

				<!-- Authorizations -->
				<div class="span4">
					<table class="table">
						<thead>
							<tr>
								<th>Authorizations</th>
								<th />
							</tr>
						</thead>
						<tbody>
							<tr v-if="authorizations === null"><td colspan="2"><i>Loading</i></td></tr>
							<tr v-else-if="authorizations.length === 0"><td colspan="2"><i>None</i></td></tr>
							<tr v-for="a in authorizations" :key="a['@id']">
								<td>{{ formatClient(a.client) }} {{ ' ' }} <span v-if="a.scope">({{ bucketLabels[a.scope] || a.scope }})</span><span v-else>(*)</span></td>
								<td style="text-align: right">
									<a class="action" @click="revokeAuthorization(a['@id'])" title="Delete"><i class="fa fa-trash-o" /></a>
								</td>
							</tr>
						</tbody>
					</table>
					<div class="btn-toolbar" v-if="authorizations?.length">
						<div class="btn-group pull-right">
							<button class="btn" title="Previous" :disabled="authzOffset <= 0" @click="authzOffset -= authzLimit; loadAuthorizations()"><i class="fa fa-chevron-left" /></button>
							<button class="btn" title="Next" :disabled="authzOffset + authzLimit >= authzTotal" @click="authzOffset += authzLimit; loadAuthorizations()"><i class="fa fa-chevron-right" /></button>
						</div>
						<div class="btn-group pull-right">
							<button class="btn disabled zeno-paging"><b>{{ authzOffset + 1 }}</b> &ndash; <b>{{ authzOffset + (authorizations?.length ?? 0) }}</b> of <b>{{ authzTotal }}</b></button>
						</div>
					</div>
				</div>
			</div>
		</div>

		<!-- Account Settings Dialog -->
		<div class="modal" :class="{ hide: !showSettings, in: showSettings, fade: true }" :style="showSettings ? { display: 'block', top: '10%' } : {}">
			<form class="modal-form" @submit.prevent="saveSettings()">
				<div class="modal-header">
					<a class="close" @click="showSettings = false">&times;</a>
					<h4>Account Settings</h4>
				</div>
				<div class="modal-body">
					<div class="alert alert-error" v-if="settingsMessage">{{ settingsMessage }}</div>
					<div class="control-group" v-if="quota">
						<label class="control-label">Quota</label>
						<div class="progress" style="margin-bottom: 10px">
							<div class="bar bar-success" :style="{ width: (quota.used / quota.limit * 100) + '%' }" />
						</div>
						<p class="help-block">{{ quota.used.toLocaleString() }} / {{ quota.limit.toLocaleString() }} events. <a href="mailto:support@zenobase.com">Contact support</a> to increase your quota.</p>
					</div>
					<div class="control-group">
						<label class="control-label">User ID</label>
						<div class="controls">
							<span class="input-large uneditable-input">{{ profile?.['@id'] }}</span>
						</div>
					</div>
					<div class="control-group">
						<label class="control-label" for="edit-email">Email</label>
						<div class="controls">
							<input type="email" class="input-large" required v-model="settingsEmail" />
							<p class="help-block">
								For important, account-related messages.
								<strong v-if="profile?.verified">Verified.</strong>
								<strong v-else>Not verified.</strong>
							</p>
						</div>
					</div>
				</div>
				<div class="modal-footer">
					<a class="pull-left" @click="closeAccount()">Close account...</a>
					<button type="submit" class="btn btn-primary">Save &amp; Verify</button>
					{{ ' ' }}
					<button type="button" class="btn" @click="showSettings = false">Cancel</button>
				</div>
			</form>
		</div>
		<div v-if="showSettings" class="modal-backdrop fade in" @click="showSettings = false" />

		<!-- Create Bucket Dialog -->
		<div v-if="showCreateBucket" class="modal-backdrop fade in" @click="showCreateBucket = false" />
		<div class="modal" :class="{ hide: !showCreateBucket, in: showCreateBucket, fade: true }" :style="showCreateBucket ? { display: 'block', top: '10%' } : {}">
			<form class="modal-form" @submit.prevent="createBucket()">
				<div class="modal-header">
					<a class="close" @click="showCreateBucket = false">&times;</a>
					<h4>Create Bucket</h4>
				</div>
				<div class="modal-body">
					<div class="alert alert-error" v-if="createBucketMessage">{{ createBucketMessage }}</div>
					<div class="control-group">
						<label for="create-bucket-label"><strong>Label</strong></label>
						<div class="input-append">
							<input id="create-bucket-label" type="text" class="input-xlarge" required minlength="1" maxlength="30" v-model="newBucketLabel" />
							<span class="add-on">
								<i v-if="!newBucketLabel" class="fa fa-exclamation" title="not valid" />
								<i v-else class="fa fa-check" title="valid" />
							</span>
						</div>
					</div>
					<div class="control-group">
						<label for="bucket-template-select"><strong>Template</strong></label>
						<select id="bucket-source-select" class="input-medium" v-model="templateSource">
							<option value="">(Source)</option>
							<option v-for="source in templateSources" :key="source" :value="source">{{ source }}</option>
						</select>
						{{ ' ' }}
						<select id="bucket-category-select" class="input-medium" v-model="templateCategory">
							<option value="">(Category)</option>
							<option v-for="category in templateCategories" :key="category" :value="category">{{ category }}</option>
						</select>
						<p class="help-block">
							<i>Choose a template to preconfigure the bucket for a data source.</i>
						</p>
					</div>
				</div>
				<div class="modal-footer">
					<button id="create-bucket-button" type="submit" class="btn btn-primary" :disabled="!newBucketLabel || !createBucketValid">Create</button>
					{{ ' ' }}
					<button type="button" class="btn" @click="showCreateBucket = false">Cancel</button>
				</div>
			</form>
		</div>
		<!-- Create View Dialog -->
		<div v-if="showCreateView" class="modal-backdrop fade in" @click="showCreateView = false" />
		<div class="modal" :class="{ hide: !showCreateView, in: showCreateView, fade: true }" :style="showCreateView ? { display: 'block', top: '10%' } : {}">
			<form class="modal-form" @submit.prevent="createView()">
				<div class="modal-header">
					<a class="close" @click="showCreateView = false">&times;</a>
					<h4>Create View</h4>
				</div>
				<div class="modal-body">
					<div class="alert alert-error" v-if="createViewMessage">{{ createViewMessage }}</div>
					<div class="control-group">
						<label for="create-view-label"><strong>Label</strong></label>
						<div class="input-append">
							<input id="create-view-label" type="text" class="input-xlarge" required minlength="1" maxlength="30" v-model="createViewLabel" />
							<span class="add-on">
								<i v-if="!createViewLabel" class="fa fa-exclamation" title="not valid" />
								<i v-else class="fa fa-check" title="valid" />
							</span>
						</div>
					</div>
					<div class="control-group">
						<ul class="nav nav-pills gray">
							<li class="active" v-for="alias in createViewAliases" :key="alias['@id']">
								<a @click="removeBucketFromView(alias['@id'])">
									<i v-if="alias.filter" class="fa fa-filter fa-white" :title="alias.filter" />
									{{ alias.label }} <i class="fa fa-times fa-white" />
								</a>
							</li>
						</ul>
						<div class="form-horizontal">
							<select id="include-bucket-select" class="input-medium" v-model="createViewSelected">
								<option :value="null" />
								<option v-for="bucket in listViewBuckets" :key="bucket['@id']" :value="bucket">{{ bucket.label }}</option>
							</select>
							{{ ' ' }}
							<span class="input-append">
								<input id="include-bucket-filter" type="text" class="input-medium" v-model="createViewFilter" :disabled="!createViewSelected" placeholder="e.g. tag:xyz" />
								<span class="add-on">
									<i v-if="!createViewFilterValid" class="fa fa-exclamation" title="not valid" />
									<i v-else class="fa fa-check" title="valid" />
								</span>
							</span>
							{{ ' ' }}
							<button id="include-bucket-button" type="button" class="btn" :disabled="!createViewSelected || !createViewFilterValid" @click="addBucketToView()">Add</button>
						</div>
					</div>
				</div>
				<div class="modal-footer">
					<button id="create-view-button" type="submit" class="btn btn-primary" :disabled="!createViewLabel || createViewAliases.length === 0">Create</button>
					{{ ' ' }}
					<button type="button" class="btn" @click="showCreateView = false">Cancel</button>
				</div>
			</form>
		</div>
	</div>
</template>
