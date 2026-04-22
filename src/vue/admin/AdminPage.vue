<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import type { AdminBucket, AdminTask, AdminUser, ClusterStatus, Credential, JournalCommand, PaginationParams, SchedulerJob, Snapshot } from '../../types/admin';
import { param } from '../../utils/helpers';
import api, { ApiError } from '../api';
import LoadingState from '../components/LoadingState.vue';
import { formatAge } from '../utils/formatAge';

const route = useRoute();
const router = useRouter();

// --- Shared state ---

const constraint = ref<string | null>((route.query.q as string) || null);
const status = ref<ClusterStatus | null>(null);
const outstanding = ref(0);
const refreshKey = ref(0);

function setConstraint(value: string | null) {
	constraint.value = value;
	router.replace({ query: value ? { q: value } : {} });
	if (value) resolveUserNames([value]);
}

function refreshAll() {
	refreshKey.value++;
}

async function fetchStatus() {
	try {
		const response = await api.get<ClusterStatus>('/status');
		status.value = response.data;
	} catch {
		status.value = { nodes: '?', health: 'UNKNOWN' };
	}
}

async function setReadOnly(readOnly: boolean) {
	await api.post('/status', { read_only: readOnly });
	fetchStatus();
}

// --- Helpers ---


function formatDuration(millis: number | null | undefined): string {
	if (!Number.isFinite(millis)) return '';
	const totalSeconds = Math.floor(millis! / 1000);
	const hours = Math.floor(totalSeconds / 3600);
	const minutes = Math.floor((totalSeconds % 3600) / 60);
	const seconds = totalSeconds % 60;
	if (hours > 0) return `${hours}h ${minutes}m`;
	if (minutes > 0) return `${minutes}m ${seconds}s`;
	return `${seconds}s`;
}

function formatNumber(n: number | null | undefined): string {
	if (n == null || !Number.isFinite(n)) return '';
	return n.toLocaleString();
}

const userNameCache = reactive(new Map<string, string>());

async function resolveUserNames(ids: string[]) {
	const unknown = ids.filter((id) => id && !userNameCache.has(id));
	if (unknown.length === 0) return;
	await Promise.all(
		unknown.map(async (id) => {
			try {
				const response = await api.get<AdminUser>('/users/' + id);
				userNameCache.set(id, (response.data.name as string) || id);
			} catch {
				userNameCache.set(id, id);
			}
		}),
	);
}

function formatUsername(identity: string | null | undefined): string {
	if (!identity) return '';
	return userNameCache.get(identity) || identity;
}

function delay(callback: () => void) {
	setTimeout(callback, 1000);
}

function getOwner(bucket: AdminBucket): string {
	const roles = bucket.roles;
	if (roles) {
		for (const role of roles) {
			if (role.role === 'owner') return role.principal;
		}
	}
	return '';
}

function isPublished(bucket: AdminBucket): boolean {
	return bucket.roles ? bucket.roles.some((r) => r.principal === '*') : false;
}

// --- Journal ---

const journal = reactive({
	offset: 0,
	limit: 10,
	total: 0,
	commands: null as JournalCommand[] | null,
	filter: null as string | null,
});

function journalParams(overrides?: Partial<PaginationParams>) {
	const params: PaginationParams = { offset: journal.offset, limit: journal.limit };
	if (journal.filter) params.q = journal.filter;
	return { ...params, ...overrides };
}

async function refreshJournal(overrides?: Partial<PaginationParams>) {
	const path = constraint.value ? `/users/${constraint.value}/journal/` : '/journal/';
	const response = await api.get<{ total: number; commands: JournalCommand[] }>(path + '?' + param(journalParams(overrides)));
	if (overrides) Object.assign(journal, overrides);
	journal.total = response.data.total;
	journal.commands = response.data.commands;
	resolveUserNames(response.data.commands.map((c) => c.principal));
}

async function undo(commandId: string) {
	await api.post('/journal/', { undo: commandId });
	delay(() => refreshAll());
}

// --- Buckets ---

const buckets = reactive({
	offset: 0,
	limit: 10,
	total: 0,
	items: null as AdminBucket[] | null,
	filter: null as string | null,
	events: 0,
});

function bucketParams(overrides?: Partial<PaginationParams>) {
	const params: PaginationParams = { offset: buckets.offset, limit: buckets.limit };
	if (buckets.filter) params.q = buckets.filter;
	return { ...params, ...overrides };
}

