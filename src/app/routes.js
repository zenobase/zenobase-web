(function() {

	'use strict';

	var app = angular.module('appModule');

	app.config(['$routeProvider', function($routeProvider) {
		$routeProvider.when('/', { templateUrl: '/partials/home.html' })
			.when('/buckets/:bucketId/', { templateUrl : '/partials/dashboard.html', reloadOnSearch : false })
			.when('/credentials/:credentialsId', { templateUrl : '/partials/credentials.html' })
			.when('/users/:username', { templateUrl : '/partials/user.html' })
			.when('/users/:username/reset', { templateUrl : '/partials/reset.html' })
			.when('/users/:username/verify', { templateUrl : '/partials/verification.html' })
			.when('/oauth/authorize', { templateUrl : '/partials/oauth.html' })
			.when('/legal/:section?', { title : 'Legal', templateUrl : '/partials/legal.html', controller : 'DocumentController' })
			.when('/api/:section?', { title : 'API', templateUrl : '/partials/api.html', controller : 'DocumentController' })
			.otherwise({ templateUrl : '/partials/404.html' });
	}]);

	app.run(['$rootScope', function($rootScope) {
		$rootScope.page = {
			setTitle: function(title) {
				this.title = (title ? title + ' | ' : '') + 'Zenobase';
			}
		};
		$rootScope.$on('$routeChangeSuccess', function(event, current) {
			if (current.$$route) {
				$rootScope.page.setTitle(current.$$route.title);
			}
		});
	}]);

}());
