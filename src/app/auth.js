(function() {

	'use strict';

	var app = angular.module('appModule');

	app.controller('ApplicationController', ['$scope', '$route', '$http', '$location', 'Alert', 'User', 'token', 'tracker', 'delay', function($scope, $route, $http, $location, Alert, User, token, tracker, delay) {

		$scope.alert = new Alert();

		$scope.whoami = function(success) {
			$http.get('/who').success(function(response) {
				$scope.user = response ? new User(response) : null;
				if ($scope.user) {
					if (success) {
						success($scope.user);
					}
					tracker.variable(1, 'user type', $scope.user.name ? 'registered' : 'unregistered', 1);
				}
			});
		};
		$scope.undo = function(commandId) {
			$scope.alert.clear();
			$http.post('/journal/' , { 'undo' : commandId })
				.success(function() {
					delay($route.reload);
				})
				.error(function() {
					$scope.alert.show('Couldn\'t undo.');
				});
			tracker.event('action', 'undo');

		};
		$scope.broadcast = function(event) {
			$scope.$broadcast(event);
		};
		$scope.signOut = function() {
			console.assert(token.get(), 'missing token');
			$scope.alert.clear();
			$http({ method : 'DELETE', url : '/authorizations/' + token.get() })
				.success(function() {
					token.set(null);
					$scope.user = null;
					if ($location.url() === '/') {
						$route.reload();
					} else {
						$scope.home();
					}
			});
			tracker.event('action', 'sign out');
		};
		$scope.home = function() {
			$location.url('/');
		};
		$scope.reload = function() {
			$route.reload();
		};
		$scope.openDialog = function(dialog, param) {
			$('input:focus').blur();
			$scope.$broadcast('openDialog', dialog, param);
		};
		$scope.openPage = function(path) {
			$scope.closeDialog();
			$location.url(path);
		};
		$scope.openDialogInPage = function(path, dialog, param) {
			$scope.openPage(path);
			delay(function() {
				$scope.openDialog(dialog, param);
			});
		};
		$scope.closeDialog = function() {
			$scope.openDialog(null);
		};

		$scope.$on('$routeChangeStart', function() {
			$scope.alert.clear();
		});
		$scope.$on('$routeChangeSuccess', function() {
			var path = $location.path().replace(/^\/(users|buckets)\/.+$/, '/$1/'); // remove personally identifiable information
			tracker.pageview(path);
			tracker.event('page', path);
		});
		$scope.whoami();
	}]);

	app.controller('UserController', ['$scope', '$http', '$routeParams', 'User', function($scope, $http, $routeParams, User) {

		$scope.username = $routeParams.username;
		$scope.profile = null;

		$scope.isSelf = function() {
			return $scope.user && $scope.profile && $scope.profile.getName() === $scope.user.getName();
		};
		$scope.isAnon = function() {
			return $scope.user === null;
		};

		$scope.$watch('profile', function(profile) {
			if (profile) {
				$scope.page.setTitle(profile.getName());
			}
		});

		$scope.$watch('user', function(user) {
			if (angular.isDefined(user)) {
				if (user && $scope.username === user.getName()) {
					$scope.profile = user;
				} else if ($scope.username !== 'guest') {
					$http.get('/users/@' + $scope.username)
						.success(function(response) {
							$scope.profile = new User(response);
						})
						.error(function(response, status) {
							if (status < 500) {
								$scope.message = 'Can\'t retrieve this user.';
							} else {
								$scope.message = 'Couldn\'t retrieve this user. Try again later or contact support.';
							}
						}
					);
				}
			}
		});
	}]);

	app.controller('AccountSettingsController', ['$scope', '$http', 'tracker', function($scope, $http, tracker) {

		$scope.init = function() {
			$scope.message = '';
			$scope.email = $scope.profile.email;
			tracker.event('dialog', 'edit user');
			$http.get('/users/' + $scope.user['@id'] + '/quota')
				.success(function(response) {
					$scope.quota = response;
				});
		};

		$scope.data = function() {
			var data = {};
			if ($scope.email && $scope.email !== $scope.profile.email || !$scope.profile.verified) {
				data.email = $scope.email;
			}
			return data;
		};
		$scope.save = function() {
			$scope.alert.clear();
			var data = $scope.data();
			if (!$.isEmptyObject(data)) {
				$http.post('/users/@' + $scope.username, data)
					.success(function(response, status, headers) {
						$scope.alert.show('Updated account settings.', 'alert-success', headers('X-Command-ID'));
						$scope.closeDialog();
						$scope.whoami();
					})
					.error(function(response, status) {
						if (status < 500) {
							$scope.message = 'Can\'t save these changes.';
						} else {
							$scope.message = 'Couldn\'t save these changes. Try again later or contact support.';
						}
					});
			} else {
				$scope.cancel();
			}
			tracker.event('action', 'save user');
		};
		$scope.terminate = function() {
			if (confirm('Close your account and delete all associated data?')) {
				tracker.event('action', 'close account');
				$http({ method : 'DELETE', url : '/users/@' + $scope.username })
					.success(function() {
						$scope.closeDialog();
						$scope.signOut();
					})
					.error(function(response, status) {
						if (status < 500) {
							$scope.message = 'Can\'t close this account.';
						} else {
							$scope.message = 'Couldn\'t close this account. Try again later or contact support.';
						}
					});
			}
		};
	}]);

	app.controller('PlanDialogController', ['$scope', '$http', 'tracker', function($scope, $http, tracker) {

		$scope.init = function() {
			$scope.message = '';
			$scope.plan = $scope.user.quota;
			tracker.event('dialog', 'select plan');
		};

		$scope.select = function() {
			$scope.alert.clear();
			tracker.event('action', 'select plan', $scope.plan);
		};
	}]);

	app.controller('SignInDialogController', ['$scope', '$http', '$location', '$route', 'User', 'token', 'tracker', function($scope, $http, $location, $route, User, token, tracker) {

		$scope.init = function() {
			$scope.message = '';
			$scope.username = '';
			$scope.password = '';
			tracker.event('dialog', 'sign in');
		};
		/** Ensures that autocompleted values are propagates to the model. */
		function update() {
			$scope.username = $("#sign-in-username").val();
			$scope.password = $("#sign-in-password").val();
		}
		$scope.signIn = function() {
			update();
			if ($scope.username.indexOf('@') != -1) {
				$scope.message = 'Please enter your username, not your email address.';
				return;
			}
			$http({ method: 'POST', url: '/oauth/token',
				data: $.param({ 'grant_type' : 'password', 'username' : $scope.username, 'password' : $scope.password }),
				headers: { 'Content-Type' : 'application/x-www-form-urlencoded' }
			})
				.success(function(response) {
					console.assert(response.access_token, 'missing token in sign in response');
					token.set(response.access_token);
					$scope.closeDialog();
					$scope.whoami();
					if ($location.url() === '/') {
						$location.url('/users/' + $scope.username);
					} else {
						$route.reload();
					}
				})
				.error(function(response, status) {
					if (status < 500) {
						$scope.message = 'The username or password you entered is incorrect.';
					} else {
						$scope.message = 'Unable to sign in, please try again later or contact support.';
					}
				});
			tracker.event('action', 'sign in');
		};

		$scope.$on('event:unauthorized', function() {
			$scope.openDialog('sign-in-dialog');
		});
	}]);

	app.controller('LostPasswordDialogController', ['$scope', '$http', 'tracker', function($scope, $http, tracker) {

		$scope.init = function() {
			$scope.username = '';
			$scope.email = '';
			$scope.message = '';
			tracker.event('dialog', 'password reset');
		};
		$scope.data = function() {
			return {
				username : $scope.username,
				email : $scope.email
			};
		};
		$scope.submit = function() {
			$scope.alert.clear();
			$http.post('/reset', $scope.data())
				.success(function() {
					$scope.alert.show('A password reset request has been sent by email. Check your inbox.');
					$scope.closeDialog();
					$scope.home();
				})
				.error(function(response, status) {
					if (status === 400) {
						$scope.message = 'The username and email address you entered don\'t match our records.';
					} else {
						$scope.message = 'Unable to reset your password, please try again later or contact support.';
					}
				});
			tracker.event('action', 'password reset');
		};
	}]);

	app.controller('SignUpDialogController', ['$scope', '$http', '$location', 'User', 'delay', 'tracker', function($scope, $http, $location, User, delay, tracker) {

		$scope.init = function() {
			$scope.username = '';
			$scope.password = '';
			$scope.passwordConfirmed = '';
			$scope.email = '';
			$scope.message = '';
			tracker.event('dialog', 'sign up');
		};
		$scope.data = function() {
			return {
				'username' : $scope.username,
				'password' : $scope.password,
				'email' : $scope.email
			};
		};
		$scope.submit = function() {
			$scope.alert.clear();
			$http.post('/users/', $scope.data())
				.success(function(response) {
					$scope.$parent.user = new User(response);
					$scope.closeDialog();
					delay(function() {
						$location.url('/users/' + $scope.$parent.user.name);
					});
				})
				.error(function(response, status) {
					if (status === 409) {
						$scope.message = 'The chosen username is not available.';
					} else {
						$scope.message = 'Unable to sign up, please try again later or contact support.';
					}
				});
			tracker.event('action', 'sign up');
		};
	}]);

	app.controller('UserVerificationController', ['$scope', '$http', '$location', '$routeParams', function($scope, $http, $location, $routeParams) {
		$http.post('/users/@' + $routeParams.username, { 'key' : $location.search()['key'], 'verified' : true })
			.success(function() {
				$scope.alert.show('Your email address has been verified.', 'alert-success');
				$scope.whoami();
				$location.url('/users/' + $routeParams.username);
			})
			.error(function() {
				$scope.alert.show('Your email address could not be verified.', 'alert-error');
				$location.url('/users/' + $routeParams.username);
			});
	}]);

	app.controller('PasswordResetController', ['$scope', '$http', '$location', '$routeParams', 'token', function($scope, $http, $location, $routeParams, token) {

		var username = $routeParams.username;
		var key = $location.search()['key'];
		var expires = $location.search()['expires'];

		$scope.init = function() {
			$scope.password = '';
			$scope.passwordConfirmed = '';
			$scope.message = '';
		};
		$scope.submit = function() {
			$scope.alert.clear();
			if ($scope.password !== $scope.passwordConfirmed) {
				$scope.message = 'Passwords don\'t match.';
				return;
			}
			$http.post('/users/@' + username, { 'key' : key, 'expires' : expires, 'password' : $scope.password })
				.success(function(response) {
					console.assert(response.access_token, 'missing access_token in password reset response');
					token.set(response.access_token);
					$scope.alert.show('Your password has been changed.', 'alert-success');
					$location.url('/users/' + username);
					$scope.whoami();
				})
				.error(function(response, status) {
					if (status < 500) {
						$scope.alert.show('Your password can\'t be changed.', 'alert-error');
					} else {
						$scope.alert.show('Your password could not be changed. Try again later or contact support.', 'alert-error');
					}
				});
		};

		$scope.init();
	}]);

	app.controller('OAuthController', ['$scope', '$http', '$location', '$window', 'token', function($scope, $http, $location, $window, token) {

		var getRedirectUri = function(params) {
			return [ $scope.redirectUri, $.param(params) ]
				.join(/[?#]$/.test($scope.redirectUri) ? '' : '#');
		};

		$scope.valid = function() {
			return $scope.client && $scope.redirectUri && $scope.bucket;
		};
		$scope.allow = function() {
			$scope.message = null;
			var data = $location.search();
			data.scope = $scope.bucket;
			$http.post('/oauth/authorize', data)
				.success(function(response) {
					console.assert(response.access_token, 'missing access_token in authorize response');
					console.assert(response.scope, 'missing scope in authorize response');
					$window.location = getRedirectUri(response);
				})
				.error(function(response) {
					if (response.error) {
						if (response.error == 'invalid_redirect_uri') {
							$scope.message = 'Redirect URI is not valid.';
						} else {
							$scope.deny(response.error, response.error_message);
						}
					} else {
						$scope.deny('server_error');
					}
				});
		};
		$scope.deny = function(code, message) {
			$window.location = getRedirectUri({ 'error' : code, 'error_message' : message });
		};

		$scope.client = $location.search()['client_id'];
		$scope.redirectUri = $location.search()['redirect_uri'];
		if (!$scope.client) {
			$scope.deny('invalid_request', 'client_id is missing');
		}
		if (!$scope.redirectUri) {
			$scope.message = 'Redirect URI is missing.';
		}
		if (!token.get()) {
			$scope.openDialog('sign-in-dialog');
		}

		$scope.$watch('user', function(user) {
			if (user) {
				$http.get('/users/' + $scope.user['@id'] + '/buckets/?' + $.param({ 'order' : 'label', 'offset' : 0, 'limit' : 100, 'label_only' : true }))
				.success(function(response) {
					$scope.buckets = response.buckets;
				})
				.error(function(response, status) {
					if (status < 500) {
						$scope.message = 'Can\'t list buckets.';
					} else {
						$scope.message = 'Could not list buckets. Try again later or contact support.';
					}
				});
			} else {
				$scope.bucket = null;
			}
		});
	}]);

}());
