<script setup lang="ts">
import type { Component } from 'vue';
import { type ComponentPublicInstance, computed, inject, nextTick, onMounted, provide, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import type { Bucket, SearchResult, WidgetSettings, ZenoEvent } from '../../types';
import { WIDGET_TITLES, type WidgetType } from '../../types';
import api, { ApiError } from '../api';
import AddWidgetDialog from '../components/AddWidgetDialog.vue';
import CreateTaskDialog from '../components/CreateTaskDialog.vue';
import EditBucketDialog from '../components/EditBucketDialog.vue';
import ErrorBoundary from '../components/ErrorBoundary.vue';
import EventEditDialog from '../components/EventEditDialog.vue';
import ExportDialog from '../components/ExportDialog.vue';
import ImportDialog from '../components/ImportDialog.vue';
import LoadingState from '../components/LoadingState.vue';
import SaveAsViewDialog from '../components/SaveAsViewDialog.vue';
import TaskListDialog from '../components/TaskListDialog.vue';
import WidgetSettingsDialog from '../components/WidgetSettingsDialog.vue';
import { type AlertApi, alertKey } from '../composables/useAlert';
import { type AuthApi, authKey } from '../composables/useAuth';
import { reloadBucketsKey } from '../composables/useBuckets';
import { dashboardKey, useDashboard } from '../composables/useDashboard';
import { getFieldIcon } from '../utils/eventFormatter';
import { getUserName } from '../utils/userNames';
import { SETTINGS_DIALOGS } from '../widgets';
import CountWidget from '../widgets/CountWidget.vue';
import GanttWidget from '../widgets/GanttWidget.vue';
import HeatmapWidget from '../widgets/HeatmapWidget.vue';
import HistogramWidget from '../widgets/HistogramWidget.vue';
import ListWidget from '../widgets/ListWidget.vue';
import MapWidget from '../widgets/MapWidget.vue';
import PolarWidget from '../widgets/PolarWidget.vue';
import RatingsWidget from '../widgets/RatingsWidget.vue';
import ScatterPlotWidget from '../widgets/ScatterPlotWidget.vue';
import ScoreboardWidget from '../widgets/ScoreboardWidget.vue';
import TimelineWidget from '../widgets/TimelineWidget.vue';

const WIDGET_COMPONENTS: Record<string, Component> = {
	list: ListWidget,
	count: CountWidget,
	gantt: GanttWidget,
	ratings: RatingsWidget,
	histogram: HistogramWidget,
	timeline: TimelineWidget,
	polar: PolarWidget,
	scatterplot: ScatterPlotWidget,
	map: MapWidget,
	heatmap: HeatmapWidget,
	scoreboard: ScoreboardWidget,
};

const route = useRoute();
const router = useRouter();
const auth = inject<AuthApi>(authKey)!;
const alertApi = inject<AlertApi>(alertKey)!;
const reloadBuckets = inject(reloadBucketsKey, () => {});
const bucketId = computed(() => route.params.bucketId as string);

const bucket = ref<Bucket | null>(null);
const message = ref('');
const activeTabs = ref<Record<string, string>>({});
const dirty = ref(false);
const loading = ref(false);
const widgetRefs = ref<Record<string, ComponentPublicInstance | null>>({});

function setDirty() {
	dirty.value = true;
}

async function run() {
	alertApi.clear();
	loading.value = true;
	try {
		const response = await api.get<{ tasks: Array<{ '@id': string }> }>(`/buckets/${bucketId.value}/tasks/`);
		for (const task of response.data.tasks) {
			if (await runTask(task['@id'])) break;
		}
		setTimeout(() => { dashboard.refresh(); reloadBuckets(); }, 1000);
	} finally {
		loading.value = false;
	}
}

async function runTask(taskId: string): Promise<boolean> {
	try {
		const response = await api.get<{ type: string }>(`/tasks/${taskId}`);
		const credentialsHeader = response.headers('X-Credentials');
		const linkHeader = response.headers('Link');
		if (credentialsHeader) {
			try {
				const credResponse = await api.post<{ '@id': string; authorizationUrl?: string }>('/credentials/', { type: credentialsHeader });
				if (credResponse.data.authorizationUrl) {
					alertApi.show(`${credentialsHeader} requires authorization`, 'error');
					if (credResponse.data['@id'] && !credResponse.data.authorizationUrl.includes(credResponse.data['@id'])) {
						localStorage.setItem('credentials', credResponse.data['@id']);
					}
					window.open(credResponse.data.authorizationUrl);
				}
			} catch {
				alertApi.show("Can't create credentials.", 'error');
			}
			return true;
		}
		if (linkHeader) {
			const match = linkHeader.match(/<(.+?)>/);
			if (match) {
				alertApi.show(`${response.data.type} requires authorization`, 'error');
				window.open(match[1]);
			}
			return true;
		}
	} catch (e) {
		if (e instanceof ApiError) {
			if (e.status === 403) {
				alertApi.show("Couldn't refresh a task. Insufficient quota?", 'error');
			} else if (e.status < 500) {
				alertApi.show("Couldn't refresh a task.", 'error');
			} else {
				alertApi.show("Couldn't refresh a task. Try again later or contact support.", 'error');
			}
		}
		return true;
	}
	return false;
}

async function saveBucket() {
	if (!bucket.value) return;
	alertApi.clear();
	try {
		const response = await api.put(`/buckets/${bucketId.value}`, bucket.value);
		if (bucket.value.version) {
			bucket.value.version += 1;
		}
		dirty.value = false;
		alertApi.show('Saved settings.', 'success', response.headers('X-Command-ID') || '');
	} catch (e: unknown) {
		const status = (e as { status?: number }).status;
		if (status && status < 500) {
			alertApi.show("Can't save this bucket.", 'error');
		} else {
			alertApi.show("Couldn't save this bucket. Try again later or contact support.", 'error');
		}
	}
}

function revertBucket() {
	location.reload();
}

const menuOpen = ref(false);

const editable = computed(() => {
	if (!auth.user.value || !bucket.value) return false;
	return bucket.value.roles.some((r) => r.principal === auth.user.value!['@id'] && (r.role === 'owner' || r.role === 'contributor'));
});

const dashboard = useDashboard(
	bucketId,
	(url: string) => api.get(url) as Promise<{ data: SearchResult }>,
	(params) => {
		const query: Record<string, string> = {};
		for (const [key, value] of Object.entries(params)) {
			if (value) {
				query[key] = value.join('|');
			}
		}
		router.replace({ query });
	},
	() => route.query as Record<string, string | string[] | undefined>,
);
provide(dashboardKey, dashboard);

function getWidgets(placement: string): WidgetSettings[] {
	return bucket.value?.widgets?.filter((w: WidgetSettings) => w.placement === placement) ?? [];
}

function hasWidgets(placement: string): boolean {
	return getWidgets(placement).length > 0;
}

function getComponent(type: string): Component | null {
	return WIDGET_COMPONENTS[type] || null;
}

function filterWidgets(widgets: WidgetSettings[]): WidgetSettings[] {
	return widgets.filter((w) => {
		if (WIDGET_COMPONENTS[w.type]) return true;
		console.warn(`Unknown widget type: ${w.type}`);
		return false;
	});
}

function getActiveTab(placement: string): string {
	if (activeTabs.value[placement]) return activeTabs.value[placement];
	const widgets = getWidgets(placement);
	return widgets.length > 0 ? widgets[0].id : '';
}

function setActiveTab(placement: string, id: string) {
	activeTabs.value[placement] = id;
	nextTick(() => {
		const widget = widgetRefs.value[id];
		if (widget && typeof (widget as unknown as { reflow: () => void }).reflow === 'function') {
			(widget as unknown as { reflow: () => void }).reflow();
		}
	});
}

function setWidgetRef(id: string, el: ComponentPublicInstance | null) {
	widgetRefs.value[id] = el;
}

// Drag-and-drop tab reordering
const dragSourceId = ref<string | null>(null);
const dropTargetId = ref<string | null>(null);

function onDragStart(e: DragEvent, widgetId: string) {
	dragSourceId.value = widgetId;
	e.dataTransfer!.effectAllowed = 'move';
	e.dataTransfer!.setData('text/plain', widgetId);
}

function onDragOver(e: DragEvent, widgetId: string) {
	e.preventDefault();
	e.dataTransfer!.dropEffect = 'move';
	dropTargetId.value = widgetId;
}

function onDragLeave() {
	dropTargetId.value = null;
}

function onDrop(e: DragEvent, targetId: string, placement: string) {
	e.preventDefault();
	dropTargetId.value = null;
	const sourceId = dragSourceId.value;
	dragSourceId.value = null;
	if (!sourceId || sourceId === targetId || !bucket.value?.widgets) return;

	const widgets = bucket.value.widgets;
	const sourceIdx = widgets.findIndex((w) => w.id === sourceId);
	if (sourceIdx === -1) return;

	const source = widgets.splice(sourceIdx, 1)[0];
	source.placement = placement;

	if (targetId === `+${placement}`) {
		// Dropped on the "+" tab — append to end
		widgets.push(source);
	} else {
		const targetIdx = widgets.findIndex((w) => w.id === targetId);
		if (targetIdx === -1) {
			widgets.push(source);
		} else {
			widgets.splice(targetIdx, 0, source);
		}
	}

	activeTabs.value[placement] = sourceId;
	setDirty();
}

function onDragEnd() {
	dragSourceId.value = null;
	dropTargetId.value = null;
}

// Event edit dialog
const showEventDialog = ref(false);
const editingEvent = ref<ZenoEvent | null>(null);

function openEventDialog(event: ZenoEvent) {
	editingEvent.value = event;
	showEventDialog.value = true;
}

async function removeEvent(eventId: string) {
	alertApi.clear();
	try {
		const response = await api.del(`/buckets/${bucketId.value}/${eventId}`);
		alertApi.show('Deleted an event.', 'success', response.headers('X-Command-ID') || '');
		setTimeout(() => { dashboard.refresh(); reloadBuckets(); }, 1000);
	} catch (e: unknown) {
		const status = (e as { status?: number }).status;
		if (status && status < 500) {
			alertApi.show("Can't delete the event.", 'error');
		} else {
			alertApi.show("Couldn't delete the event. Try again later or contact support.", 'error');
		}
	}
}

function onEventSaved() {
	setTimeout(() => { dashboard.refresh(); reloadBuckets(); }, 1000);
}

// Dialog visibility states
const showAddWidgetDialog = ref(false);
const addWidgetPlacement = ref('top');

const showEditBucketDialog = ref(false);
const showSaveAsViewDialog = ref(false);
const showTaskListDialog = ref(false);
const showCreateTaskDialog = ref(false);
const showImportDialog = ref(false);
const showExportDialog = ref(false);

function openAddWidget(placement: string) {
	addWidgetPlacement.value = placement;
	showAddWidgetDialog.value = true;
}

function onWidgetAdded(settings: WidgetSettings) {
	editingWidgetSettings.value = settings;
	editingWidgetType.value = settings.type as WidgetType;
	showWidgetSettingsDialog.value = true;
}

function openSettings() {
	menuOpen.value = false;
	showEditBucketDialog.value = true;
}

function openSaveView() {
	menuOpen.value = false;
	showSaveAsViewDialog.value = true;
}

function openTasks() {
	menuOpen.value = false;
	showTaskListDialog.value = true;
}

function openImport() {
	menuOpen.value = false;
	showImportDialog.value = true;
}

function openExport() {
	menuOpen.value = false;
	showExportDialog.value = true;
}

function onBucketSaved(updatedBucket: Bucket) {
	bucket.value = updatedBucket;
	setTimeout(() => { dashboard.refresh(); reloadBuckets(); }, 1000);
}

function onImported() {
	setTimeout(() => { dashboard.refresh(); reloadBuckets(); }, 1000);
}

function onTaskCreated() {
	// After creating a task, could refresh or reopen the task list
}

function openCreateTaskFromList() {
	showCreateTaskDialog.value = true;
}

const showWidgetSettingsDialog = ref(false);
const editingWidgetSettings = ref<WidgetSettings | null>(null);
const editingWidgetType = ref<WidgetType | ''>('');

function openWidgetSettings(settingsId: string) {
	const widget = bucket.value?.widgets?.find((w) => w.id === settingsId);
	if (widget) {
		editingWidgetSettings.value = widget;
		editingWidgetType.value = widget.type as WidgetType;
		showWidgetSettingsDialog.value = true;
	}
}

function onWidgetSettingsSaved(updated: WidgetSettings) {
	if (bucket.value?.widgets) {
		const index = bucket.value.widgets.findIndex((w) => w.id === updated.id);
		if (index !== -1) {
			bucket.value.widgets[index] = updated;
		} else {
			bucket.value.widgets.push(updated);
			activeTabs.value[updated.placement || 'top'] = updated.id;
		}
		setDirty();
		nextTick(() => dashboard.refresh());
	}
}

function onWidgetRemoved() {
	if (editingWidgetSettings.value && bucket.value?.widgets) {
		if (bucket.value.widgets.length <= 1) {
			alertApi.show('Cannot remove the last widget.', 'error');
			return;
		}
		const id = editingWidgetSettings.value.id;
		bucket.value.widgets = bucket.value.widgets.filter((w) => w.id !== id);
		setDirty();
		dashboard.refresh();
	}
}

async function loadBucket() {
	message.value = '';
	try {
		const response = await api.get<Bucket>(`/buckets/${bucketId.value}`);
		response.data.widgets = filterWidgets(response.data.widgets ?? []);
		bucket.value = response.data;
		dashboard.refresh();
	} catch (e: unknown) {
		const status = (e as { status?: number }).status;
		if (status && status < 500) {
			message.value = "Can't retrieve this bucket.";
		} else {
			message.value = "Couldn't retrieve this bucket. Try again later or contact support.";
		}
	}
}

onMounted(loadBucket);

watch(bucketId, () => {
	dashboard.reset();
	bucket.value = null;
	activeTabs.value = {};
	dirty.value = false;
	loadBucket();
});

watch(
	() => route.query,
	() => {
		if (bucket.value) {
			dashboard.refresh();
		}
	},
);
</script>

<template>
	<div>
		<v-alert v-if="message" type="error">{{ message }}</v-alert>

		<LoadingState v-if="!bucket && !message" state="loading" />

		<v-alert v-if="dirty && editable" type="info" closable class="mb-3" @click:close="revertBucket()">
			<strong><a @click="saveBucket()">Save</a></strong> or
			<strong><a @click="revertBucket()">revert</a></strong> changes to this dashboard.
		</v-alert>

		<div v-if="bucket" :key="bucketId">
			<Teleport to="#page-toolbar">
				<span class="text-subtitle-1 font-weight-bold mr-1" style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap">{{ bucket.label }}</span>
				<v-btn icon size="small" variant="text" @click="run()" title="Refresh" v-if="editable">
					<v-icon icon="mdi-refresh" :class="{ 'mdi-spin': loading }" />
				</v-btn>
				<v-btn icon size="small" variant="text" @click="openEventDialog({})" title="Create Event..." v-if="editable && !bucket.aliases?.length">
					<v-icon icon="mdi-plus" />
				</v-btn>
				<v-menu v-model="menuOpen" v-if="editable">
					<template v-slot:activator="{ props }">
						<v-btn icon variant="text" size="small" v-bind="props" title="More...">
							<v-icon icon="mdi-dots-vertical" />
						</v-btn>
					</template>
					<v-list density="compact">
						<v-list-item v-if="!bucket.aliases?.length" @click="openSaveView()">
							<v-list-item-title>Save View...</v-list-item-title>
						</v-list-item>
						<v-divider v-if="!bucket.aliases?.length" />
						<v-list-item v-if="!bucket.aliases?.length" @click="openTasks()">
							<v-list-item-title>Tasks...</v-list-item-title>
						</v-list-item>
						<v-list-item v-if="!bucket.aliases?.length" @click="openImport()">
							<v-list-item-title>Import...</v-list-item-title>
						</v-list-item>
						<v-list-item v-if="dashboard.total.value > 0" @click="openExport()">
							<v-list-item-title>Export...</v-list-item-title>
						</v-list-item>
						<v-divider />
						<v-list-item @click="openSettings()">
							<v-list-item-title>Settings...</v-list-item-title>
						</v-list-item>
					</v-list>
				</v-menu>
			</Teleport>

			<!-- Description -->
			<div class="text-body-2 text-medium-emphasis mb-4" v-if="bucket.description">{{ bucket.description }}</div>

			<!-- Constraint chips -->
			<div class="d-flex align-center flex-wrap ga-1 mb-2" v-if="dashboard.constraints.value.length || dashboard.constraintsB.value.length">
				<v-chip color="primary" variant="flat" size="default" class="font-weight-bold" title="Events (A)" v-if="dashboard.total.value >= 0">{{ dashboard.total.value.toLocaleString() }}</v-chip>
				<v-chip v-for="constraint in dashboard.constraints.value" :key="constraint.toString()" color="primary" variant="outlined" size="default" class="font-weight-bold" :title="constraint.toString()">
					<v-icon v-if="constraint.negated" icon="mdi-minus" start />
					<v-icon :icon="getFieldIcon(constraint.field)" start @click="dashboard.invertConstraint(constraint)" />
					{{ constraint.field === 'author' ? getUserName(constraint.shortValue()) : constraint.shortValue() }}
					<v-icon icon="mdi-close" end size="x-small" @click="dashboard.removeConstraint(constraint)" />
				</v-chip>
				<v-btn v-if="dashboard.constraints.value.length || dashboard.constraintsB.value.length" icon size="small" variant="text" title="Compare A/B" @click="dashboard.swapAB()">
					<v-icon icon="mdi-swap-horizontal" />
				</v-btn>
				<v-chip color="#CC6600" variant="flat" size="default" class="font-weight-bold" title="Events (B)" v-if="dashboard.totalB.value !== null && dashboard.totalB.value >= 0">{{ dashboard.totalB.value.toLocaleString() }}</v-chip>
				<v-chip v-for="constraint in dashboard.constraintsB.value" :key="'b-' + constraint.toString()" color="#CC6600" variant="outlined" size="default" class="font-weight-bold" :title="constraint.toString()">
					<v-icon v-if="constraint.negated" icon="mdi-minus" start />
					<v-icon :icon="getFieldIcon(constraint.field)" start @click="dashboard.invertConstraintB(constraint)" />
					{{ constraint.field === 'author' ? getUserName(constraint.shortValue()) : constraint.shortValue() }}
					<v-icon icon="mdi-close" end size="x-small" @click="dashboard.removeConstraintB(constraint)" />
				</v-chip>
			</div>

			<!-- Error state -->
			<v-empty-state v-if="dashboard.total.value < 0" icon="mdi-alert-circle-outline" headline="Couldn't load data" text="Try refreshing, or check back later." />

			<!-- Top placement -->
			<div v-if="dashboard.total.value >= 0 && (hasWidgets('top') || dirty)" class="widget-panel mb-3">
				<v-tabs v-model="activeTabs['top']" show-arrows>
					<v-tab v-for="settings in getWidgets('top')" :key="settings.id" :value="settings.id" class="widget-tab" :class="{ drop: dropTargetId === settings.id }" draggable="true" @dragstart="onDragStart($event, settings.id)" @dragover="onDragOver($event, settings.id)" @dragleave="onDragLeave" @drop="onDrop($event, settings.id, 'top')" @dragend="onDragEnd" @click="setActiveTab('top', settings.id)">{{ settings.label }}<v-icon v-if="activeTabs['top'] === settings.id" icon="mdi-cog" class="tab-settings-icon ml-2" size="x-small" title="Settings..." @click.stop="openWidgetSettings(settings.id)" /></v-tab>
					<v-tab class="widget-tab" :class="{ drop: dropTargetId === '+top' }" @dragover="onDragOver($event, '+top')" @dragleave="onDragLeave" @drop="onDrop($event, '+top', 'top')" @click="openAddWidget('top')" title="Add..."><v-icon icon="mdi-plus" size="small" /></v-tab>
				</v-tabs>
				<v-tabs-window v-model="activeTabs['top']">
					<v-tabs-window-item v-for="settings in getWidgets('top')" :key="settings.id" :value="settings.id" eager :transition="false" :reverse-transition="false">
						<ErrorBoundary><component :is="getComponent(settings.type)" v-if="getComponent(settings.type)" :ref="(el: ComponentPublicInstance | null) => setWidgetRef(settings.id, el)" :settings="settings" :active="getActiveTab('top') === settings.id" :editable="editable" @open-dialog="(_id: string, event: ZenoEvent) => openEventDialog(event)" @remove-event="(id: string) => removeEvent(id)" /></ErrorBoundary>
					</v-tabs-window-item>
				</v-tabs-window>
			</div>

			<!-- Left + Right placement -->
			<v-row v-if="dashboard.total.value >= 0">
				<v-col cols="12" md="6" v-if="hasWidgets('left') || dirty">
					<div class="widget-panel">
						<v-tabs v-model="activeTabs['left']" show-arrows>
							<v-tab v-for="settings in getWidgets('left')" :key="settings.id" :value="settings.id" class="widget-tab" :class="{ drop: dropTargetId === settings.id }" draggable="true" @dragstart="onDragStart($event, settings.id)" @dragover="onDragOver($event, settings.id)" @dragleave="onDragLeave" @drop="onDrop($event, settings.id, 'left')" @dragend="onDragEnd" @click="setActiveTab('left', settings.id)">{{ settings.label }}<v-icon v-if="activeTabs['left'] === settings.id" icon="mdi-cog" class="tab-settings-icon ml-2" size="x-small" title="Settings..." @click.stop="openWidgetSettings(settings.id)" /></v-tab>
							<v-tab class="widget-tab" :class="{ drop: dropTargetId === '+left' }" @dragover="onDragOver($event, '+left')" @dragleave="onDragLeave" @drop="onDrop($event, '+left', 'left')" @click="openAddWidget('left')" title="Add..."><v-icon icon="mdi-plus" size="small" /></v-tab>
						</v-tabs>
						<v-tabs-window v-model="activeTabs['left']">
							<v-tabs-window-item v-for="settings in getWidgets('left')" :key="settings.id" :value="settings.id" eager :transition="false" :reverse-transition="false">
								<ErrorBoundary><component :is="getComponent(settings.type)" v-if="getComponent(settings.type)" :ref="(el: ComponentPublicInstance | null) => setWidgetRef(settings.id, el)" :settings="settings" :active="getActiveTab('left') === settings.id" :editable="editable" @open-dialog="(_id: string, event: ZenoEvent) => openEventDialog(event)" @remove-event="(id: string) => removeEvent(id)" /></ErrorBoundary>
							</v-tabs-window-item>
						</v-tabs-window>
					</div>
				</v-col>
				<v-col cols="12" md="6" v-if="hasWidgets('right') || dirty">
					<div class="widget-panel">
						<v-tabs v-model="activeTabs['right']" show-arrows>
							<v-tab v-for="settings in getWidgets('right')" :key="settings.id" :value="settings.id" class="widget-tab" :class="{ drop: dropTargetId === settings.id }" draggable="true" @dragstart="onDragStart($event, settings.id)" @dragover="onDragOver($event, settings.id)" @dragleave="onDragLeave" @drop="onDrop($event, settings.id, 'right')" @dragend="onDragEnd" @click="setActiveTab('right', settings.id)">{{ settings.label }}<v-icon v-if="activeTabs['right'] === settings.id" icon="mdi-cog" class="tab-settings-icon ml-2" size="x-small" title="Settings..." @click.stop="openWidgetSettings(settings.id)" /></v-tab>
							<v-tab class="widget-tab" :class="{ drop: dropTargetId === '+right' }" @dragover="onDragOver($event, '+right')" @dragleave="onDragLeave" @drop="onDrop($event, '+right', 'right')" @click="openAddWidget('right')" title="Add..."><v-icon icon="mdi-plus" size="small" /></v-tab>
						</v-tabs>
						<v-tabs-window v-model="activeTabs['right']">
							<v-tabs-window-item v-for="settings in getWidgets('right')" :key="settings.id" :value="settings.id" eager :transition="false" :reverse-transition="false">
								<ErrorBoundary><component :is="getComponent(settings.type)" v-if="getComponent(settings.type)" :ref="(el: ComponentPublicInstance | null) => setWidgetRef(settings.id, el)" :settings="settings" :active="getActiveTab('right') === settings.id" :editable="editable" @open-dialog="(_id: string, event: ZenoEvent) => openEventDialog(event)" @remove-event="(id: string) => removeEvent(id)" /></ErrorBoundary>
							</v-tabs-window-item>
						</v-tabs-window>
					</div>
				</v-col>
			</v-row>
		</div>

		<EventEditDialog v-model="showEventDialog" :bucket-id="bucketId" :event="editingEvent" @saved="onEventSaved()" @deleted="(id: string) => removeEvent(id)" />

		<AddWidgetDialog v-if="bucket" v-model="showAddWidgetDialog" :bucket-id="bucketId" :bucket="bucket" :placement="addWidgetPlacement" @added="onWidgetAdded" />

		<EditBucketDialog v-if="bucket" v-model="showEditBucketDialog" :bucket-id="bucketId" :bucket="bucket" @saved="onBucketSaved" />

		<SaveAsViewDialog v-if="bucket" v-model="showSaveAsViewDialog" :bucket-id="bucketId" :bucket="bucket" :constraints="dashboard.constraints.value" />

		<TaskListDialog v-model="showTaskListDialog" :bucket-id="bucketId" @open-create-task="openCreateTaskFromList" @task-ran="() => { dashboard.refresh(); reloadBuckets() }" />

		<CreateTaskDialog v-model="showCreateTaskDialog" :bucket-id="bucketId" @created="onTaskCreated" />

		<ImportDialog v-model="showImportDialog" :bucket-id="bucketId" @imported="onImported" />

		<ExportDialog v-model="showExportDialog" :bucket-id="bucketId" :total="dashboard.total.value" :constraints="dashboard.constraints.value" />

		<WidgetSettingsDialog v-if="editingWidgetSettings" v-model="showWidgetSettingsDialog" :settings="editingWidgetSettings" :title="WIDGET_TITLES[editingWidgetType as WidgetType]" :is-new="!bucket?.widgets?.some((w) => w.id === editingWidgetSettings?.id)" @save="onWidgetSettingsSaved" @remove="onWidgetRemoved">
				<component :is="SETTINGS_DIALOGS[editingWidgetType as WidgetType]" />
			</WidgetSettingsDialog>
	</div>
</template>
