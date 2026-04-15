<script setup lang="ts">
import * as Sentry from '@sentry/vue';
import { computed, provide, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import type { Bucket, WidgetSettings } from '../types';
import { Constraint } from '../utils/constraint';
import { param } from '../utils/helpers';
import api from './api';
import { alertKey, useAlert } from './composables/useAlert';
import { authKey, useAuth } from './composables/useAuth';
import { reloadBucketsKey } from './composables/useBuckets';

const router = useRouter();
const route = useRoute();
const auth = useAuth();
provide(authKey, auth);
const alertApi = useAlert(async (commandId: string) => {
	await api.post('/journal/', { undo: commandId });
	router.go(0);
});
provide(alertKey, alertApi);

const authReady = ref(false);

// Handle Auth0 redirect callback (auto-handled by @auth0/auth0-vue), then load user
async function initAuth() {
	const params = new URLSearchParams(window.location.search);
	if (params.has('code') && params.has('state')) {
		try {
			await auth.handleCallback();
		} catch (e) {
			console.error('Auth callback failed:', e);
		}
	}
	await auth.whoami();
}
initAuth().finally(() => {
	authReady.value = true;
});


async function signOut() {
	alertApi.clear();
	await router.push('/');
	await auth.signOut();
}

// Navigation drawer
const drawer = ref(false);
provide('drawer', drawer);

// Bucket list
const buckets = ref<Array<Bucket & { size: number }> | null>(null);
const bucketOffset = ref(0);
const bucketLimit = 10;
const bucketTotal = ref(0);
const includeArchived = ref(false);


const hasMore = computed(() => buckets.value !== null && buckets.value.length < bucketTotal.value);

async function loadBuckets(overrides: { reset?: boolean; include_archived?: boolean } = {}) {
	if (!auth.user.value) return;
	if (overrides.reset) {
		buckets.value = null;
		bucketOffset.value = 0;
	}
	if (overrides.include_archived !== undefined) {
		includeArchived.value = overrides.include_archived;
	}
	const params = { order: 'label', offset: bucketOffset.value, limit: bucketLimit, include_archived: includeArchived.value };
	try {
		const response = await api.get<{ total: number; buckets: Array<Bucket & { size: number }> }>(`/users/${auth.user.value['@id']}/buckets/?${param(params)}`);
		if (response.data.total === 0 && !includeArchived.value) {
			await loadBuckets({ include_archived: true });
		} else {
			bucketTotal.value = response.data.total;
			if (bucketOffset.value === 0) {
				buckets.value = response.data.buckets;
			} else {
				buckets.value = [...(buckets.value || []), ...response.data.buckets];
			}
		}
	} catch {
		// silently fail
	}
}

function loadMore() {
	bucketOffset.value += bucketLimit;
	loadBuckets();
}

provide(reloadBucketsKey, () => loadBuckets({ reset: true }));


// Create bucket dialog
const showCreateBucket = ref(false);
const newBucketLabel = ref('My Data');
const createBucketMessage = ref('');

interface BucketTemplate {
	source: string;
	category: string;
	label?: string;
	widgets: WidgetSettings[];
	task?: Record<string, unknown>;
	importer?: Record<string, unknown>;
}
const templates = ref<BucketTemplate[]>([]);
const templateSource = ref<string | null>(null);
const templateCategory = ref<string | null>(null);
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
	templateSource.value = null;
	templateCategory.value = null;
	showCreateBucket.value = true;
	try {
		const response = await api.get<BucketTemplate[]>('/dashboard/templates.json');
		templates.value = Array.isArray(response.data) ? response.data : [];
	} catch {
		// silently fail
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

provide('openCreateBucket', openCreateBucket);

// Create view dialog
const showCreateView = ref(false);
const createViewLabel = ref('My View');
const createViewAliases = ref<Array<{ '@id': string; label: string; filter?: string }>>([]);
const createViewSelectedId = ref<string | null>(null);
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
	return createViewBuckets.value
		.filter((bucket) => !bucket.aliases?.length && !createViewAliases.value.some((alias) => alias['@id'] === bucket['@id']))
		.map((bucket) => ({ title: bucket.label, value: bucket['@id'] }));
});

