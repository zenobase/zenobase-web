<script setup lang="ts">
import { computed, inject, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import type { Bucket, User, WidgetSettings } from '../../types';
import { Constraint } from '../../utils/constraint';
import { param } from '../../utils/helpers';
import api from '../api';
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
		const response = await api.get<{ buckets: typeof createViewBuckets.value }>(`/users/${profile.value!['@id']}/buckets/?${param({ order: 'label', offset: 0, limit: 100, labels_only: true })}`);
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

async function loadBuckets(overrides: { offset?: number; limit?: number; q?: string; include_archived?: boolean } = {}) {
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
			await loadBuckets();
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
			await loadBuckets();
		}
	},
);
</script>

<template>
	<div>
		<v-alert v-if="message" type="error" variant="tonal">{{ message }}</v-alert>

		<div v-if="!profile && !message">Loading...</div>

		<div v-if="profile">
			<Teleport to="#page-toolbar">
				<span class="text-subtitle-1 font-weight-bold mr-1">{{ username }}</span>
				<v-btn icon size="small" variant="text" @click="loadBuckets()" v-if="isSelf" title="Refresh">
					<v-icon icon="mdi-refresh" />
				</v-btn>
				<v-menu v-if="isSelf">
					<template v-slot:activator="{ props }">
						<v-btn icon size="small" variant="text" v-bind="props" title="Create..."><v-icon icon="mdi-plus" /></v-btn>
					</template>
					<v-list>
						<v-list-item @click="openCreateBucket()">Bucket...</v-list-item>
						<v-list-item @click="openCreateView()">View...</v-list-item>
					</v-list>
				</v-menu>
				<v-btn icon size="small" variant="text" v-if="isSelf && profile.name" title="Settings..." :to="'/settings'">
					<v-icon icon="mdi-cog" />
				</v-btn>
			</Teleport>

			<v-alert type="info" variant="tonal" v-if="!isSelf">
				Sign in as this user for more information.
			</v-alert>

			<div v-if="isSelf">
				<v-table>
					<tbody>
						<tr v-if="buckets === null"><td colspan="2"><i>Loading...</i></td></tr>
						<tr v-else-if="buckets.length === 0"><td colspan="2"><i>None</i></td></tr>
						<tr v-for="b in buckets" :key="b['@id']" class="bucket-row" :class="{ 'bucket-archived': b.archived, 'bucket-virtual': b.aliases?.length }">
							<td class="text-no-wrap">
								<router-link class="bucket-link" :to="`/buckets/${b['@id']}/`">{{ b.label }}</router-link>
								{{ ' ' }} ({{ b.size?.toLocaleString() }})
							</td>
							<td style="text-align: right" class="text-no-wrap">
								<a class="action bucket-refresh-action" @click="runBucket(b['@id'])"><v-icon icon="mdi-refresh" :class="{ 'mdi-spin': loadingBuckets[b['@id']] }" title="Refresh" /></a>
							</td>
						</tr>
					</tbody>
				</v-table>
				<div class="d-flex align-center justify-end">
					<div class="d-flex align-center" v-if="buckets?.length">
						<v-btn icon variant="text" title="Previous" :disabled="bucketOffset <= 0" @click="() => { bucketOffset -= bucketLimit; loadBuckets() }"><v-icon icon="mdi-chevron-left" /></v-btn>
						<span style="color: rgba(0,0,0,0.5)">
							<b>{{ bucketOffset + 1 }}</b>&ndash;<b>{{ bucketOffset + (buckets?.length ?? 0) }}</b> of <b>{{ bucketTotal }}</b>
							{{ ' ' }}
							<a v-if="!includeArchived" @click="() => { includeArchived = true; loadBuckets() }">excluding</a>
							<a v-else @click="() => { includeArchived = false; loadBuckets() }">including</a>
							{{ ' ' }} archived
						</span>
						<v-btn icon variant="text" title="Next" :disabled="bucketOffset + bucketLimit >= bucketTotal" @click="() => { bucketOffset += bucketLimit; loadBuckets() }"><v-icon icon="mdi-chevron-right" /></v-btn>
					</div>
				</div>
			</div>
		</div>

		<!-- Create Bucket Dialog -->
		<v-dialog v-model="showCreateBucket" max-width="600">
			<v-card>
				<form @submit.prevent="createBucket()">
					<v-card-title class="mb-2">Create Bucket</v-card-title>
					<v-card-text>
						<v-alert v-if="createBucketMessage" type="error" variant="tonal" class="mb-4">{{ createBucketMessage }}</v-alert>
						<div class="mb-4">
							<v-text-field
								id="create-bucket-label"
								label="Label *"
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
							<label for="bucket-template-select" class="d-block">Optionally, choose a template to preconfigure the bucket for a data source.</label>
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
					<v-card-title class="mb-2">Create View</v-card-title>
					<v-card-text>
						<v-alert v-if="createViewMessage" type="error" variant="tonal" class="mb-4">{{ createViewMessage }}</v-alert>
						<div class="mb-4">
							<v-text-field
								id="create-view-label"
								label="Label *"
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
							<p v-else class="text-body-2 mb-2"><i>Select at least one bucket (with an optional filter) to create a view.</i></p>
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
	</div>
</template>
