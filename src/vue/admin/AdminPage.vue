<script setup lang="ts">
import { onMounted, reactive, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import type { AdminBucket, AdminTask, AdminUser, Authorization, ClusterStatus, Credential, JournalCommand, PaginationParams, SchedulerJob, Snapshot } from '../../types/admin';
import { param } from '../../utils/helpers';
import api, { ApiError } from '../api';

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

function formatAge(date: string | null | undefined): string {
	if (!date) return '';
	const diff = Date.now() - new Date(date).getTime();
	const seconds = Math.floor(diff / 1000);
	if (seconds < 60) return `${seconds}s ago`;
	const minutes = Math.floor(seconds / 60);
	if (minutes < 60) return `${minutes}m ago`;
	const hours = Math.floor(minutes / 60);
	if (hours < 24) return `${hours}h ago`;
	const days = Math.floor(hours / 24);
	return `${days}d ago`;
}

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
				userNameCache.set(id, (response.data.name as string) || 'guest');
			} catch {
				userNameCache.set(id, 'guest');
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

// --- Authorizations ---

const authorizations = reactive({
	offset: 0,
	limit: 10,
	total: 0,
	items: null as Authorization[] | null,
	filter: null as string | null,
});

function authorizationParams(overrides?: Partial<PaginationParams>) {
	const params: PaginationParams = { offset: authorizations.offset, limit: authorizations.limit };
	if (authorizations.filter) params.q = authorizations.filter;
	return { ...params, ...overrides };
}

async function refreshAuthorizations(overrides?: Partial<PaginationParams>) {
	const path = constraint.value ? `/users/${constraint.value}/authorizations/` : '/authorizations/';
	const response = await api.get<{ total: number; authorizations: Authorization[] }>(path + '?' + param(authorizationParams(overrides)));
	if (overrides) Object.assign(authorizations, overrides);
	authorizations.total = response.data.total;
	authorizations.items = response.data.authorizations;
	resolveUserNames(response.data.authorizations.flatMap((a) => [a.principal, a.client]));
}

async function removeAuthorization(authId: string) {
	await api.del('/authorizations/' + authId);
	delay(() => refreshAll());
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

// --- Refresh all on key change ---

watch(refreshKey, () => {
	fetchStatus();
	refreshJournal({ offset: 0 });
	refreshBuckets({ offset: 0 });
	refreshUsers({ offset: 0 });
	refreshAuthorizations({ offset: 0 });
	refreshCredentials({ offset: 0 });
	refreshTasks({ offset: 0 });
	refreshScheduler();
	refreshSnapshots({ offset: 0 });
});

watch(constraint, () => {
	refreshJournal({ offset: 0 });
	refreshBuckets({ offset: 0 });
	refreshUsers({ offset: 0 });
	refreshAuthorizations({ offset: 0 });
	refreshCredentials({ offset: 0 });
	refreshTasks({ offset: 0 });
});

// --- Initial load ---

onMounted(() => {
	if (constraint.value) resolveUserNames([constraint.value]);
	fetchStatus();
	refreshJournal({});
	refreshBuckets({});
	refreshUsers({});
	refreshAuthorizations({});
	refreshCredentials({});
	refreshTasks({});
	refreshScheduler();
	refreshSnapshots({});
});

// --- Filter blur-on-enter helper ---

function blurOnEnter(event: KeyboardEvent) {
	if (event.key === 'Enter') {
		(event.target as HTMLInputElement).blur();
	}
}
</script>

<template>
	<div id="admin-dashboard" class="container-fluid">

		<div class="row-fluid page-titlebar">
			<p class="pull-left page-title">
				<span class="page-title-text">Admin</span>
				{{ ' ' }}
				<span v-if="status" class="badge page-title-decoration" title="Cluster Health"
					:class="{ 'badge-success': status.health === 'green', 'badge-warning': status.health === 'yellow', 'badge-important': status.health === 'red' }"
				>{{ status.data_nodes }}</span>
				{{ ' ' }}
				<a class="page-title-decoration" @click="refreshAll()" title="Refresh"><i class="fa fa-refresh" :class="outstanding > 0 && 'fa-spin'"></i></a>
				{{ ' ' }}
				<a v-if="status?.read_only" class="page-title-decoration" @click="setReadOnly(false)" title="in read-only mode"><i class="fa fa-lock"></i></a>
				<a v-if="status && !status.read_only" class="page-title-decoration" @click="setReadOnly(true)" title="in normal mode"><i class="fa fa-unlock"></i></a>
			</p>
			<ul class="nav nav-pills" v-if="constraint">
				<li class="active">
					<a @click="setConstraint(null)"><i class="fa fa-white fa-user"></i> <span>{{ formatUsername(constraint) }}</span> <i class="fa fa-times fa-white"></i></a>
				</li>
			</ul>
		</div>

		<div class="row-fluid">

			<div class="span8">

				<ul class="nav nav-tabs">
					<li class="active"><a href="#widget-journal" target="_self" data-toggle="tab">History</a></li>
					<li><a href="#widget-buckets" target="_self" data-toggle="tab">Buckets</a></li>
					<li><a href="#widget-users" target="_self" data-toggle="tab">Users</a></li>
					<li><a href="#widget-authorizations" target="_self" data-toggle="tab">Authorizations</a></li>
					<li><a href="#widget-credentials" target="_self" data-toggle="tab">Credentials</a></li>
					<li><a href="#widget-tasks" target="_self" data-toggle="tab">Tasks</a></li>
				</ul>

				<div class="tab-content">

					<!-- Journal -->
					<div id="widget-journal" class="tab-pane active">
						<form class="form-search" v-if="!constraint">
							<div class="input-append">
								<input type="text" class="search-query input-xlarge" v-model="journal.filter" @keydown="blurOnEnter" @blur="refreshJournal({ offset: 0 })" placeholder="@id, @type.name" />
								<button class="btn" @click="journal.filter = null; refreshJournal({ offset: 0 })" :disabled="!journal.filter"><i class="fa fa-close"></i></button>
							</div>
						</form>
						<table class="table">
							<thead>
								<tr>
									<th style="width: 0">Command</th>
									<th style="width: 0">User</th>
									<th style="width: 99%">Description</th>
									<th style="width: 0">Created</th>
									<th style="width: 0; text-align: right">Cost</th>
									<th style="width: 0"></th>
								</tr>
							</thead>
							<tbody>
								<tr v-for="command in journal.commands" :key="command['@id'] as string">
									<td>{{ command['@id'] }}</td>
									<td>
										<a @click="setConstraint(command.principal as string)">{{ formatUsername(command.principal as string) }}</a>
									</td>
									<td>
										<span>{{ command.label }}</span>
									</td>
									<td style="white-space: nowrap">
										<abbr :title="String(command.timestamp)">{{ formatAge(command.timestamp as string) }}</abbr>
									</td>
									<td style="text-align: right">
										<span v-if="command.cost">{{ formatNumber(command.cost as number) }}</span>
									</td>
									<td style="text-align: right">
										<a class="action" @click="undo(command['@id'] as string)" title="Undo"><i class="fa fa-step-backward"></i></a>
									</td>
								</tr>
								<tr v-if="journal.commands === null">
									<td colspan="6"><i>Loading</i></td>
								</tr>
								<tr v-if="journal.commands && journal.commands.length === 0">
									<td colspan="6"><i>None</i></td>
								</tr>
							</tbody>
						</table>
						<div class="btn-toolbar" v-if="journal.commands && journal.commands.length">
							<div class="btn-group pull-right">
								<button class="btn" title="Previous" @click="refreshJournal({ offset: journal.offset - journal.limit })" :disabled="journal.offset <= 0"><i class="fa fa-chevron-left"></i></button>
								<button class="btn" title="Next" @click="refreshJournal({ offset: journal.offset + journal.limit })" :disabled="journal.offset + journal.limit >= journal.total"><i class="fa fa-chevron-right"></i></button>
							</div>
							<div class="btn-group pull-right">
								<button class="btn disabled zeno-paging"><b>{{ journal.offset + 1 }}</b> &ndash; <b>{{ journal.offset + journal.commands.length }}</b> of <b>{{ formatNumber(journal.total) }}</b></button>
							</div>
						</div>
					</div>

					<!-- Buckets -->
					<div id="widget-buckets" class="tab-pane">
						<form class="form-search" v-if="!constraint">
							<div class="input-append">
								<input type="text" class="search-query input-xlarge" v-model="buckets.filter" @keydown="blurOnEnter" @blur="refreshBuckets({ offset: 0 })" placeholder="@id, refresh" />
								<button class="btn" @click="buckets.filter = null; refreshBuckets({ offset: 0 })" :disabled="!buckets.filter"><i class="fa fa-close"></i></button>
							</div>
						</form>
						<table class="table">
							<thead>
								<tr>
									<th style="width: 0">Bucket</th>
									<th style="width: 99%">User</th>
									<th style="width: 0">Created</th>
									<th style="width: 0; text-align: right">Size</th>
									<th style="width: 0"></th>
								</tr>
							</thead>
							<tbody>
								<tr v-for="bucket in buckets.items" :key="bucket['@id'] as string">
									<td>
										<span :class="bucket.aliases && (bucket.aliases as unknown[]).length ? 'bucket-virtual' : undefined">{{ bucket['@id'] }}</span>
									</td>
									<td>
										<a @click="setConstraint(getOwner(bucket))">{{ formatUsername(getOwner(bucket)) }}</a>
									</td>
									<td style="white-space: nowrap">
										<abbr :title="String(bucket.created)">{{ formatAge(bucket.created as string) }}</abbr>
									</td>
									<td style="text-align: right">
										<a v-if="isPublished(bucket)" :href="`/#/buckets/${bucket['@id']}`">{{ bucket.size }}</a>
										<span v-else>{{ formatNumber(bucket.size as number) }}</span>
									</td>
									<td style="text-align: right">
										<a class="action" @click="removeBucket(bucket['@id'] as string)" title="Delete"><i class="fa fa-trash-o"></i></a>
									</td>
								</tr>
								<tr v-if="buckets.items && buckets.items.length">
									<td><em>Total</em></td>
									<td></td>
									<td></td>
									<td style="text-align: right">{{ formatNumber(buckets.events) }}</td>
									<td></td>
								</tr>
								<tr v-if="buckets.items === null">
									<td colspan="5"><i>Loading</i></td>
								</tr>
								<tr v-if="buckets.items && buckets.items.length === 0">
									<td colspan="5"><i>None</i></td>
								</tr>
							</tbody>
						</table>
						<div class="btn-toolbar" v-if="buckets.items && buckets.items.length">
							<div class="btn-group pull-left">
								<a class="btn" :href="`/buckets/?code=${api.getToken()}`" title="Download"><i class="fa fa-download"></i></a>
							</div>
							<div class="btn-group pull-right">
								<button class="btn" title="Previous" @click="refreshBuckets({ offset: buckets.offset - buckets.limit })" :disabled="buckets.offset <= 0"><i class="fa fa-chevron-left"></i></button>
								<button class="btn" title="Next" @click="refreshBuckets({ offset: buckets.offset + buckets.limit })" :disabled="buckets.offset + buckets.limit >= buckets.total"><i class="fa fa-chevron-right"></i></button>
							</div>
							<div class="btn-group pull-right">
								<button class="btn disabled zeno-paging"><b>{{ buckets.offset + 1 }}</b> &ndash; <b>{{ buckets.offset + buckets.items.length }}</b> of <b>{{ formatNumber(buckets.total) }}</b></button>
							</div>
						</div>
					</div>

					<!-- Users -->
					<div id="widget-users" class="tab-pane">
						<form class="form-search" v-if="!constraint">
							<div class="input-append">
								<input type="text" class="search-query input-xlarge" v-model="users.filter" @keydown="blurOnEnter" @blur="refreshUsers({ offset: 0 })" placeholder="@id, name, email, verified, suspended, quota" />
								<button class="btn" @click="users.filter = null; refreshUsers({ offset: 0 })" :disabled="!users.filter"><i class="fa fa-close"></i></button>
							</div>
						</form>
						<table class="table">
							<thead>
								<tr>
									<th style="width: 0">User</th>
									<th style="width: 99%">Email</th>
									<th style="width: 0">Created</th>
									<th style="width: 0; text-align: right">Quota</th>
									<th style="width: 0"></th>
								</tr>
							</thead>
							<tbody>
								<tr v-for="user in users.items" :key="user['@id'] as string">
									<td>
										<a v-if="!user.suspended" @click="setConstraint(user['@id'] as string)" :class="user.superuser ? 'b' : undefined">{{ user.name }}</a>
										<span v-else style="color: gray">{{ user.name }}</span>
									</td>
									<td>
										<a :href="`mailto:${user.email}`">{{ user.email }}</a>
										{{ ' ' }}
										<a v-if="!user.optedout" title="Opt Out" @click="optoutUser(user)"><i class="fa fa-envelope"></i></a>
										<a v-if="user.optedout" title="Opt In" @click="optinUser(user)"><i class="fa fa-envelope-o"></i></a>
										<a v-if="!user.verified" title="Resend Verification" @click="reverifyUser(user)"><i class="fa fa-send-o"></i></a>
									</td>
									<td style="white-space: nowrap">
										<abbr :title="String(user.created)">{{ formatAge(user.created as string) }}</abbr>
									</td>
									<td style="text-align: right; white-space: nowrap">
										<a class="action" @click="openEditQuota(user)" title="Edit Quota"><i class="fa fa-pencil"></i></a>
										<span>{{ formatNumber(user.quota as number) }}</span>
									</td>
									<td style="text-align: right">
										<a v-if="!user.suspended && !user.superuser" class="action" @click="suspendUser(user.name as string)" title="Suspend"><i class="fa fa-ban"></i></a>
										<a v-if="user.suspended" class="action" @click="removeUser(user.name as string)" title="Delete"><i class="fa fa-trash-o"></i></a>
									</td>
								</tr>
								<tr v-if="users.items === null">
									<td colspan="5"><i>Loading</i></td>
								</tr>
								<tr v-if="users.items && users.items.length === 0">
									<td colspan="5"><i>None</i></td>
								</tr>
							</tbody>
						</table>
						<div class="btn-toolbar" v-if="users.items && users.items.length">
							<div class="btn-group pull-left">
								<a class="btn" :href="`/users/?code=${api.getToken()}`" title="Download"><i class="fa fa-download"></i></a>
							</div>
							<div class="btn-group pull-right">
								<button class="btn" title="Previous" @click="refreshUsers({ offset: users.offset - users.limit })" :disabled="users.offset <= 0"><i class="fa fa-chevron-left"></i></button>
								<button class="btn" title="Next" @click="refreshUsers({ offset: users.offset + users.limit })" :disabled="users.offset + users.limit >= users.total"><i class="fa fa-chevron-right"></i></button>
							</div>
							<div class="btn-group pull-right">
								<button class="btn disabled zeno-paging"><b>{{ users.offset + 1 }}</b> &ndash; <b>{{ users.offset + users.items.length }}</b> of <b>{{ formatNumber(users.total) }}</b></button>
							</div>
						</div>

						<!-- Edit Quota Dialog -->
						<div v-if="showEditQuota" class="modal-backdrop fade in" @click="showEditQuota = false" />
						<div class="modal" :class="{ hide: !showEditQuota }" :style="showEditQuota ? { display: 'block', top: '10%' } : {}">
							<form class="modal-form" @submit.prevent="saveQuota()">
								<fieldset :disabled="quota.usedOld === null">
									<div class="modal-header">
										<a class="close" @click="showEditQuota = false">&times;</a>
										<h4>Quota - {{ quota.user?.name }}</h4>
									</div>
									<div class="modal-body">
										<div v-if="quota.message" id="edit-quota-message" class="alert alert-error">
											{{ quota.message }}
										</div>
										<div class="control-group">
											<input id="used-field" type="number" v-model.number="quota.usedNew" title="Used this month" /> /
											<input id="limit-field" type="number" min="0" v-model.number="quota.limit" title="Limit per month" />
										</div>
									</div>
									<div class="modal-footer">
										<button id="save-quota-button" type="submit" class="btn btn-primary">Save</button>
										<button type="reset" class="btn" @click="showEditQuota = false">Cancel</button>
									</div>
								</fieldset>
							</form>
						</div>
					</div>

					<!-- Authorizations -->
					<div id="widget-authorizations" class="tab-pane">
						<form class="form-search" v-if="!constraint">
							<div class="input-append">
								<input type="text" class="search-query input-xlarge" v-model="authorizations.filter" @keydown="blurOnEnter" @blur="refreshAuthorizations({ offset: 0 })" placeholder="@id, client, scope" />
								<button class="btn" @click="authorizations.filter = null; refreshAuthorizations({ offset: 0 })" :disabled="!authorizations.filter"><i class="fa fa-close"></i></button>
							</div>
						</form>
						<table class="table">
							<thead>
								<tr>
									<th style="width: 0">Authorization</th>
									<th style="width: 99%">User</th>
									<th style="width: 0">Created</th>
									<th style="width: 0">Client</th>
									<th style="width: 0">Scope</th>
									<th style="width: 0"></th>
								</tr>
							</thead>
							<tbody>
								<tr v-for="auth in authorizations.items" :key="auth['@id'] as string">
									<td>{{ auth['@id'] }}</td>
									<td>
										<a @click="setConstraint(auth.principal as string)">{{ formatUsername(auth.principal as string) }}</a>
									</td>
									<td style="white-space: nowrap">
										<abbr :title="String(auth.created)">{{ formatAge(auth.created as string) }}</abbr>
									</td>
									<td>
										<a v-if="auth.client" @click="setConstraint(auth.client as string)">{{ formatUsername(auth.client as string) }}</a>
									</td>
									<td>{{ auth.scope }}</td>
									<td style="text-align: right">
										<a class="action" @click="removeAuthorization(auth['@id'] as string)" title="Delete"><i class="fa fa-trash-o"></i></a>
									</td>
								</tr>
								<tr v-if="authorizations.items === null">
									<td colspan="6"><i>Loading</i></td>
								</tr>
								<tr v-if="authorizations.items && authorizations.items.length === 0">
									<td colspan="6"><i>None</i></td>
								</tr>
							</tbody>
						</table>
						<div class="btn-toolbar" v-if="authorizations.items && authorizations.items.length">
							<div class="btn-group pull-right">
								<button class="btn" title="Previous" @click="refreshAuthorizations({ offset: authorizations.offset - authorizations.limit })" :disabled="authorizations.offset <= 0"><i class="fa fa-chevron-left"></i></button>
								<button class="btn" title="Next" @click="refreshAuthorizations({ offset: authorizations.offset + authorizations.limit })" :disabled="authorizations.offset + authorizations.limit >= authorizations.total"><i class="fa fa-chevron-right"></i></button>
							</div>
							<div class="btn-group pull-right">
								<button class="btn disabled zeno-paging"><b>{{ authorizations.offset + 1 }}</b> &ndash; <b>{{ authorizations.offset + authorizations.items.length }}</b> of <b>{{ formatNumber(authorizations.total) }}</b></button>
							</div>
						</div>
					</div>

					<!-- Credentials -->
					<div id="widget-credentials" class="tab-pane">
						<form class="form-search" v-if="!constraint">
							<div class="input-append">
								<input type="text" class="search-query input-xlarge" v-model="credentials.filter" @keydown="blurOnEnter" @blur="refreshCredentials({ offset: 0 })" placeholder="@id, type, authorizationUrl" />
								<button class="btn" @click="credentials.filter = null; refreshCredentials({ offset: 0 })" :disabled="!credentials.filter"><i class="fa fa-close"></i></button>
							</div>
						</form>
						<table class="table">
							<thead>
								<tr>
									<th style="width: 0">Credentials</th>
									<th style="width: 0">User</th>
									<th style="width: 99%">Type</th>
									<th style="width: 0">Created</th>
									<th style="width: 0">Authorized</th>
									<th style="width: 0"></th>
								</tr>
							</thead>
							<tbody>
								<tr v-for="credential in credentials.items" :key="credential['@id'] as string">
									<td>{{ credential['@id'] }}</td>
									<td><a @click="setConstraint(credential.principal as string)">{{ formatUsername(credential.principal as string) }}</a></td>
									<td>{{ credential.type }}</td>
									<td style="white-space: nowrap"><abbr :title="String(credential.created)">{{ formatAge(credential.created as string) }}</abbr></td>
									<td style="text-align: center">{{ !credential.authorizationUrl }}</td>
									<td style="text-align: right">
										<a class="action" @click="removeCredential(credential['@id'] as string)" title="Delete"><i class="fa fa-trash-o"></i></a>
									</td>
								</tr>
								<tr v-if="credentials.items === null">
									<td colspan="6"><i>Loading</i></td>
								</tr>
								<tr v-if="credentials.items && credentials.items.length === 0">
									<td colspan="6"><i>None</i></td>
								</tr>
							</tbody>
						</table>
						<div class="btn-toolbar" v-if="credentials.items && credentials.items.length">
							<div class="btn-group pull-right">
								<button class="btn" title="Previous" @click="refreshCredentials({ offset: credentials.offset - credentials.limit })" :disabled="credentials.offset <= 0"><i class="fa fa-chevron-left"></i></button>
								<button class="btn" title="Next" @click="refreshCredentials({ offset: credentials.offset + credentials.limit })" :disabled="credentials.offset + credentials.limit >= credentials.total"><i class="fa fa-chevron-right"></i></button>
							</div>
							<div class="btn-group pull-right">
								<button class="btn disabled zeno-paging"><b>{{ credentials.offset + 1 }}</b> &ndash; <b>{{ credentials.offset + credentials.items.length }}</b> of <b>{{ formatNumber(credentials.total) }}</b></button>
							</div>
						</div>
					</div>

					<!-- Tasks -->
					<div id="widget-tasks" class="tab-pane">
						<form class="form-search" v-if="!constraint">
							<div class="input-append">
								<input type="text" class="search-query input-xlarge" v-model="tasks.filter" @keydown="blurOnEnter" @blur="refreshTasks({ offset: 0 })" placeholder="@id, type, status, bucket, completed" />
								<button class="btn" @click="tasks.filter = null; refreshTasks({ offset: 0 })" :disabled="!tasks.filter"><i class="fa fa-close"></i></button>
							</div>
						</form>
						<table class="table">
							<thead>
								<tr>
									<th style="width: 0">Task</th>
									<th style="width: 0">User</th>
									<th style="width: 0">Bucket</th>
									<th style="width: 99%">Type</th>
									<th style="width: 0">Created</th>
									<th style="width: 0">Completed</th>
									<th style="width: 0">Status</th>
									<th style="width: 0"></th>
								</tr>
							</thead>
							<tbody>
								<tr v-for="task in tasks.items" :key="task['@id'] as string">
									<td>{{ task['@id'] }}</td>
									<td><a @click="setConstraint(task.principal as string)">{{ formatUsername(task.principal as string) }}</a></td>
									<td>{{ task.bucket }}</td>
									<td>{{ task.type }}</td>
									<td style="white-space: nowrap">
										<abbr :title="String(task.created)">{{ formatAge(task.created as string) }}</abbr>
									</td>
									<td style="white-space: nowrap">
										<abbr :title="String(task.completed)">{{ formatAge(task.completed as string) }}</abbr>
									</td>
									<td>{{ task.status }}</td>
									<td style="white-space: nowrap; text-align: right">
										<a class="action" @click="runTask(task['@id'] as string)"><i class="fa fa-refresh" :class="tasks.running[task['@id'] as string] && 'fa-spin'" title="Run"></i></a>
										<a class="action" @click="removeTask(task['@id'] as string)" title="Delete"><i class="fa fa-trash-o"></i></a>
									</td>
								</tr>
								<tr v-if="tasks.items === null">
									<td colspan="8"><i>Loading</i></td>
								</tr>
								<tr v-if="tasks.items && tasks.items.length === 0">
									<td colspan="8"><i>None</i></td>
								</tr>
							</tbody>
						</table>
						<div class="btn-toolbar" v-if="tasks.items && tasks.items.length">
							<div class="btn-group pull-right">
								<button class="btn" title="Previous" @click="refreshTasks({ offset: tasks.offset - tasks.limit })" :disabled="tasks.offset <= 0"><i class="fa fa-chevron-left"></i></button>
								<button class="btn" title="Next" @click="refreshTasks({ offset: tasks.offset + tasks.limit })" :disabled="tasks.offset + tasks.limit >= tasks.total"><i class="fa fa-chevron-right"></i></button>
							</div>
							<div class="btn-group pull-right">
								<button class="btn disabled zeno-paging"><b>{{ tasks.offset + 1 }}</b> &ndash; <b>{{ tasks.offset + tasks.items.length }}</b> of <b>{{ formatNumber(tasks.total) }}</b></button>
							</div>
						</div>
					</div>

				</div>
			</div>

			<div class="span4">

				<ul class="nav nav-tabs">
					<li class="active"><a href="#widget-scheduler" target="_self" data-toggle="tab">Scheduler</a></li>
					<li><a href="#widget-snapshots" target="_self" data-toggle="tab">Snapshots</a></li>
				</ul>

				<div class="tab-content">

					<!-- Scheduler -->
					<div id="widget-scheduler" class="tab-pane active">
						<table class="table">
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
									<td colspan="3"><i>Loading</i></td>
								</tr>
								<tr v-if="scheduler.jobs && scheduler.jobs.length === 0">
									<td colspan="3"><i>None</i></td>
								</tr>
							</tbody>
						</table>
						<div class="btn-toolbar">
							<div class="btn-group pull-left">
								<button v-if="status && !status.scheduler_disabled" class="btn" @click="disableScheduler(true)" title="Pause"><i class="fa fa-pause"></i></button>
								<button v-if="status?.scheduler_disabled" class="btn" @click="disableScheduler(false)" title="Resume"><i class="fa fa-play"></i></button>
							</div>
						</div>
					</div>

					<!-- Snapshots -->
					<div id="widget-snapshots" class="tab-pane">
						<table class="table">
							<thead>
								<tr>
									<th style="width: 0">Snapshot</th>
									<th style="width: 99%">State</th>
									<th style="width: 0">Created</th>
									<th style="width: 0; text-align: right">Duration</th>
									<th style="width: 0"></th>
								</tr>
							</thead>
							<tbody>
								<tr v-for="snapshot in snapshots.items" :key="snapshot['@id'] as string">
									<td>{{ snapshot['@id'] }}</td>
									<td>{{ snapshot.state }}</td>
									<td style="white-space: nowrap">
										<abbr :title="String(snapshot.created)">{{ formatAge(snapshot.created as string) }}</abbr>
									</td>
									<td style="text-align: right">{{ formatDuration(snapshot.duration as number) }}</td>
									<td style="text-align: right">
										<a class="action" @click="removeSnapshot(snapshot['@id'] as string)" title="Delete"><i class="fa fa-trash-o"></i></a>
									</td>
								</tr>
								<tr v-if="snapshots.items === null">
									<td colspan="5"><i>Loading</i></td>
								</tr>
								<tr v-if="snapshots.items && snapshots.items.length === 0">
									<td colspan="5"><i>None</i></td>
								</tr>
							</tbody>
						</table>
						<div class="btn-toolbar">
							<div class="btn-group pull-left">
								<button class="btn" @click="createSnapshot()" :disabled="snapshots.snapshotting" title="Snapshot"><i class="fa fa-camera"></i></button>
							</div>
							<div class="btn-group pull-right" v-if="snapshots.items && snapshots.items.length">
								<button class="btn" title="Previous" @click="refreshSnapshots({ offset: snapshots.offset - snapshots.limit })" :disabled="snapshots.offset <= 0"><i class="fa fa-chevron-left"></i></button>
								<button class="btn" title="Next" @click="refreshSnapshots({ offset: snapshots.offset + snapshots.limit })" :disabled="snapshots.offset + snapshots.limit >= snapshots.total"><i class="fa fa-chevron-right"></i></button>
							</div>
							<div class="btn-group pull-right" v-if="snapshots.items && snapshots.items.length">
								<button class="btn disabled zeno-paging"><b>{{ snapshots.offset + 1 }}</b> &ndash; <b>{{ snapshots.offset + snapshots.items.length }}</b> of <b>{{ formatNumber(snapshots.total) }}</b></button>
							</div>
						</div>
					</div>

				</div>

			</div>

		</div>
	</div>
</template>
