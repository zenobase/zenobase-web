import { flushPromises } from '@vue/test-utils';
import { describe, expect, it, vi } from 'vitest';
import HeatmapWidget from '../HeatmapWidget.vue';
import { feedData, mountWidget } from './helpers';

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
			Marker: class {
				setMap() {}
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

vi.mock('@deck.gl/google-maps', () => ({
	GoogleMapsOverlay: class {
		setMap() {}
		setProps() {}
	},
}));

vi.mock('@deck.gl/aggregation-layers', () => ({
	HeatmapLayer: class {
		constructor(public props: Record<string, unknown>) {}
	},
}));

describe('HeatmapWidget', () => {
	const settings = { id: 'w1' };

	it('shows loading state initially', () => {
		const { wrapper } = mountWidget(HeatmapWidget, settings);
		expect(wrapper.find('.widget-state').text()).toContain('Loading');
	});

	it('hides loading after update with bounds', async () => {
		const { wrapper, dashboard } = mountWidget(HeatmapWidget, settings);

		await feedData(dashboard, 'w1', { lat_min: 47.3, lon_min: 8.5, lat_max: 47.4, lon_max: 8.6 });

		expect(wrapper.find('.none').exists()).toBe(false);
	});

	it('shows "None" for empty bounds', async () => {
		const { wrapper, dashboard } = mountWidget(HeatmapWidget, settings);

		await feedData(dashboard, 'w1', {});
		await flushPromises();

		expect(wrapper.text()).toContain('No data');
	});

	it('resets to loading state on new generation', async () => {
		const { wrapper, dashboard } = mountWidget(HeatmapWidget, settings);

		await feedData(dashboard, 'w1', { lat_min: 47.3, lon_min: 8.5, lat_max: 47.4, lon_max: 8.6 });

		// Simulate a new generation where search hasn't resolved yet
		(dashboard.search as ReturnType<typeof vi.fn>).mockReturnValue(new Promise(() => {}));
		dashboard.generation.value++;
		await flushPromises();

		expect(wrapper.find('.widget-state').text()).toContain('Loading');
	});
});