async function openCreateView() {
	createViewLabel.value = 'My View';
	createViewMessage.value = '';
	createViewAliases.value = [];
	createViewSelectedId.value = null;
	createViewFilter.value = '';
	showCreateView.value = true;
	try {
		const response = await api.get<{ buckets: typeof createViewBuckets.value }>(`/users/${auth.user.value!['@id']}/buckets/?${param({ order: 'label', offset: 0, limit: 100, labels_only: true })}`);
		createViewBuckets.value = response.data.buckets;
	} catch {
		// silently fail
	}
}

function addBucketToView() {
	const bucket = createViewBuckets.value.find((b) => b['@id'] === createViewSelectedId.value);
	if (!bucket) return;
	const alias: { '@id': string; label: string; filter?: string } = {
		'@id': bucket['@id'],
		label: bucket.label,
	};
	if (createViewFilter.value) {
		alias.filter = createViewFilter.value;
	}
	createViewAliases.value = [...createViewAliases.value, alias];
	createViewSelectedId.value = null;
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

// Load buckets when user signs in
watch(
	() => auth.user.value,
	() => {
		if (auth.user.value) {
			Sentry.setUser({ id: auth.user.value['@id'] });
			loadBuckets();
		} else {
			Sentry.setUser(null);
			buckets.value = null;
			bucketOffset.value = 0;
			bucketTotal.value = 0;
		}
	},
	{ immediate: true },
);

// Reload buckets when navigating back to home (e.g. after delete/archive)
watch(
	() => route.path,
	(path) => {
		if (path === '/' && auth.user.value) {
			loadBuckets();
		}
	},
);
</script>

<template>
	<v-app>
		<v-system-bar v-if="auth.user.value?.suspended" color="error" variant="tonal" style="height: auto; padding: 8px 16px; justify-content: flex-start">
			<v-icon icon="$error" class="mr-2" />
			<span>This account has been suspended. Please contact support.</span>
		</v-system-bar>

		<v-app-bar v-if="auth.user.value || route.path !== '/'" density="compact" color="surface" flat>
			<v-app-bar-nav-icon v-if="auth.user.value" @click="drawer = !drawer" />
			<router-link to="/" class="d-flex align-center ml-3 mr-3">
				<img src="/img/logo_120x120.png" alt="Zenobase" width="28" height="28" />
			</router-link>
			<div id="page-toolbar" class="d-flex align-center ga-1" style="flex: 1; min-width: 0" />
			<v-menu v-if="auth.user.value">
				<template v-slot:activator="{ props }">
					<v-btn size="small" variant="text" v-bind="props" class="mr-1 text-body-2">
						<v-icon icon="mdi-account" size="small" class="text-medium-emphasis" />
						<span class="ml-1">{{ auth.user.value.name }}</span>
					</v-btn>
				</template>
				<v-list density="compact">
					<v-list-item @click="signOut()">
						<v-list-item-title>Sign out</v-list-item-title>
					</v-list-item>
				</v-list>
			</v-menu>
			<div class="mr-3" v-else-if="!auth.loading.value">
				<a @click="auth.signIn()">Sign in</a>
			</div>
		</v-app-bar>

		<v-navigation-drawer v-if="auth.user.value" v-model="drawer" :width="280">
			<v-list nav>
				<v-list-item class="text-caption text-medium-emphasis">
					<v-list-item-title>Buckets</v-list-item-title>
					<template v-slot:append>
						<v-menu>
							<template v-slot:activator="{ props }">
								<v-btn icon size="x-small" variant="text" v-bind="props" title="Create...">
									<v-icon icon="mdi-plus" />
								</v-btn>
							</template>
							<v-list density="compact">
								<v-list-item @click="openCreateBucket()">Bucket...</v-list-item>
								<v-list-item @click="openCreateView()">View...</v-list-item>
							</v-list>
						</v-menu>
					</template>
				</v-list-item>
				<v-list-item v-if="buckets === null">
					<v-list-item-title class="text-medium-emphasis"><i>Loading...</i></v-list-item-title>
				</v-list-item>
				<v-list-item v-else-if="buckets.length === 0">
					<v-list-item-title class="text-medium-emphasis"><i>No buckets</i></v-list-item-title>
				</v-list-item>
				<v-list-item
					v-for="b in buckets"
					:key="b['@id']"
					:to="`/buckets/${b['@id']}/`"
					:class="{ 'bucket-archived': b.archived }"
					:prepend-icon="b.aliases?.length ? 'mdi-view-dashboard-outline' : 'mdi-view-dashboard'"
				>
					<v-list-item-title class="font-weight-bold">{{ b.label }}</v-list-item-title>
					<template v-slot:append>
						<v-chip size="small" :variant="b.aliases?.length ? 'outlined' : 'flat'" :color="b.archived ? 'grey' : 'primary'" class="font-weight-bold">{{ b.size?.toLocaleString() }}</v-chip>
					</template>
				</v-list-item>
				<v-list-item v-if="hasMore" @click="loadMore()" class="text-medium-emphasis">
					<v-list-item-title class="text-caption">Load more...</v-list-item-title>
				</v-list-item>
				<v-list-item v-if="buckets">
					<v-switch density="compact" hide-details label="Include archived" :model-value="includeArchived" @update:model-value="() => { loadBuckets({ reset: true, include_archived: !includeArchived }) }" class="drawer-switch" />
				</v-list-item>
			</v-list>

			<template v-slot:append>
				<v-list nav>
					<v-list-item href="https://ko-fi.com/zenobase" target="_blank" prepend-icon="mdi-coffee-outline">
						<v-list-item-title class="font-weight-bold">Support us...</v-list-item-title>
					</v-list-item>
					<v-list-item v-if="auth.user.value?.name" to="/settings" prepend-icon="mdi-cog-outline">
						<v-list-item-title class="font-weight-bold">Settings</v-list-item-title>
					</v-list-item>
				</v-list>
			</template>
		</v-navigation-drawer>

		<v-main>
			<v-container fluid :class="route.path === '/' ? 'pa-0' : 'pa-4 pt-2'">
				<v-snackbar :model-value="!!alertApi.alert.value.message" :timeout="alertApi.alert.value.level === 'error' ? -1 : 5000" :color="alertApi.alert.value.level || 'info'" @update:model-value="alertApi.clear()">
					{{ alertApi.alert.value.message }}
					<template #actions>
						<v-btn v-if="alertApi.alert.value.undoId" variant="text" @click="alertApi.undo(alertApi.alert.value.undoId)">Undo</v-btn>
						<v-btn variant="text" @click="alertApi.clear()">Close</v-btn>
					</template>
				</v-snackbar>

				<div v-if="!auth.user.value?.suspended">
					<RouterView v-if="authReady" />
					<div v-else class="mt-4 text-medium-emphasis">Loading...</div>
				</div>
			</v-container>

			<v-footer class="zeno-footer text-disabled pa-4 flex-column align-center ga-2">
				<div class="d-flex justify-center">
					<span>&copy; 2012&ndash;{{ new Date().getFullYear() }} Zenobase &middot; Built with <v-icon icon="mdi-heart" size="small" />&nbsp;in Seattle</span>
				</div>
				<div class="d-flex justify-center ga-4">
					<router-link to="/legal/" class="text-disabled">Legal</router-link>
					<router-link to="/api/" class="text-disabled">API</router-link>
					<a href="mailto:info@zenobase.com" class="text-disabled">Contact</a>
				</div>
				<div class="d-flex justify-center ga-4">
					<a href="https://blog.zenobase.com/" class="text-disabled" title="Blog"><v-icon icon="mdi-rss" size="small" /></a>
					<a href="https://github.com/zenobase" class="text-disabled" title="GitHub"><v-icon icon="mdi-github" size="small" /></a>
					<a href="https://www.linkedin.com/company/2676455" class="text-disabled" title="LinkedIn"><v-icon icon="mdi-linkedin" size="small" /></a>
				</div>
			</v-footer>
		</v-main>

		<!-- Create Bucket Dialog -->
		<v-dialog v-model="showCreateBucket" max-width="600">
			<v-card>
				<form @submit.prevent="createBucket()">
					<v-card-title class="d-flex align-center mb-2">
						Create Bucket
						<v-spacer />
						<v-btn icon="mdi-close" variant="text" density="compact" @click="showCreateBucket = false" />
					</v-card-title>
					<v-card-text>
						<v-alert v-if="createBucketMessage" type="error" variant="tonal" class="mb-4">{{ createBucketMessage }}</v-alert>
						<div class="mb-4">
							<v-text-field
								id="create-bucket-label"
								label="Label"
								required
								minlength="1"
								maxlength="30"
								v-model="newBucketLabel"
							>
								<template v-slot:append-inner>
									<v-icon v-if="!newBucketLabel" icon="mdi-exclamation" title="not valid" />
									<v-icon v-else icon="mdi-check" title="valid" />
								</template>
							</v-text-field>
						</div>
						<div class="mb-4">
							<label for="bucket-template-select" class="d-block">Optionally, select a template to preconfigure the bucket for a data source.</label>
							<div class="d-flex ga-2">
								<v-select
									id="bucket-source-select"
									v-model="templateSource"
									:items="templateSources"
									label="Source"
									clearable
									density="default"
									hide-details
								/>
								<v-select
									id="bucket-category-select"
									v-model="templateCategory"
									:items="templateCategories"
									label="Category"
									clearable
									density="default"
									hide-details
								/>
							</div>
						</div>
					</v-card-text>
					<v-card-actions>
						<v-spacer />
						<v-btn id="create-bucket-button" type="submit" color="primary" :disabled="!newBucketLabel || !createBucketValid">Create</v-btn>
						{{ ' ' }}
						<v-btn variant="text" @click="showCreateBucket = false">Cancel</v-btn>
					</v-card-actions>
				</form>
			</v-card>
		</v-dialog>

		<!-- Create View Dialog -->
		<v-dialog v-model="showCreateView" max-width="600">
			<v-card>
				<form @submit.prevent="createView()">
					<v-card-title class="d-flex align-center mb-2">
						Create View
						<v-spacer />
						<v-btn icon="mdi-close" variant="text" density="compact" @click="showCreateView = false" />
					</v-card-title>
					<v-card-text>
						<v-alert v-if="createViewMessage" type="error" variant="tonal" class="mb-4">{{ createViewMessage }}</v-alert>
						<div class="mb-4">
							<v-text-field
								id="create-view-label"
								label="Label"
								required
								minlength="1"
								maxlength="30"
								v-model="createViewLabel"
							>
								<template v-slot:append-inner>
									<v-icon v-if="!createViewLabel" icon="mdi-exclamation" title="not valid" />
									<v-icon v-else icon="mdi-check" title="valid" />
								</template>
							</v-text-field>
						</div>
						<div class="mb-4">
							<v-chip-group v-if="createViewAliases.length">
								<v-chip v-for="alias in createViewAliases" :key="alias['@id']" size="default" color="primary" @click="removeBucketFromView(alias['@id'])">
									<v-icon v-if="alias.filter" icon="mdi-filter" :title="alias.filter" class="mr-1" />
									{{ alias.label }} <v-icon icon="mdi-close" class="ml-1" />
								</v-chip>
							</v-chip-group>
							<p v-else class="text-body-2 mb-2">Select at least one bucket (with an optional filter) to create a view.</p>
							<div class="d-flex ga-2 align-end">
								<v-select
									id="include-bucket-select"
									label="Bucket"
									v-model="createViewSelectedId"
									:items="listViewBuckets"
									clearable
									density="default"
									hide-details
								/>
								<v-text-field
									id="include-bucket-filter"
									type="text"
									label="Filter"
									v-model="createViewFilter"
									:disabled="!createViewSelectedId"
									placeholder="e.g. tag:xyz"
									density="default"
									hide-details
								>
									<template v-slot:append-inner>
										<v-icon v-if="!createViewFilterValid" icon="mdi-exclamation" title="not valid" />
										<v-icon v-else icon="mdi-check" title="valid" />
									</template>
								</v-text-field>
								<v-btn id="include-bucket-button" variant="outlined" :disabled="!createViewSelectedId || !createViewFilterValid" @click="addBucketToView()">Add</v-btn>
							</div>
						</div>
					</v-card-text>
					<v-card-actions>
						<v-spacer />
						<v-btn id="create-view-button" type="submit" color="primary" :disabled="!createViewLabel || createViewAliases.length === 0">Create</v-btn>
						{{ ' ' }}
						<v-btn variant="text" @click="showCreateView = false">Cancel</v-btn>
					</v-card-actions>
				</form>
			</v-card>
		</v-dialog>
	</v-app>
</template>

<style>
.v-navigation-drawer .v-list {
	--v-list-prepend-gap: 8px;
}
.drawer-switch {
	margin-inline-start: 4px;
}
.drawer-switch .v-label {
	margin-inline-start: 8px;
}
</style>
