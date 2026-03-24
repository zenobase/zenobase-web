(() => {
	/**
	 * Stub console object if not present.
	 */
	((console) => {
		$.each(['assert', 'log'], (i, method) => {
			console[method] = console[method] || (() => {});
		});
	})((window.console = window.console || {}));

	/**
	 * Prevent charts from capturing single finger swipes.
	 */
	(() => {
		Highcharts.wrap(Highcharts.Pointer.prototype, 'pinch', function (proceed, e) {
			if (e.touches.length > 1) {
				proceed.call(this, e);
			}
		});
	})();

	var _app = angular.module('appModule', ['ngRoute', 'ngSanitize']);
})();
