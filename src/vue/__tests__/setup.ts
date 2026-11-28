// Polyfill ResizeObserver for Vuetify in jsdom
class ResizeObserverMock {
	observe() {}
	unobserve() {}
	disconnect() {}
}

globalThis.ResizeObserver = ResizeObserverMock as unknown as typeof ResizeObserver;

// jsdom doesn't ship visualViewport; Vuetify's VOverlay locationStrategies expects it.
Object.defineProperty(window, 'visualViewport', {
	configurable: true,
	value: {
		width: window.innerWidth,
		height: window.innerHeight,
		offsetLeft: 0,
		offsetTop: 0,
		scale: 1,
		addEventListener: () => {},
		removeEventListener: () => {},
	},
});
