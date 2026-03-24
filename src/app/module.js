(function() {

	'use strict';

	/**
	 * Stub console object if not present.
	 */
	(function(console) {
		$.each([ 'assert', 'log' ], function(i, method) {
			console[method] = console[method] || function() {};
		});
	}(window.console = window.console || {}));

	/**
	 * Prevent charts from capturing single finger swipes.
	 */
	(function() {
		Highcharts.wrap(Highcharts.Pointer.prototype, 'pinch', function(proceed, e) {
			if (e.touches.length > 1) {
				proceed.call(this, e);
			}
		});
	}());

	var app = angular.module('appModule', [ 'ngRoute', 'ngSanitize' ]);

}());