async function refreshBuckets(overrides?: Partial<PaginationParams>) {
	const basePath = constraint.value ? `/users/${constraint.value}` : '';
	const response = await api.get<{ total: number; buckets: AdminBucket[] }>(basePath + '/buckets/?' + param(bucketParams(overrides)));
	if (overrides) Object.assign(buckets, overrides);
	buckets.total = response.data.total;
	buckets.items = response.data.buckets;
	resolveUserNames(response.data.buckets.map((b) => getOwner(b)));
	const eventsResponse = await api.get<{ total: number }>(basePath + '/events/');
	buckets.events = eventsResponse.data.total;
}

async function removeBucket(bucketId: string) {
	await api.del('/buckets/' + bucketId);
	delay(() => refreshAll());
}

// --- Users ---

const users = reactive({
	offset: 0,
	limit: 10,
	total: 0,
	items: null as AdminUser[] | null,
	filter: null as string | null,
});

function userParams(overrides?: Partial<PaginationParams>) {
	const params: PaginationParams = { offset: users.offset, limit: users.limit };
	if (users.filter) params.q = users.filter;
	return { ...params, ...overrides };
}

async function refreshUsers(overrides?: Partial<PaginationParams>) {
	if (constraint.value) {
		const response = await api.get<AdminUser>('/users/' + constraint.value);
		if (response.data?.name) {
			users.total = 1;
			users.items = [response.data];
		} else {
			users.total = 0;
			users.items = [];
		}
	} else {
		const response = await api.get<{ total: number; users: AdminUser[] }>('/users/?' + param(userParams(overrides)));
		if (overrides) Object.assign(users, overrides);
		users.total = response.data.total;
		users.items = response.data.users;
	}
}

async function suspendUser(username: string) {
	await api.post(`/users/@${username}`, { suspended: true });
	delay(() => refreshAll());
}

async function reverifyUser(user: AdminUser) {
	await api.post(`/users/@${user.name}`, { email: user.email });
	delay(() => refreshAll());
}

async function optoutUser(user: AdminUser) {
	await api.post(`/users/@${user.name}`, { optedout: true });
	delay(() => refreshAll());
}

async function optinUser(user: AdminUser) {
	await api.post(`/users/@${user.name}`, { optedout: false });
	delay(() => refreshAll());
}

async function removeUser(username: string) {
	await api.del(`/users/@${username}`);
	delay(() => refreshAll());
}

// --- Edit Quota Dialog ---

const showEditQuota = ref(false);
const quota = reactive({
	user: null as AdminUser | null,
	message: '',
	limit: null as number | null,
	usedOld: null as number | null,
	usedNew: null as number | null,
});

async function openEditQuota(user: AdminUser) {
	quota.user = user;
	quota.message = '';
	quota.limit = null;
	quota.usedOld = null;
	quota.usedNew = null;
	const response = await api.get<{ limit: number; used: number }>(`/users/@${quota.user.name}/quota`);
	quota.limit = response.data.limit;
	quota.usedOld = response.data.used;
	quota.usedNew = response.data.used;
	showEditQuota.value = true;
}

async function saveQuota() {
	quota.message = '';
	try {
		if (quota.limit !== quota.user!.quota) {
			const numericLimit = Number.isFinite(Number(quota.limit)) ? quota.limit : null;
			await api.post(`/users/@${quota.user!.name}`, { quota: numericLimit });
		}
		if (quota.usedNew !== quota.usedOld) {
			await api.post(`/users/@${quota.user!.name}/quota`, { cost: quota.usedNew! - quota.usedOld! });
		}
		showEditQuota.value = false;
		delay(() => refreshAll());
	} catch {
		quota.message = "Couldn't update quota used/limit.";
	}
}

// --- Credentials ---

const credentials = reactive({
	offset: 0,
	limit: 10,
	total: 0,
	items: null as Credential[] | null,
	filter: null as string | null,
});

function credentialParams(overrides?: Partial<PaginationParams>) {
	const params: PaginationParams = { offset: credentials.offset, limit: credentials.limit };
	if (credentials.filter) params.q = credentials.filter;
	return { ...params, ...overrides };
}

async function refreshCredentials(overrides?: Partial<PaginationParams>) {
	const path = constraint.value ? `/users/${constraint.value}/credentials/` : '/credentials/';
	const response = await api.get<{ total: number; items: Credential[] }>(path + '?' + param(credentialParams(overrides)));
	if (overrides) Object.assign(credentials, overrides);
	credentials.total = response.data.total;
	credentials.items = response.data.items;
	resolveUserNames(response.data.items.map((c) => c.principal));
}

async function removeCredential(credentialsId: string) {
	await api.del('/credentials/' + credentialsId);
	delay(() => refreshAll());
}

// --- Tasks ---

const tasks = reactive({
	offset: 0,
	limit: 10,
	total: 0,
	items: null as AdminTask[] | null,
	filter: null as string | null,
	running: {} as Record<string, boolean>,
});

