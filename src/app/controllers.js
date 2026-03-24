(function() {

	'use strict';

	var app = angular.module('appModule');

	app.controller('CredentialsController', ['$scope', '$http', '$routeParams', '$location', '$window', 'localStorage', function($scope, $http, $routeParams, $location, $window, localStorage) {

		$scope.credentialsId = $routeParams.credentialsId;
		if ($scope.credentialsId === '-') {
			$scope.credentialsId = localStorage.getItem('credentials');
		}

		$http.post('/credentials/' + $scope.credentialsId, { 'credentials' : $location.search() })
			.success(function() {
				$scope.alert.show('Updated credentials.', 'alert-success');
				localStorage.removeItem('credentials');
				if ($window.opener) {
					$window.opener.angular.element('#app').scope().$broadcast('credentials');
					$window.close();
				}
			})
			.error(function(response, status) {
				if (status < 500) {
					$scope.message = 'Can\'t update credentials.';
				} else {
					$scope.message = 'Couldn\'t update credentials. Try again later or contact support.';
				}
			});
	}]);

	app.controller('DocumentController', ['$scope', '$location', '$routeParams', '$timeout', function($scope, $location, $routeParams, $timeout) {
		if ($routeParams.section) {
			var id = $location.path().substring(1).replace('/', '-');
			var element = document.getElementById(id);
			if (element) {
				$timeout(function() {
					element.scrollIntoView(true);
				});
			}
		}
	}]);

}());
