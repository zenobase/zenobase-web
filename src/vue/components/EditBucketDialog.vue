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

const userNames = ref<Record<string, string>>({});

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
	<v-dialog v-model="visible" max-width="700" @update:model-value="!$event && close()">
		<v-card>
			<v-card-title>Bucket Settings</v-card-title>
			<v-form @submit.prevent="save()">
				<v-card-text v-if="newBucket">
					<v-alert v-if="message" type="error" variant="tonal" class="mb-4">{{ message }}</v-alert>
					<v-text-field label="Label" v-model="newBucket.label" required />
					<v-textarea label="Description" rows="2" v-model="newBucket.description" />

					<div class="text-subtitle-2 mb-2">Permissions</div>
					<div class="d-flex flex-wrap ga-2 mb-4 align-center">
						<v-chip v-for="role in newBucket.roles" :key="role.principal" :closable="role.principal === '*'" @click:close="unpublish()">
							<v-icon v-if="role.principal === '*'" icon="mdi-earth" size="small" start />
							<v-icon v-else icon="mdi-account" size="small" start />
							<template v-if="role.principal === '*'">anyone with a link can view</template>
							<template v-else><strong>{{ formatUsername(role.principal) }}</strong>&nbsp;is&nbsp;{{ role.role }}</template>
						</v-chip>
						<v-btn v-if="auth.user.value?.verified && !isPublished()" icon size="small" variant="text" title="Add..." @click="publish()">
							<v-icon icon="mdi-plus" />
						</v-btn>
					</div>
					<div v-if="!auth.user.value?.verified" class="text-body-2 font-italic mb-4">
						You can make this dashboard public after signing up and verifying your email address.
					</div>

					<template v-if="!isView">
						<div class="text-subtitle-2 mb-2">Tasks</div>
						<v-radio-group v-model="newBucket.refresh" :disabled="!auth.user.value?.quota">
							<v-radio label="automatic refreshing (contact support to enable)" :value="true" />
							<v-radio label="manual refreshing only" :value="false" />
						</v-radio-group>
					</template>

					<template v-if="isView">
						<div class="text-subtitle-2 mb-2">Aliases</div>
						<div class="d-flex flex-wrap ga-2 mb-4">
							<v-chip v-for="alias in newBucket.aliases" :key="alias['@id']" closable @click:close="removeAlias(alias['@id'])">
								<v-icon v-if="alias.filter" icon="mdi-filter" size="small" start :title="alias.filter" />
								{{ alias['@id'] }}
							</v-chip>
						</div>
						<div class="d-flex ga-2 align-center">
							<v-select :items="selectableBuckets" item-title="label" item-value="@id" return-object v-model="selectedBucket" label="Bucket" style="max-width: 200px" />
							<v-text-field v-model="aliasFilter" placeholder="e.g. tag:xyz" label="Filter" style="max-width: 200px" />
							<v-btn :disabled="!selectedBucket" @click="addAlias()">Add</v-btn>
						</div>
					</template>
				</v-card-text>
				<v-card-actions class="ps-4">
					<a v-if="!bucket.archived" @click="archiveBucket(true)">Archive</a>
					<a v-if="bucket.archived" @click="archiveBucket(false)">Un-archive</a>
					{{ ' ' }} or {{ ' ' }}
					<a @click="deleteBucket()">delete</a> {{ ' ' }} this bucket
					<v-spacer />
					<v-btn type="submit" color="primary" :disabled="!isFormValid">Update</v-btn>
					<v-btn variant="text" @click="close()">Cancel</v-btn>
				</v-card-actions>
			</v-form>
		</v-card>
	</v-dialog>
</template>
