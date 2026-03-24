(() => {
	var app = angular.module('adminModule', ['appModule']);

	app.config([
		'$routeProvider',
		($routeProvider) => {
			$routeProvider.when('/', { templateUrl: '/admin/partials/dashboard.html' });
			$routeProvider.otherwise({ templateUrl: '/partials/404.html' });
		},
	]);

	app.config([
		'$httpProvider',
		($httpProvider) => {
			$httpProvider.interceptors.push('apiBaseUrlInterceptor');
			$httpProvider.interceptors.push('progressInterceptor');
		},
	]);

	app.factory('progress', () => {
		var outstanding = 0;
		return {
			begin: (count) => {
				outstanding += count;
			},
			end: (count) => {
				outstanding -= count;
			},
			isIncomplete: () => outstanding > 0,
		};
	});

	app.factory('progressInterceptor', [
		'$q',
		'progress',
		($q, progress) => ({
			request: (config) => {
				progress.begin(1);
				return config;
			},
			requestError: (rejection) => {
				progress.end(1);
				return $q.reject(rejection);
			},
			response: (response) => {
				progress.end(1);
				return response;
			},
			responseError: (rejection) => {
				progress.end(1);
				return $q.reject(rejection);
			},
		}),
	]);

	app.controller('admin.DashboardController', [
		'$scope',
		'$location',
		'$http',
		'progress',
		($scope, $location, $http, progress) => {
			$scope.progress = progress;
			$scope.constraint = $location.search()['q'];
			$scope.setConstraint = (constraint) => {
				$scope.constraint = constraint;
				$location.search('q', $scope.constraint);
			};
			$scope.refreshAll = () => {
				$scope.$broadcast('refreshAll');
			};
			$scope.refresh = () => {
				$http
					.get('/status')
					.success((response) => {
						$scope.status = response;
					})
					.error((response) => {
						$scope.status = { nodes: '?', health: 'UNKNOWN' };
					});
			};
			$scope.setReadOnly = (readOnly) => {
				$http.post('/status', { read_only: readOnly }).then(() => {
					$scope.refresh();
				});
			};
			$scope.$on('refreshAll', () => {
				$scope.refresh();
			});
			$scope.refresh();
		},
	]);

	app.controller('admin.JournalController', [
		'$scope',
		'$http',
		'delay',
		($scope, $http, delay) => {
			$scope.offset = 0;
			$scope.limit = 10;
			$scope.total = 0;
			$scope.commands = null;
			$scope.filter = null;

			$scope.hasPrev = () => $scope.offset > 0;
			$scope.hasNext = () => $scope.offset + $scope.limit < $scope.total;
			$scope.prev = () => {
				$scope.refresh({ offset: $scope.offset - $scope.limit });
			};
			$scope.next = () => {
				$scope.refresh({ offset: $scope.offset + $scope.limit });
			};
			$scope.params = () => {
				var params = {
					offset: $scope.offset,
					limit: $scope.limit,
				};
				if ($scope.filter) {
					params.q = $scope.filter;
				}
				return params;
			};
			$scope.refresh = (params) => {
				var path = $scope.constraint ? '/users/' + $scope.constraint + '/journal/' : '/journal/';
				$http.get(path + '?' + $.param($.extend($scope.params(), params))).success((response) => {
					$.extend($scope, params);
					$scope.total = response.total;
					$scope.commands = response.commands;
				});
			};
			$scope.undo = (commandId) => {
				$scope.$parent.undo(commandId);
				delay($scope.refreshAll);
			};

			$scope.$on('refreshAll', () => {
				$scope.refresh({ offset: 0 });
			});
			$scope.$watch('filter', (to, from) => {
				if (from !== to) {
					$scope.refresh({ offset: 0 });
				}
			});
			$scope.refresh({});
		},
	]);

	app.controller('admin.BucketListController', [
		'$scope',
		'$http',
		'Bucket',
		'delay',
		'token',
		($scope, $http, Bucket, delay, token) => {
			$scope.offset = 0;
			$scope.limit = 10;
			$scope.total = 0;
			$scope.buckets = null;
			$scope.filter = null;
			$scope.events = 0;

			$scope.hasPrev = () => $scope.offset > 0;
			$scope.hasNext = () => $scope.offset + $scope.limit < $scope.total;
			$scope.prev = () => {
				$scope.refresh({ offset: $scope.offset - $scope.limit });
			};
			$scope.next = () => {
				$scope.refresh({ offset: $scope.offset + $scope.limit });
			};
			$scope.params = () => {
				var params = {
					offset: $scope.offset,
					limit: $scope.limit,
				};
				if ($scope.filter) {
					params.q = $scope.filter;
				}
				return params;
			};
			var path = (resource) => ($scope.constraint ? '/users/' + $scope.constraint + resource : resource);
			$scope.refresh = (params) => {
				$scope.token = token.get();
				$http.get(path('/buckets/') + '?' + $.param($.extend($scope.params(), params))).success((response) => {
					$.extend($scope, params);
					$scope.total = response.total;
					$scope.buckets = response.buckets;
				});
				$http.get(path('/events/')).success((response) => {
					$scope.events = response.total;
				});
			};
			$scope.remove = (bucketId) => {
				$http({ method: 'DELETE', url: '/buckets/' + bucketId }).success((response, code, headers) => {
					delay($scope.refreshAll);
				});
			};
			$scope.getOwner = (bucket) => new Bucket(bucket).getOwner();
			$scope.isPublished = (bucket) => new Bucket(bucket).isPublished();

			$scope.$on('refreshAll', () => {
				$scope.refresh({ offset: 0 });
			});
			$scope.$watch('filter', (to, from) => {
				if (from !== to) {
					$scope.refresh({ offset: 0 });
				}
			});
			$scope.refresh({});
		},
	]);

	app.controller('admin.UserListController', [
		'$scope',
		'$http',
		'$q',
		'delay',
		'token',
		($scope, $http, $q, delay, token) => {
			$scope.offset = 0;
			$scope.limit = 10;
			$scope.total = 0;
			$scope.users = null;
			$scope.filter = null;

			$scope.hasPrev = () => $scope.offset > 0;
			$scope.hasNext = () => $scope.offset + $scope.limit < $scope.total;
			$scope.prev = () => {
				$scope.refresh({ offset: $scope.offset - $scope.limit });
			};
			$scope.next = () => {
				$scope.refresh({ offset: $scope.offset + $scope.limit });
			};
			$scope.params = () => {
				var params = {
					offset: $scope.offset,
					limit: $scope.limit,
				};
				if ($scope.filter) {
					params.q = $scope.filter;
				}
				return params;
			};
			$scope.refresh = (params) => {
				$scope.token = token.get();
				if ($scope.constraint) {
					$http.get('/users/' + $scope.constraint).success((response) => {
						if (response.name) {
							$scope.total = 1;
							$scope.users = [response];
						} else {
							$scope.total = 0;
							$scope.users = [];
						}
					});
				} else {
					$http.get('/users/?' + $.param($.extend($scope.params(), params))).success((response) => {
						$.extend($scope, params);
						$scope.total = response.total;
						$scope.users = response.users;
					});
				}
			};
			$scope.suspend = (username) => {
				$http.post('/users/@' + username, { suspended: true }).success(() => {
					delay($scope.refreshAll);
				});
			};
			$scope.reverify = (user) => {
				$http.post('/users/@' + user.name, { email: user.email }).success(() => {
					delay($scope.refreshAll);
				});
			};
			$scope.optout = (user) => {
				$http.post('/users/@' + user.name, { optedout: true }).success(() => {
					delay($scope.refreshAll);
				});
			};
			$scope.optin = (user) => {
				$http.post('/users/@' + user.name, { optedout: false }).success(() => {
					delay($scope.refreshAll);
				});
			};
			$scope.remove = (username) => {
				$http({ method: 'DELETE', url: '/users/@' + username }).success(() => {
					delay($scope.refreshAll);
				});
			};

			$scope.$on('refreshAll', () => {
				$scope.refresh({ offset: 0 });
			});
			$scope.$watch('filter', (to, from) => {
				if (from !== to) {
					$scope.refresh({ offset: 0 });
				}
			});
			$scope.refresh({});
		},
	]);

	app.controller('admin.EditQuotaDialogController', [
		'$scope',
		'$http',
		'$q',
		'delay',
		($scope, $http, $q, delay) => {
			$scope.init = (user) => {
				$scope.user = user;
				$scope.message = '';
				$scope.limit = null;
				$scope.used = null;
				$scope.usedOld = null;
				$scope.usedNew = null;
				$http.get('/users/@' + $scope.user.name + '/quota').success((response) => {
					$scope.limit = response.limit;
					$scope.usedOld = response.used;
					$scope.usedNew = response.used;
				});
			};
			$scope.save = () => {
				$scope.message = '';
				var updates = $q.when(null);
				if ($scope.limit !== $scope.user.quota) {
					updates = updates.then(
						() => $http.post('/users/@' + $scope.user.name, { quota: $.isNumeric($scope.limit) ? $scope.limit : null }),
						() => $q.reject(),
					);
				}
				if ($scope.usedNew !== $scope.usedOld) {
					updates = updates.then(
						() => $http.post('/users/@' + $scope.user.name + '/quota', { cost: $scope.usedNew - $scope.usedOld }),
						() => $q.reject(),
					);
				}
				updates.then(
					(response) => {
						$scope.closeDialog();
						delay($scope.refreshAll);
					},
					(e) => {
						$scope.message = "Couldn't update quota used/limit.";
					},
				);
			};
		},
	]);

	app.controller('admin.AuthorizationListController', [
		'$scope',
		'$http',
		'delay',
		($scope, $http, delay) => {
			$scope.offset = 0;
			$scope.limit = 10;
			$scope.total = 0;
			$scope.authorizations = null;
			$scope.filter = null;

			$scope.hasPrev = () => $scope.offset > 0;
			$scope.hasNext = () => $scope.offset + $scope.limit < $scope.total;
			$scope.prev = () => {
				$scope.refresh({ offset: $scope.offset - $scope.limit });
			};
			$scope.next = () => {
				$scope.refresh({ offset: $scope.offset + $scope.limit });
			};
			$scope.params = () => {
				var params = {
					offset: $scope.offset,
					limit: $scope.limit,
				};
				if ($scope.filter) {
					params.q = $scope.filter;
				}
				return params;
			};
			$scope.refresh = (params) => {
				var path = $scope.constraint ? '/users/' + $scope.constraint + '/authorizations/' : '/authorizations/';
				$http.get(path + '?' + $.param($.extend($scope.params(), params))).success((response) => {
					$.extend($scope, params);
					$scope.total = response.total;
					$scope.authorizations = response.authorizations;
				});
			};
			$scope.remove = (authId) => {
				$http({ method: 'DELETE', url: '/authorizations/' + authId }).success((response, code, headers) => {
					delay($scope.refreshAll);
				});
			};

			$scope.$on('refreshAll', () => {
				$scope.refresh({ offset: 0 });
			});
			$scope.$watch('filter', (to, from) => {
				if (from !== to) {
					$scope.refresh({ offset: 0 });
				}
			});
			$scope.refresh({});
		},
	]);

	app.controller('admin.CredentialsListController', [
		'$scope',
		'$http',
		'delay',
		($scope, $http, delay) => {
			$scope.offset = 0;
			$scope.limit = 10;
			$scope.total = 0;
			$scope.credentials = null;
			$scope.filter = null;

			$scope.hasPrev = () => $scope.offset > 0;
			$scope.hasNext = () => $scope.offset + $scope.limit < $scope.total;
			$scope.prev = () => {
				$scope.refresh({ offset: $scope.offset - $scope.limit });
			};
			$scope.next = () => {
				$scope.refresh({ offset: $scope.offset + $scope.limit });
			};
			$scope.params = () => {
				var params = {
					offset: $scope.offset,
					limit: $scope.limit,
				};
				if ($scope.filter) {
					params.q = $scope.filter;
				}
				return params;
			};
			$scope.refresh = (params) => {
				var path = $scope.constraint ? '/users/' + $scope.constraint + '/credentials/' : '/credentials/';
				$http.get(path + '?' + $.param($.extend($scope.params(), params))).success((response) => {
					$.extend($scope, params);
					$scope.total = response.total;
					$scope.credentials = response.items;
				});
			};
			$scope.remove = (credentialsId) => {
				$http({ method: 'DELETE', url: '/credentials/' + credentialsId }).success((response, code, headers) => {
					delay($scope.refreshAll);
				});
			};

			$scope.$on('refreshAll', () => {
				$scope.refresh({ offset: 0 });
			});
			$scope.$watch('filter', (to, from) => {
				if (from !== to) {
					$scope.refresh({ offset: 0 });
				}
			});
			$scope.refresh({});
		},
	]);

	app.controller('admin.TaskListController', [
		'$scope',
		'$http',
		'delay',
		'taskRunner',
		($scope, $http, delay, taskRunner) => {
			$scope.offset = 0;
			$scope.limit = 10;
			$scope.total = 0;
			$scope.tasks = null;
			$scope.running = {};
			$scope.filter = null;

			$scope.hasPrev = () => $scope.offset > 0;
			$scope.hasNext = () => $scope.offset + $scope.limit < $scope.total;
			$scope.prev = () => {
				$scope.refresh({ offset: $scope.offset - $scope.limit });
			};
			$scope.next = () => {
				$scope.refresh({ offset: $scope.offset + $scope.limit });
			};
			$scope.params = () => {
				var params = {
					offset: $scope.offset,
					limit: $scope.limit,
				};
				if ($scope.filter) {
					params.q = $scope.filter;
				}
				return params;
			};
			$scope.refresh = (params) => {
				var path = $scope.constraint ? '/users/' + $scope.constraint + '/tasks/' : '/tasks/';
				$http.get(path + '?' + $.param($.extend($scope.params(), params))).success((response) => {
					$.extend($scope, params);
					$scope.total = response.total;
					$scope.tasks = response.tasks;
				});
			};
			$scope.run = (taskId) => {
				$scope.running[taskId] = true;
				$scope.alert.clear();
				taskRunner.runOne($scope, taskId)['finally'](() => {
					delay(() => {
						$scope.refresh({});
					});
					delete $scope.running[taskId];
				});
			};
			$scope.remove = (taskId) => {
				$http({ method: 'DELETE', url: '/tasks/' + taskId }).success((response, code, headers) => {
					delay($scope.refreshAll);
				});
			};

			$scope.$on('refreshAll', () => {
				$scope.refresh({ offset: 0 });
			});
			$scope.$watch('filter', (to, from) => {
				if (from !== to) {
					$scope.refresh({ offset: 0 });
				}
			});
			$scope.refresh({});
		},
	]);

	app.controller('admin.SnapshotController', [
		'$scope',
		'$http',
		'delay',
		($scope, $http, delay) => {
			$scope.offset = 0;
			$scope.limit = 10;
			$scope.total = 0;
			$scope.snapshots = null;
			$scope.snapshotting = false;

			$scope.hasPrev = () => $scope.offset > 0;
			$scope.hasNext = () => $scope.offset + $scope.limit < $scope.total;
			$scope.prev = () => {
				$scope.refresh({ offset: $scope.offset - $scope.limit });
			};
			$scope.next = () => {
				$scope.refresh({ offset: $scope.offset + $scope.limit });
			};
			$scope.params = () => ({
				offset: $scope.offset,
				limit: $scope.limit,
			});
			$scope.refresh = (params) => {
				$http.get('/snapshots/?' + $.param($.extend($scope.params(), params))).success((response) => {
					$.extend($scope, params);
					$scope.total = response.total;
					$scope.snapshots = response.snapshots;
				});
			};
			$scope.remove = (snapshotId) => {
				$http({ method: 'DELETE', url: '/snapshots/' + snapshotId }).success((response, code, headers) => {
					delay(() => {
						$scope.refresh({ offset: 0 });
					});
				});
			};
			$scope.snapshot = () => {
				$scope.snapshotting = true;
				$http({ method: 'POST', url: '/snapshots/' }).then(() => {
					delay(() => {
						$scope.snapshotting = false;
						$scope.refresh();
					});
				});
			};

			$scope.$on('refreshAll', () => {
				$scope.refresh({ offset: 0 });
			});
			$scope.refresh({});
		},
	]);

	app.controller('admin.SchedulerController', [
		'$scope',
		'$http',
		'delay',
		($scope, $http, delay) => {
			$scope.jobs = null;
			$scope.paused = false;

			$scope.refresh = () => {
				$http.get('/jobs/').success((response) => {
					$scope.jobs = response.jobs;
				});
			};
			$scope.disable = (disabled) => {
				$http.post('/status', { scheduler_disabled: disabled }).success((response, code, headers) => {
					delay(() => {
						$scope.reload();
					});
				});
			};

			$scope.$on('refreshAll', () => {
				$scope.refresh();
			});
			$scope.refresh();
		},
	]);
})();