function taskParams(overrides?: Partial<PaginationParams>) {
	const params: PaginationParams = { offset: tasks.offset, limit: tasks.limit };
	if (tasks.filter) params.q = tasks.filter;
	return { ...params, ...overrides };
}

async function refreshTasks(overrides?: Partial<PaginationParams>) {
	const path = constraint.value ? `/users/${constraint.value}/tasks/` : '/tasks/';
	const response = await api.get<{ total: number; tasks: AdminTask[] }>(path + '?' + param(taskParams(overrides)));
	if (overrides) Object.assign(tasks, overrides);
	tasks.total = response.data.total;
	tasks.items = response.data.tasks;
	resolveUserNames(response.data.tasks.map((t) => t.principal));
}

async function runTask(taskId: string) {
	tasks.running[taskId] = true;
	try {
		const response = await api.get<AdminTask>('/tasks/' + taskId);
		const credentialsHeader = response.headers('X-Credentials');
		const linkHeader = response.headers('Link');
		if (credentialsHeader) {
			try {
				const credResponse = await api.post<Credential>('/credentials/', { type: credentialsHeader });
				if (credResponse.data.authorizationUrl) {
					window.open(credResponse.data.authorizationUrl);
				}
			} catch {
				// credential creation failed
			}
		} else if (linkHeader) {
			const match = linkHeader.match(/<(.+?)>/);
			if (match) {
				window.open(match[1]);
			}
		}
	} catch (e) {
		if (e instanceof ApiError) {
			if (e.status === 403) {
				alert("Couldn't refresh a task. Insufficient quota?");
			} else if (e.status < 500) {
				alert("Couldn't refresh a task.");
			} else {
				alert("Couldn't refresh a task. Try again later or contact support.");
			}
		}
	} finally {
		delay(() => {
			refreshTasks({});
			delete tasks.running[taskId];
		});
	}
}

async function removeTask(taskId: string) {
	await api.del('/tasks/' + taskId);
	delay(() => refreshAll());
}

// --- Scheduler ---

const scheduler = reactive({
	jobs: null as SchedulerJob[] | null,
});

async function refreshScheduler() {
	const response = await api.get<{ jobs: SchedulerJob[] }>('/jobs/');
	scheduler.jobs = response.data.jobs;
}

async function disableScheduler(disabled: boolean) {
	await api.post('/status', { scheduler_disabled: disabled });
	delay(() => fetchStatus());
}

// --- Snapshots ---

const snapshots = reactive({
	offset: 0,
	limit: 10,
	total: 0,
	items: null as Snapshot[] | null,
	snapshotting: false,
});

function snapshotParams(overrides?: Partial<PaginationParams>) {
	const params: PaginationParams = { offset: snapshots.offset, limit: snapshots.limit };
	return { ...params, ...overrides };
}

async function refreshSnapshots(overrides?: Partial<PaginationParams>) {
	const response = await api.get<{ total: number; snapshots: Snapshot[] }>('/snapshots/?' + param(snapshotParams(overrides)));
	if (overrides) Object.assign(snapshots, overrides);
	snapshots.total = response.data.total;
	snapshots.items = response.data.snapshots;
}

async function removeSnapshot(snapshotId: string) {
	await api.del('/snapshots/' + snapshotId);
	delay(() => refreshSnapshots({ offset: 0 }));
}

async function createSnapshot() {
	snapshots.snapshotting = true;
	await api.post('/snapshots/');
	delay(() => {
		snapshots.snapshotting = false;
		refreshSnapshots();
	});
}

// --- Active section from route ---
const section = computed(() => (route.params.section as string) || 'journal');

const SECTIONS: Record<string, { title: string; placeholder?: string }> = {
	journal: { title: 'History', placeholder: '@id, @type.name' },
	buckets: { title: 'Buckets', placeholder: '@id, refresh' },
	users: { title: 'Users', placeholder: '@id, name, email, verified, suspended, quota' },
	credentials: { title: 'Credentials', placeholder: '@id, type, authorizationUrl' },
	tasks: { title: 'Tasks', placeholder: '@id, type, status, bucket, completed' },
	scheduler: { title: 'Scheduler' },
	snapshots: { title: 'Snapshots' },
};

const sectionTitle = computed(() => SECTIONS[section.value]?.title ?? 'Admin');
const sectionPlaceholder = computed(() => SECTIONS[section.value]?.placeholder ?? '');
const isSearchable = computed(() => !!SECTIONS[section.value]?.placeholder);

const currentFilter = computed<string | null>({
	get() {
		switch (section.value) {
			case 'journal': return journal.filter;
			case 'buckets': return buckets.filter;
			case 'users': return users.filter;
			case 'credentials': return credentials.filter;
			case 'tasks': return tasks.filter;
			default: return null;
		}
	},
	set(value) {
		switch (section.value) {
			case 'journal': journal.filter = value; break;
			case 'buckets': buckets.filter = value; break;
			case 'users': users.filter = value; break;
			case 'credentials': credentials.filter = value; break;
			case 'tasks': tasks.filter = value; break;
		}
	},
});

