import { importLibrary, setOptions } from '@googlemaps/js-api-loader';

export const GOOGLE_MAPS_MAP_ID = import.meta.env.VITE_GOOGLE_MAPS_MAP_ID as string | undefined;

let initialized = false;
let mapsPromise: Promise<typeof google.maps> | null = null;

export function loadGoogleMaps(): Promise<typeof google.maps> {
	if (!mapsPromise) {
		if (!initialized) {
			setOptions({
				key: import.meta.env.VITE_GOOGLE_MAPS_API_KEY,
				v: '3.63',
			});
			initialized = true;
		}
		mapsPromise = Promise.all([importLibrary('maps'), importLibrary('marker'), importLibrary('places'), importLibrary('core')]).then(() => google.maps);
	}
	return mapsPromise;
}
