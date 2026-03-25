<script setup lang="ts">
import { computed, inject, nextTick, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import type { Bucket, Role, User } from '../../types';
import api from '../api';
import { type AlertApi, alertKey } from '../composables/useAlert';
import { type AuthApi, authKey } from '../composables/useAuth';

const props = defineProps<{
	bucketId: string;
	bucket: Bucket;
	modelValue: boolean;
}>();

const emit = defineEmits<{
	'update:modelValue': [value: boolean];
	saved: [bucket: Bucket];
}>();

const alertApi = inject<AlertApi>(alertKey)!;
const auth = inject<AuthApi>(authKey)!;
const router = useRouter();

const visible = ref(false);
const message = ref('');
const newBucket = ref<Bucket | null>(null);
const isView = ref(false);

// User name cache for displaying permissions
const userNames = ref<Record<string, string>>({});

// Aliases management
const availableBuckets = ref<Array<{ '@id': string; label: string; aliases?: unknown[] }>>([]);
const selectedBucket = ref<{ '@id': string; label: string } | null>(null);
const aliasFilter = ref<string | null>(null);

const selectableBuckets = computed(() => {
	if (!availableBuckets.value || !newBucket.value?.aliases) return [];
	return availableBuckets.value.filter((bucket) => !bucket.aliases && !newBucket.value!.aliases!.some((alias) => alias['@id'] === bucket['@id']));
});

const isFormValid = computed(() => {
	if (!newBucket.value?.label) return false;
	if (isView.value && (!newBucket.value.aliases || newBucket.value.aliases.length === 0)) return false;
	return true;
});

function formatUsername(principal: string): string {
	if (!principal) return '';
	return userNames.value[principal] ?? principal;
}

async function resolveUserNames(roles: Role[]) {
	for (const role of roles) {
		if (role.principal === '*' || userNames.value[role.principal]) continue;
		try {
			const response = await api.get<User>(`/users/${role.principal}`);
			userNames.value[role.principal] = response.data.name || 'guest';
		} catch {
			userNames.value[role.principal] = role.principal;
		}
	}
}

async function init() {
	message.value = '';
	newBucket.value = JSON.parse(JSON.stringify(props.bucket));
	if (newBucket.value) {
		newBucket.value.refresh = !!(newBucket.value.refresh && auth.user.value?.quota);
		isView.value = !!(newBucket.value.aliases && newBucket.value.aliases.length > 0);
	}
	selectedBucket.value = null;
	aliasFilter.value = null;
	if (newBucket.value) {
		resolveUserNames(newBucket.value.roles);
	}
	if (auth.user.value) {
		try {
			const response = await api.get<{ buckets: Array<{ '@id': string; label: string; aliases?: unknown[] }> }>(
				`/users/${auth.user.value['@id']}/buckets/?order=label&offset=0&limit=100&labels_only=true`,
			);
			availableBuckets.value = response.data.buckets;
		} catch {
			availableBuckets.value = [];
		}
	}
}

function addAlias() {
	if (!newBucket.value?.aliases || !selectedBucket.value) return;
	newBucket.value.aliases.push({ '@id': selectedBucket.value['@id'], filter: aliasFilter.value || undefined });
	selectedBucket.value = null;
	aliasFilter.value = null;
}

function removeAlias(bucketId: string) {
	if (!newBucket.value?.aliases) return;
	newBucket.value.aliases = newBucket.value.aliases.filter((bucket) => bucket['@id'] !== bucketId);
}

function isPublished(): boolean {
	return newBucket.value?.roles.some((r) => r.principal === '*') ?? false;
}

function publish() {
	if (newBucket.value && !isPublished()) {
		newBucket.value.roles.push({ principal: '*', role: 'viewer' });
	}
}

function unpublish() {
	if (newBucket.value) {
		newBucket.value.roles = newBucket.value.roles.filter((r) => r.principal !== '*');
	}
}

async function save() {
	if (!newBucket.value) return;
	message.value = '';
	alertApi.clear();
	try {
		const response = await api.put(`/buckets/${props.bucketId}`, newBucket.value);
		alertApi.show('Saved settings.', 'success', response.headers('X-Command-ID') || '');
		if (newBucket.value.version !== undefined) {
			newBucket.value.version += 1;
		}
		close();
		emit('saved', newBucket.value);
	} catch (e: unknown) {
		const status = (e as { status?: number }).status;
		if (status === 400) {
			message.value = "Can't save this bucket";
		} else {
			message.value = "Couldn't save this bucket. Try again later or contact support.";
		}
	}
}

async function archiveBucket(archive: boolean) {
	if (!newBucket.value) return;
	alertApi.clear();
	if (archive) {
		newBucket.value.archived = true;
	} else {
		delete newBucket.value.archived;
	}
	try {
		await api.put(`/buckets/${props.bucketId}`, newBucket.value);
		close();
		const owner = newBucket.value.roles.find((r) => r.role === 'owner');
		if (owner) {
			router.push(`/users/${owner.principal}`);
		}
	} catch (e: unknown) {
		const status = (e as { status?: number }).status;
		if (status && status < 500) {
			message.value = "Can't archive this bucket.";
		} else {
			message.value = "Couldn't archive this bucket. Try again later or contact support.";
		}
	}
}

async function deleteBucket() {
	alertApi.clear();
	try {
		await api.del(`/buckets/${props.bucketId}`);
		close();
		const owner = newBucket.value?.roles.find((r) => r.role === 'owner');
		if (owner) {
			router.push(`/users/${owner.principal}`);
		}
	} catch (e: unknown) {
		const status = (e as { status?: number }).status;
		if (status && status < 500) {
			message.value = "Can't delete this bucket.";
		} else {
			message.value = "Couldn't delete this bucket. Try again later or contact support.";
		}
	}
}

function close() {
	visible.value = false;
	emit('update:modelValue', false);
}

watch(
	() => props.modelValue,
	(open) => {
		if (open) {
			init();
			nextTick(() => {
				visible.value = true;
			});
		} else {
			visible.value = false;
		}
	},
);
</script>

<template>
	<div v-if="visible" class="modal-backdrop fade in" @click="close()" />
	<div class="modal" :class="{ hide: !visible, in: visible, fade: true }" :style="visible ? { display: 'block', top: '10%' } : {}">
		<form class="modal-form" @submit.prevent="save()">
			<div class="modal-header">
				<a class="close" @click="close()">&times;</a>
				<h4>Bucket Settings</h4>
			</div>
			<div class="modal-body" v-if="newBucket">
				<div class="alert alert-error" v-if="message">{{ message }}</div>
				<div class="control-group">
					<label><strong>Label</strong></label>
					<div class="input-append">
						<input type="text" class="input-xlarge" required minlength="1" maxlength="30" v-model="newBucket.label" />
					</div>
				</div>
				<div class="control-group">
					<label><strong>Description</strong></label>
					<textarea class="input-xlarge" rows="2" v-model="newBucket.description" />
				</div>
				<div class="control-group">
					<label><strong>Permissions</strong></label>
					<ul class="nav nav-pills gray">
						<li class="active" v-for="role in newBucket.roles" :key="role.principal">
							<a v-if="role.principal === '*'" @click="unpublish()"><i class="fa fa-globe fa-white" /> <strong>anyone</strong> with a link can view <i class="fa fa-times fa-white" title="Revoke" /></a>
							<a v-else style="cursor: default"><i class="fa fa-user fa-white" /> <strong>{{ formatUsername(role.principal) }}</strong> is {{ role.role }}</a>
						</li>
						<li v-if="auth.user.value?.verified && !isPublished()">
							<a title="Add..." @click="publish()"><i class="fa fa-plus" /></a>
						</li>
					</ul>
					<p class="help-block" v-if="!auth.user.value?.verified">
						<i>You can make this dashboard public after signing up and verifying your email address.</i>
					</p>
				</div>
				<div class="control-group" v-if="!isView">
					<label><strong>Tasks</strong></label>
					<label class="radio">
						<input type="radio" v-model="newBucket.refresh" :value="true" :disabled="!auth.user.value?.quota" /> automatic refreshing (contact support to enable)
					</label>
					<label class="radio">
						<input type="radio" v-model="newBucket.refresh" :value="false" :disabled="!auth.user.value?.quota" /> manual refreshing only
					</label>
				</div>
				<div class="control-group" v-if="isView" style="clear: both">
					<label><strong>Aliases</strong></label>
					<ul class="nav nav-pills gray">
						<li class="active" v-for="alias in newBucket.aliases" :key="alias['@id']">
							<a @click="removeAlias(alias['@id'])">
								<i v-if="alias.filter" class="fa fa-filter fa-white" :title="alias.filter" />
								{{ alias['@id'] }} <i class="fa fa-times fa-white" />
							</a>
						</li>
					</ul>
					<div class="form-horizontal">
						<select class="input-medium" v-model="selectedBucket">
							<option :value="null" disabled />
							<option v-for="bucket in selectableBuckets" :key="bucket['@id']" :value="bucket">{{ bucket.label }}</option>
						</select>
						<span class="input-append">
							<input type="text" class="input-medium" v-model="aliasFilter" placeholder="e.g. tag:xyz" />
						</span>
						<button type="button" class="btn" :disabled="!selectedBucket" @click="addAlias()">Add</button>
					</div>
				</div>
			</div>
			<div class="modal-footer">
				<span class="pull-left">
					<a v-if="!bucket.archived" @click="archiveBucket(true)">Archive</a>
					<a v-if="bucket.archived" @click="archiveBucket(false)">Un-archive</a>
					{{ ' ' }} or {{ ' ' }}
					<a @click="deleteBucket()">delete</a> this bucket
				</span>
				<button type="submit" class="btn btn-primary" :disabled="!isFormValid">Update</button>
				<button type="button" class="btn" @click="close()">Cancel</button>
			</div>
		</form>
	</div>
</template>