function refreshCurrentFiltered() {
	refreshSection(section.value, { offset: 0 });
}

const longPressedId = ref<string | null>(null);
function onLongPress(id: string) {
	longPressedId.value = id;
	setTimeout(() => {
		if (longPressedId.value === id) longPressedId.value = null;
	}, 3000);
}

function refreshSection(name: string, overrides: Record<string, unknown> = {}) {
	switch (name) {
		case 'journal': return refreshJournal(overrides);
		case 'buckets': return refreshBuckets(overrides);
		case 'users': return refreshUsers(overrides);
		case 'credentials': return refreshCredentials(overrides);
		case 'tasks': return refreshTasks(overrides);
		case 'scheduler': return refreshScheduler();
		case 'snapshots': return refreshSnapshots(overrides);
	}
}

// --- Refresh on key change ---

watch(refreshKey, () => {
	fetchStatus();
	refreshSection(section.value, { offset: 0 });
});

watch(constraint, () => {
	refreshSection(section.value, { offset: 0 });
});

watch(section, (name) => {
	refreshSection(name, { offset: 0 });
});

// --- Initial load ---

onMounted(() => {
	if (constraint.value) resolveUserNames([constraint.value]);
	fetchStatus();
	refreshSection(section.value, {});
});

// --- Filter blur-on-enter helper ---

function blurOnEnter(event: KeyboardEvent) {
	if (event.key === 'Enter') {
		(event.target as HTMLInputElement).blur();
	}
}
</script>

