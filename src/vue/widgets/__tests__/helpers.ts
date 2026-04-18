import { flushPromises, mount, type VueWrapper } from '@vue/test-utils';
import { vi } from 'vitest';
import { type Component, type ComponentPublicInstance, defineComponent, ref, watch } from 'vue';
import { createVuetify } from 'vuetify';
import { type DashboardApi, dashboardKey } from '../../composables/useDashboard';

const vuetify = createVuetify();

export function createMockDashboard(): DashboardApi {
	return {
		constraints: ref([]),
		constraintsB: ref([]),
		total: ref(0),
		totalB: ref<number | null>(null),
		generation: ref(0),
		search: vi.fn().mockResolvedValue({}),
		searchB: vi.fn().mockResolvedValue({}),
		refresh: vi.fn(),
		addConstraint: vi.fn(),
		addConstraintB: vi.fn(),
		addConstraints: vi.fn(),
		removeConstraint: vi.fn(),
		removeConstraintB: vi.fn(),
		invertConstraint: vi.fn(),
		invertConstraintB: vi.fn(),
		getConstraints: vi.fn().mockReturnValue([]),
		getConstraintsB: vi.fn().mockReturnValue([]),
		swapAB: vi.fn(),
	};
}

export async function feedData(dashboard: DashboardApi, widgetId: string, data: unknown, dataB?: unknown): Promise<void> {
	const result = { [widgetId]: data };
	const resultB = dataB !== undefined ? { [widgetId]: dataB } : undefined;
	(dashboard.search as ReturnType<typeof vi.fn>).mockResolvedValue(result);
	if (resultB) {
		(dashboard.searchB as ReturnType<typeof vi.fn>).mockResolvedValue(resultB);
	}
	dashboard.generation.value++;
	await flushPromises();
}

interface MountWidgetOptions {
	stubs?: Record<string, Component | boolean>;
}

export function mountWidget(component: Component, settings: Record<string, unknown>, opts?: MountWidgetOptions): { wrapper: VueWrapper<ComponentPublicInstance>; dashboard: DashboardApi } {
	const dashboard = createMockDashboard();
	const wrapper = mount(component, {
		props: { settings, active: true },
		global: {
			plugins: [vuetify],
			provide: { [dashboardKey as symbol]: dashboard },
			stubs: opts?.stubs,
		},
	});
	return { wrapper, dashboard };
}

export function createEChartsStub(): {
	Stub: ReturnType<typeof defineComponent>;
	capturedOptions: { value: Record<string, unknown> | null };
	allCapturedOptions: Array<Record<string, unknown>>;
} {
	const capturedOptions = { value: null as Record<string, unknown> | null };
	const allCapturedOptions: Array<Record<string, unknown>> = [];
	const Stub = defineComponent({
		props: ['options', 'height'],
		emits: ['ready', 'snapshot'],
		setup(props) {
			watch(
				() => props.options,
				(v: Record<string, unknown> | null) => {
					if (v) {
						capturedOptions.value = v;
						allCapturedOptions.push(v);
					}
				},
				{ immediate: true },
			);
		},
		template: '<div class="echarts-stub" />',
	});
	return { Stub, capturedOptions, allCapturedOptions };
}
