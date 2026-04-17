import { flushPromises } from '@vue/test-utils';
import { describe, expect, it, vi } from 'vitest';
import MapWidget from '../MapWidget.vue';
import { mountWidget } from './helpers';

vi.mock('../../composables/useGoogleMaps', () => {
	class MockLatLngBounds {
		_hasData: boolean;
		constructor(sw?: unknown, ne?: unknown) {
			this._hasData = sw !== undefined && ne !== undefined;
		}
		isEmpty() {
			return !this._hasData;
		}
		union() {
			return this;
		}
		getSouthWest() {
			return { lat: () => 47.3, lng: () => 8.5 };
		}
		getNorthEast() {
			return { lat: () => 47.4, lng: () => 8.6 };
		}
		toUrlValue() {
			return '47.3,8.5,47.4,8.6';
		}
		toSpan() {
			return { lat: () => 0.1 };
		}
	}

	return {
		GOOGLE_MAPS_MAP_ID: 'test-map-id',
		loadGoogleMaps: vi.fn().mockResolvedValue({
			LatLng: class {
				constructor(
					public lat: number,
					public lng: number,
				) {}
			},
			LatLngBounds: MockLatLngBounds,
			Map: class {
				fitBounds() {}
				getBounds() {
					return new MockLatLngBounds({}, {});
				}
				getZoom() {
					return 10;
				}
				controls = { [9]: { push() {} } };
			},
			marker: {
				AdvancedMarkerElement: class {
					map: unknown = null;
				},
			},
			Rectangle: class {
				setMap() {}
				setOptions() {}
			},
			SymbolPath: { CIRCLE: 0 },
			MapTypeId: { ROADMAP: 'roadmap' },
			MapTypeControlStyle: { DROPDOWN_MENU: 2 },
			ControlPosition: { TOP_RIGHT: 9 },
			event: { addListener() {} },
		}),
	};
});

describe('MapWidget', () => {
	const settings = { id: 'w1' };

	it('mounts and registers with dashboard', () => {
		const { dashboard } = mountWidget(MapWidget, settings);
		expect(dashboard.register).toHaveBeenCalledOnce();
	});

	it('shows loading state initially', () => {
		const { wrapper } = mountWidget(MapWidget, settings);
		expect(wrapper.find('.none').text()).toBe('Loading...');
	});

	it('hides loading after update with bounds', async () => {
		const { wrapper, registration } = mountWidget(MapWidget, settings);

		registration.update({ w1: { lat_min: 47.3, lon_min: 8.5, lat_max: 47.4, lon_max: 8.6 } });
		await flushPromises();

		expect(wrapper.find('.none').exists()).toBe(false);
	});

	it('shows "None" for empty bounds', async () => {
		const { wrapper, registration } = mountWidget(MapWidget, settings);

		registration.update({ w1: {} });
		await flushPromises();
		await flushPromises();

		expect(wrapper.text()).toContain('None');
	});

	it('resets to loading state on init', async () => {
		const { wrapper, registration } = mountWidget(MapWidget, settings);

		registration.update({ w1: { lat_min: 47.3, lon_min: 8.5, lat_max: 47.4, lon_max: 8.6 } });
		await flushPromises();

		registration.init();
		await flushPromises();

		expect(wrapper.find('.none').text()).toBe('Loading...');
	});
});