<template>
	<div id="admin-dashboard">

		<Teleport to="#page-toolbar">
			<span class="text-subtitle-1 font-weight-bold mr-1">{{ sectionTitle }}</span>
			<v-btn icon size="small" variant="text" @click="refreshAll()" title="Refresh" style="--v-btn-size: 1rem">
				<v-icon icon="mdi-refresh" :class="outstanding > 0 && 'mdi-spin'" />
			</v-btn>
			<template v-if="section === 'journal'">
				<v-btn v-if="status?.read_only" icon size="small" variant="text" @click="setReadOnly(false)" title="in read-only mode" style="--v-btn-size: 1rem">
					<v-icon icon="mdi-lock" />
				</v-btn>
				<v-btn v-if="status && !status.read_only" icon size="small" variant="text" @click="setReadOnly(true)" title="in normal mode" style="--v-btn-size: 1rem">
					<v-icon icon="mdi-lock-open" />
				</v-btn>
			</template>
			<v-btn v-if="section === 'users'" icon size="small" variant="text" title="Download" @click="api.download('/users/', 'users.json')" style="--v-btn-size: 1rem">
				<v-icon icon="mdi-download" />
			</v-btn>
			<template v-if="section === 'scheduler'">
				<v-btn v-if="status && !status.scheduler_disabled" icon size="small" variant="text" @click="disableScheduler(true)" title="Pause" style="--v-btn-size: 1rem">
					<v-icon icon="mdi-pause" />
				</v-btn>
				<v-btn v-if="status?.scheduler_disabled" icon size="small" variant="text" @click="disableScheduler(false)" title="Resume" style="--v-btn-size: 1rem">
					<v-icon icon="mdi-play" />
				</v-btn>
			</template>
			<v-btn v-if="section === 'snapshots'" icon size="small" variant="text" @click="createSnapshot()" :disabled="snapshots.snapshotting" title="Snapshot" style="--v-btn-size: 1rem">
				<v-icon icon="mdi-camera" />
			</v-btn>
			<v-text-field
				v-if="isSearchable && !constraint"
				v-model="currentFilter"
				prepend-inner-icon="mdi-magnify"
				:placeholder="sectionPlaceholder"
				variant="plain"
				density="compact"
				hide-details
				clearable
				single-line
				class="ml-2 admin-toolbar-search"
				style="flex: 1; min-width: 0"
				@keydown="blurOnEnter"
				@blur="refreshCurrentFiltered()"
				@click:clear="() => { currentFilter = null; refreshCurrentFiltered(); }"
			/>
		</Teleport>

		<div class="d-flex align-center flex-wrap ga-1 mb-2" v-if="constraint">
			<v-chip color="primary" variant="outlined" size="default" class="font-weight-bold" @click="setConstraint(null)">
				<v-icon icon="mdi-account" start />
				{{ formatUsername(constraint) }}
				<v-icon icon="mdi-close" end size="x-small" />
			</v-chip>
		</div>

		<div>

					<!-- Journal -->
					<div v-show="section === 'journal'">
						<v-table>
							<thead>
								<tr>
									<th style="width: 0">Command</th>
									<th style="width: 0">User</th>
									<th style="width: 99%">Description</th>
									<th style="width: 0">Created</th>
									<th style="width: 0; text-align: right">Cost</th>
								</tr>
							</thead>
							<tbody>
								<tr v-for="command in journal.commands" :key="command['@id'] as string" @contextmenu.prevent="onLongPress(command['@id'] as string)">
									<td>{{ command['@id'] }}</td>
									<td>
										<a @click="setConstraint(command.principal as string)">{{ formatUsername(command.principal as string) }}</a>
									</td>
									<td>
										<span>{{ command.label }}</span>
									</td>
									<td class="text-no-wrap">
										<abbr :title="String(command.timestamp)">{{ formatAge(command.timestamp as string) }}</abbr>
									</td>
									<td style="text-align: right; position: relative">
										<span v-if="command.cost">{{ formatNumber(command.cost as number) }}</span>
										<div class="row-actions" :class="{ 'row-actions--visible': longPressedId === command['@id'] }">
											<v-btn icon="mdi-undo" size="x-small" variant="elevated" color="primary" title="Undo" @click.stop="undo(command['@id'] as string)" />
										</div>
									</td>
								</tr>
								<tr v-if="journal.commands === null">
									<td colspan="5"><LoadingState state="loading" /></td>
								</tr>
								<tr v-if="journal.commands && journal.commands.length === 0">
									<td colspan="5"><i>None</i></td>
								</tr>
							</tbody>
						</v-table>
						<div class="d-flex align-center justify-end" v-if="journal.commands?.length">
							<v-btn icon variant="text" title="Previous" @click="refreshJournal({ offset: journal.offset - journal.limit })" :disabled="journal.offset <= 0"><v-icon icon="mdi-chevron-left" /></v-btn>
							<span style="color: rgba(0,0,0,0.5)"><b>{{ journal.offset + 1 }}</b>&ndash;<b>{{ journal.offset + journal.commands.length }}</b> of <b>{{ formatNumber(journal.total) }}</b></span>
							<v-btn icon variant="text" title="Next" @click="refreshJournal({ offset: journal.offset + journal.limit })" :disabled="journal.offset + journal.limit >= journal.total"><v-icon icon="mdi-chevron-right" /></v-btn>
						</div>
					</div>

					<!-- Buckets -->
					<div v-show="section === 'buckets'">
						<v-table>
							<thead>
								<tr>
									<th style="width: 0">Bucket</th>
									<th style="width: 99%">User</th>
									<th style="width: 0">Created</th>
									<th style="width: 0; text-align: right">Size</th>
								</tr>
							</thead>
							<tbody>
								<tr v-for="bucket in buckets.items" :key="bucket['@id'] as string" @contextmenu.prevent="onLongPress(bucket['@id'] as string)">
									<td>
										<span :class="bucket.aliases && (bucket.aliases as unknown[]).length ? 'bucket-virtual' : undefined">{{ bucket['@id'] }}</span>
									</td>
									<td>
										<a @click="setConstraint(getOwner(bucket))">{{ formatUsername(getOwner(bucket)) }}</a>
									</td>
									<td class="text-no-wrap">
										<abbr :title="String(bucket.created)">{{ formatAge(bucket.created as string) }}</abbr>
									</td>
									<td style="text-align: right; position: relative">
										<a v-if="isPublished(bucket)" :href="`/#/buckets/${bucket['@id']}`">{{ bucket.size }}</a>
										<span v-else>{{ formatNumber(bucket.size as number) }}</span>
										<div class="row-actions" :class="{ 'row-actions--visible': longPressedId === bucket['@id'] }">
											<v-btn icon="mdi-delete-outline" size="x-small" variant="elevated" color="primary" title="Delete" @click.stop="removeBucket(bucket['@id'] as string)" />
										</div>
									</td>
								</tr>
								<tr v-if="buckets.items?.length">
									<td><em>Total</em></td>
									<td></td>
									<td></td>
									<td style="text-align: right">{{ formatNumber(buckets.events) }}</td>
								</tr>
								<tr v-if="buckets.items === null">
									<td colspan="4"><LoadingState state="loading" /></td>
								</tr>
								<tr v-if="buckets.items?.length === 0">
									<td colspan="4"><i>None</i></td>
								</tr>
							</tbody>
						</v-table>
						<div class="d-flex align-center" v-if="buckets.items?.length">
							<v-spacer />
							<v-btn icon variant="text" title="Previous" @click="refreshBuckets({ offset: buckets.offset - buckets.limit })" :disabled="buckets.offset <= 0"><v-icon icon="mdi-chevron-left" /></v-btn>
							<span style="color: rgba(0,0,0,0.5)"><b>{{ buckets.offset + 1 }}</b>&ndash;<b>{{ buckets.offset + buckets.items.length }}</b> of <b>{{ formatNumber(buckets.total) }}</b></span>
							<v-btn icon variant="text" title="Next" @click="refreshBuckets({ offset: buckets.offset + buckets.limit })" :disabled="buckets.offset + buckets.limit >= buckets.total"><v-icon icon="mdi-chevron-right" /></v-btn>
						</div>
					</div>

					<!-- Users -->
					<div v-show="section === 'users'">
						<v-table>
							<thead>
								<tr>
									<th style="width: 0">User</th>
									<th style="width: 99%">Email</th>
									<th style="width: 0">Created</th>
									<th style="width: 0; text-align: right">Quota</th>
								</tr>
							</thead>
							<tbody>
								<tr v-for="user in users.items" :key="user['@id'] as string" @contextmenu.prevent="onLongPress(user['@id'] as string)">
									<td>
										<a v-if="!user.suspended" @click="setConstraint(user['@id'] as string)" :class="user.superuser ? 'b' : undefined">{{ user.name }}</a>
										<span v-else style="color: gray">{{ user.name }}</span>
									</td>
									<td>
										<a :href="`mailto:${user.email}`">{{ user.email }}</a>
									</td>
									<td class="text-no-wrap">
										<abbr :title="String(user.created)">{{ formatAge(user.created as string) }}</abbr>
									</td>
									<td style="text-align: right; position: relative" class="text-no-wrap">
										{{ formatNumber(user.quota as number) }}
										<div class="row-actions" :class="{ 'row-actions--visible': longPressedId === user['@id'] }">
											<v-btn
												:icon="user.optedout ? 'mdi-email-outline' : 'mdi-email'"
												size="x-small" variant="elevated" color="primary"
												:title="user.optedout ? 'Opt In' : 'Opt Out'"
												@click.stop="user.optedout ? optinUser(user) : optoutUser(user)"
											/>
											<v-btn
												icon="mdi-send" size="x-small" variant="elevated" color="primary"
												title="Resend Verification" :disabled="!!user.verified"
												@click.stop="reverifyUser(user)"
											/>
											<v-btn
												icon="mdi-pencil" size="x-small" variant="elevated" color="primary"
												title="Edit Quota" @click.stop="openEditQuota(user)"
											/>
											<v-btn
												v-if="!user.suspended"
												icon="mdi-cancel" size="x-small" variant="elevated" color="primary"
												title="Suspend" :disabled="!!user.superuser"
												@click.stop="suspendUser(user.name as string)"
											/>
											<v-btn
												v-else
												icon="mdi-delete-outline" size="x-small" variant="elevated" color="primary"
												title="Delete"
												@click.stop="removeUser(user.name as string)"
											/>
										</div>
									</td>
								</tr>
								<tr v-if="users.items === null">
									<td colspan="4"><LoadingState state="loading" /></td>
								</tr>
								<tr v-if="users.items?.length === 0">
									<td colspan="4"><i>None</i></td>
								</tr>
							</tbody>
						</v-table>
						<div class="d-flex align-center justify-end" v-if="users.items?.length">
							<v-btn icon variant="text" title="Previous" @click="refreshUsers({ offset: users.offset - users.limit })" :disabled="users.offset <= 0"><v-icon icon="mdi-chevron-left" /></v-btn>
							<span style="color: rgba(0,0,0,0.5)"><b>{{ users.offset + 1 }}</b>&ndash;<b>{{ users.offset + users.items.length }}</b> of <b>{{ formatNumber(users.total) }}</b></span>
							<v-btn icon variant="text" title="Next" @click="refreshUsers({ offset: users.offset + users.limit })" :disabled="users.offset + users.limit >= users.total"><v-icon icon="mdi-chevron-right" /></v-btn>
						</div>

						<!-- Edit Quota Dialog -->
						<v-dialog v-model="showEditQuota" max-width="400">
							<v-card>
								<v-card-title class="d-flex align-center">
									Quota - {{ quota.user?.name }}
									<v-spacer />
									<v-btn icon="mdi-close" variant="text" density="compact" @click="showEditQuota = false" />
								</v-card-title>
								<form @submit.prevent="saveQuota()">
									<v-card-text>
										<v-alert v-if="quota.message" id="edit-quota-message" type="error" variant="tonal" class="mb-4">
											{{ quota.message }}
										</v-alert>
										<div class="d-flex ga-2 align-center">
											<v-text-field id="used-field" type="number" v-model.number="quota.usedNew" label="Used this month" :disabled="quota.usedOld === null" />
											<span>/</span>
											<v-text-field id="limit-field" type="number" min="0" v-model.number="quota.limit" label="Limit per month" :disabled="quota.usedOld === null" />
										</div>
									</v-card-text>
									<v-card-actions>
										<v-spacer />
										<v-btn id="save-quota-button" type="submit" color="primary" :disabled="quota.usedOld === null">Save</v-btn>
										<v-btn variant="text" @click="showEditQuota = false">Cancel</v-btn>
									</v-card-actions>
								</form>
							</v-card>
						</v-dialog>
					</div>

					<!-- Credentials -->
					<div v-show="section === 'credentials'">
						<v-table>
							<thead>
								<tr>
									<th style="width: 0">Credentials</th>
									<th style="width: 0">User</th>
									<th style="width: 99%">Type</th>
									<th style="width: 0">Created</th>
									<th style="width: 0">Authorized</th>
								</tr>
							</thead>
							<tbody>
								<tr v-for="credential in credentials.items" :key="credential['@id'] as string" @contextmenu.prevent="onLongPress(credential['@id'] as string)">
									<td>{{ credential['@id'] }}</td>
									<td><a @click="setConstraint(credential.principal as string)">{{ formatUsername(credential.principal as string) }}</a></td>
									<td>{{ credential.type }}</td>
									<td class="text-no-wrap"><abbr :title="String(credential.created)">{{ formatAge(credential.created as string) }}</abbr></td>
									<td style="text-align: center; position: relative">
										{{ !credential.authorizationUrl }}
										<div class="row-actions" :class="{ 'row-actions--visible': longPressedId === credential['@id'] }">
											<v-btn icon="mdi-delete-outline" size="x-small" variant="elevated" color="primary" title="Delete" @click.stop="removeCredential(credential['@id'] as string)" />
										</div>
									</td>
								</tr>
								<tr v-if="credentials.items === null">
									<td colspan="5"><LoadingState state="loading" /></td>
								</tr>
								<tr v-if="credentials.items?.length === 0">
									<td colspan="5"><i>None</i></td>
								</tr>
							</tbody>
						</v-table>
						<div class="d-flex align-center justify-end" v-if="credentials.items?.length">
							<v-btn icon variant="text" title="Previous" @click="refreshCredentials({ offset: credentials.offset - credentials.limit })" :disabled="credentials.offset <= 0"><v-icon icon="mdi-chevron-left" /></v-btn>
							<span style="color: rgba(0,0,0,0.5)"><b>{{ credentials.offset + 1 }}</b>&ndash;<b>{{ credentials.offset + credentials.items.length }}</b> of <b>{{ formatNumber(credentials.total) }}</b></span>
							<v-btn icon variant="text" title="Next" @click="refreshCredentials({ offset: credentials.offset + credentials.limit })" :disabled="credentials.offset + credentials.limit >= credentials.total"><v-icon icon="mdi-chevron-right" /></v-btn>
						</div>
					</div>

					<!-- Tasks -->
					<div v-show="section === 'tasks'">
						<v-table>
							<thead>
								<tr>
									<th style="width: 0">Task</th>
									<th style="width: 0">User</th>
									<th style="width: 0">Bucket</th>
									<th style="width: 99%">Type</th>
									<th style="width: 0">Created</th>
									<th style="width: 0">Completed</th>
									<th style="width: 0">Status</th>
								</tr>
							</thead>
							<tbody>
								<tr v-for="task in tasks.items" :key="task['@id'] as string" @contextmenu.prevent="onLongPress(task['@id'] as string)">
									<td>{{ task['@id'] }}</td>
									<td><a @click="setConstraint(task.principal as string)">{{ formatUsername(task.principal as string) }}</a></td>
									<td>{{ task.bucket }}</td>
									<td>{{ task.type }}</td>
									<td class="text-no-wrap">
										<abbr :title="String(task.created)">{{ formatAge(task.created as string) }}</abbr>
									</td>
									<td class="text-no-wrap">
										<abbr :title="String(task.completed)">{{ formatAge(task.completed as string) }}</abbr>
									</td>
									<td style="position: relative">
										{{ task.status }}
										<div class="row-actions" :class="{ 'row-actions--visible': longPressedId === task['@id'] }">
											<v-btn icon size="x-small" variant="elevated" color="primary" title="Run" @click.stop="runTask(task['@id'] as string)">
												<v-icon icon="mdi-refresh" :class="tasks.running[task['@id'] as string] && 'mdi-spin'" />
											</v-btn>
											<v-btn icon="mdi-delete-outline" size="x-small" variant="elevated" color="primary" title="Delete" @click.stop="removeTask(task['@id'] as string)" />
										</div>
									</td>
								</tr>
								<tr v-if="tasks.items === null">
									<td colspan="7"><LoadingState state="loading" /></td>
								</tr>
								<tr v-if="tasks.items?.length === 0">
									<td colspan="7"><i>None</i></td>
								</tr>
							</tbody>
						</v-table>
						<div class="d-flex align-center justify-end" v-if="tasks.items?.length">
							<v-btn icon variant="text" title="Previous" @click="refreshTasks({ offset: tasks.offset - tasks.limit })" :disabled="tasks.offset <= 0"><v-icon icon="mdi-chevron-left" /></v-btn>
							<span style="color: rgba(0,0,0,0.5)"><b>{{ tasks.offset + 1 }}</b>&ndash;<b>{{ tasks.offset + tasks.items.length }}</b> of <b>{{ formatNumber(tasks.total) }}</b></span>
							<v-btn icon variant="text" title="Next" @click="refreshTasks({ offset: tasks.offset + tasks.limit })" :disabled="tasks.offset + tasks.limit >= tasks.total"><v-icon icon="mdi-chevron-right" /></v-btn>
						</div>
					</div>

					<!-- Scheduler -->
					<div v-show="section === 'scheduler'">
						<v-table>
							<thead>
								<tr>
									<th style="width: 99%">Job</th>
									<th style="width: 0; text-align: right">Begin</th>
									<th style="width: 0; text-align: right">Period</th>
								</tr>
							</thead>
							<tbody>
								<tr v-for="job in scheduler.jobs" :key="job.label as string">
									<td>{{ job.label }}</td>
									<td>{{ job.begin }}</td>
									<td style="text-align: right">{{ job.period }}</td>
								</tr>
								<tr v-if="scheduler.jobs === null">
									<td colspan="3"><LoadingState state="loading" /></td>
								</tr>
								<tr v-if="scheduler.jobs && scheduler.jobs.length === 0">
									<td colspan="3"><i>None</i></td>
								</tr>
							</tbody>
						</v-table>
					</div>

					<!-- Snapshots -->
					<div v-show="section === 'snapshots'">
						<v-table>
							<thead>
								<tr>
									<th style="width: 0">Snapshot</th>
									<th style="width: 99%">State</th>
									<th style="width: 0">Created</th>
									<th style="width: 0; text-align: right">Duration</th>
								</tr>
							</thead>
							<tbody>
								<tr v-for="snapshot in snapshots.items" :key="snapshot['@id'] as string" @contextmenu.prevent="onLongPress(snapshot['@id'] as string)">
									<td>{{ snapshot['@id'] }}</td>
									<td>{{ snapshot.state }}</td>
									<td class="text-no-wrap">
										<abbr :title="String(snapshot.created)">{{ formatAge(snapshot.created as string) }}</abbr>
									</td>
									<td style="text-align: right; position: relative">
										{{ formatDuration(snapshot.duration as number) }}
										<div class="row-actions" :class="{ 'row-actions--visible': longPressedId === snapshot['@id'] }">
											<v-btn icon="mdi-delete-outline" size="x-small" variant="elevated" color="primary" title="Delete" @click.stop="removeSnapshot(snapshot['@id'] as string)" />
										</div>
									</td>
								</tr>
								<tr v-if="snapshots.items === null">
									<td colspan="4"><LoadingState state="loading" /></td>
								</tr>
								<tr v-if="snapshots.items?.length === 0">
									<td colspan="4"><i>None</i></td>
								</tr>
							</tbody>
						</v-table>
						<div class="d-flex align-center justify-end" v-if="snapshots.items?.length">
							<v-btn icon variant="text" title="Previous" @click="refreshSnapshots({ offset: snapshots.offset - snapshots.limit })" :disabled="snapshots.offset <= 0"><v-icon icon="mdi-chevron-left" /></v-btn>
							<span style="color: rgba(0,0,0,0.5)"><b>{{ snapshots.offset + 1 }}</b>&ndash;<b>{{ snapshots.offset + snapshots.items.length }}</b> of <b>{{ formatNumber(snapshots.total) }}</b></span>
							<v-btn icon variant="text" title="Next" @click="refreshSnapshots({ offset: snapshots.offset + snapshots.limit })" :disabled="snapshots.offset + snapshots.limit >= snapshots.total"><v-icon icon="mdi-chevron-right" /></v-btn>
						</div>
					</div>

		</div>
	</div>
</template>

<style>
.admin-toolbar-search .v-field__field {
	align-items: center;
}
.admin-toolbar-search .v-field__input {
	padding-top: 0;
	padding-bottom: 0;
	min-height: auto;
}
.admin-toolbar-search .v-field__prepend-inner {
	padding-top: 0;
	align-items: center;
}
</style>
