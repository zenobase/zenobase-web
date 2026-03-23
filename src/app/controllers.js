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

	app.controller('PricingController', ['$scope', '$http', function($scope, $http) {

		$scope.$watch('user', function(user) {
			if (user) {
				$http.get('/users/' + user['@id'] + '/quota')
					.success(function(response) {
						$scope.quota = response;
					})
					.error(function() {
						$scope.quota = null;
					});
			}
		});
	}]);

	app.controller('FreePlanDialogController', ['$scope', '$http', '$location', 'tracker', function($scope, $http, $location, tracker) {

		$scope.init = function() {
			$scope.message = '';
			$scope.processing = false;
			tracker.event('dialog', 'cancel payment');
		};

		$scope.cancel = function() {
			$scope.processing = true;
			$scope.alert.clear();
			$http({ method : 'DELETE', url : '/users/' + $scope.user['@id'] + '/payment' })
				.success(function() {
					$scope.processing = false;
					$scope.closeDialog();
					$scope.whoami();
				})
				.error(function() {
					$scope.processing = false;
					$scope.message = 'Couldn\'t change the plan. Try again later or contact support.';
				});
			tracker.event('action', 'payment cancelled');
		};
	}]);

	app.controller('PersonalPlanDialogController', ['$scope', '$http', '$location', 'braintree', 'merchantId', 'tracker', function($scope, $http, $location, braintree, merchantId, tracker) {

		$scope.merchantId = merchantId;
		$scope.integration = null;

		$scope.init = function() {
			$scope.processing = false;
			$scope.message = '';
			$http.post('/payments/token').success(function(response) {
				braintree.setup(response.value, 'dropin', {
					container : 'braintree',
					onReady : function(integration) {
						$scope.integration = integration;
					},
					onPaymentMethodReceived : function(payment) {
						pay(payment.nonce);
					},
					onError : function(error) {
						$scope.message = 'Couldn\'t save the payment method. Try again later or contact support.';
					}
				});
			});
			tracker.event('dialog', 'payment');
		};

		function pay(nonce) {
			$scope.processing = true;
			$scope.message = '';
			$scope.alert.clear();
			$http.post('/payments/', { 'price' : 5.0, 'nonce' : nonce })
				.success(function() {
					$scope.processing = false;
					$scope.closeDialog();
					$scope.whoami();
				})
				.error(function(response, status) {
					$scope.processing = false;
					if (status < 500) {
						$scope.message = 'Can\'t process the payment.';
					} else {
						$scope.message = 'Couldn\'t process the payment. Try again later or contact support.';
					}
				});
			tracker.event('action', 'payment');
		}

		$scope.close = function() {
			if ($scope.integration) {
				$scope.integration.teardown();
			}
		};

	}]);

}());
