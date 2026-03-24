(() => {
	var app = angular.module('appModule');

	app.factory('taskRunner', [
		'$http',
		'$q',
		'$window',
		'localStorage',
		($http, $q, $window, localStorage) => {
			var runAll = ($scope, bucketId) =>
				$http.get('/buckets/' + bucketId + '/tasks/').then((response) => {
					var previous = $q.when(null); // run tasks sequentially
					response.data.tasks.forEach((task) => {
						previous = previous.then(
							() => runOne($scope, task['@id']),
							() => $q.reject(),
						);
					});
					return previous;
				});

			var runOne = ($scope, taskId) =>
				$http.get('/tasks/' + taskId).then(
					(response) => {
						if (response.headers('X-Credentials')) {
							return newCredentials($scope, response.headers('X-Credentials'));
						} else if (response.headers('Link')) {
							var match = response.headers('Link').match(/<(.+?)>/);
							console.assert(match, 'Invalid Link header: ' + response.headers('Link'));
							authorize($scope, null, response.data.type, match[1]);
							return $q.reject();
						}
					},
					(response) => {
						if (response.status === 403) {
							$scope.alert.show("Couldn't refresh a task. Insufficient quota?", 'alert-error');
						} else if (response.status < 500) {
							$scope.alert.show("Couldn't refresh a task.", 'alert-error');
						} else {
							$scope.alert.show("Couldn't refresh a task. Try again later or contact support.", 'alert-error');
						}
						return $q.reject();
					},
				);

			var newCredentials = ($scope, type) =>
				$http.post('/credentials/', { type: type }).then(
					(response) => {
						console.assert(response.status === 201, response.status);
						if (response.data.authorizationUrl) {
							authorize($scope, response.data['@id'], type, response.data.authorizationUrl);
						}
						return $q.reject();
					},
					(response) => {
						if (response.status === 400) {
							$scope.alert.show("Can't create credentials: " + response.data.message, 'alert-error');
						} else {
							$scope.alert.show("Couldn't create credentials. Please try again later or contact support.", 'alert-error');
						}
						return $q.reject();
					},
				);

			var authorize = ($scope, credentialsId, type, url) => {
				$scope.alert.show('<b>' + type + '</b> requires authorization', '', '', () => {
					if (credentialsId && url.indexOf(credentialsId) === -1) {
						localStorage.setItem('credentials', credentialsId);
					}
					$window.open(url);
				});
			};

			return {
				runAll: runAll,
				runOne: runOne,
			};
		},
	]);

	app.controller('TaskListDialogController', [
		'$scope',
		'$http',
		'tracker',
		'delay',
		($scope, $http, tracker, delay) => {
			$scope.init = () => {
				$scope.message = '';
				$scope.offset = 0;
				$scope.limit = 10;
				$scope.total = 0;
				$scope.tasks = null;
				$scope.refresh();
				tracker.event('dialog', 'list tasks');
			};

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
				$http
					.get('/buckets/' + $scope.$parent.bucketId + '/tasks/?' + param(Object.assign($scope.params(), params)))
					.success((response) => {
						Object.assign($scope, params);
						$scope.total = response.total;
						$scope.tasks = response.tasks;
					})
					.error((response, status) => {
						if (status < 500) {
							$scope.message = "Can't retrieve any tasks.";
						} else {
							$scope.message = "Couldn't retrieve any tasks. Try again later or contact support.";
						}
					});
			};
			$scope.remove = (taskId) => {
				$scope.message = '';
				$http({ method: 'DELETE', url: '/tasks/' + taskId })
					.success(() => {
						delay($scope.refresh);
					})
					.error((response, status) => {
						if (status < 500) {
							$scope.message = "Can't delete the task.";
						} else {
							$scope.message = "Couldn't delete the task. Try again later or contact support.";
						}
					});
				tracker.event('action', 'delete task');
			};
			$scope.formatTooltip = (task) => {
				if (task.settings) {
					var tooltip = '';
					Object.entries(task.settings).forEach(([field, value]) => {
						if (tooltip) {
							tooltip += '\n';
						}
						tooltip += field + ': ' + value;
					});
					return tooltip;
				} else {
					return '(no settings)';
				}
			};
		},
	]);

	app.controller('CreateTaskDialogController', [
		'$scope',
		'$http',
		'delay',
		'tracker',
		($scope, $http, delay, tracker) => {
			$scope.types = [
				{ id: 'beeminder', description: 'Updates a goal with event counts or value totals for each day.', url: 'https://www.beeminder.com/' },
				{ id: 'fitbark', description: 'Creates an event for the activity level for every day or hour.', url: 'https://www.fitbark.com/' },
				{ id: 'fitbit-activities', description: 'Creates an event for each activity.', url: 'https://www.fitbit.com/' },
				{ id: 'fitbit-burn', description: 'Creates an event for the number of calories burned each day or hour.', url: 'https://www.fitbit.com/' },
				{ id: 'fitbit-cardio', description: 'Creates an event for the daily resting heart rate, or the average hourly heart rate.', url: 'https://www.fitbit.com/' },
				{ id: 'fitbit-food', description: 'Creates an event for the number of calories consumed each day.', url: 'https://www.fitbit.com/' },
				{ id: 'fitbit-sleep', description: 'Creates an event for each period of sleep.', url: 'https://www.fitbit.com/' },
				{ id: 'fitbit-steps', description: 'Creates an event for the number of steps each day or hour.', url: 'https://www.fitbit.com/' },
				{ id: 'fitbit-weight', description: 'Creates an event for the body weight each day.', url: 'https://www.fitbit.com/' },
				{ id: 'foursquare', description: 'Creates an event for each place visited.', url: 'https://foursquare.com/' },
				{ id: 'goodreads', description: 'Creates an event for each book read.', url: 'https://www.goodreads.com/' },
				{ id: 'google-activities', description: 'Creates an event for each activity.', url: 'https://fit.google.com/' },
				{ id: 'google-cardio', description: 'Creates an event for each heart rate measurement.', url: 'https://fit.google.com/' },
				{ id: 'google-food', description: 'Creates an event for each number of calories consumed that was recorded.', url: 'https://fit.google.com/' },
				{ id: 'google-weight', description: 'Creates an event for each body weight measurement.', url: 'https://fit.google.com/' },
				{ id: 'hexoskin-activities', description: 'Creates an event for each activity.', url: 'https://www.hexoskin.com/' },
				{ id: 'hexoskin-sleep', description: 'Creates an event for each period of sleep.', url: 'https://www.hexoskin.com/' },
				{ id: 'ihealth-activities', description: 'Creates an event for each activity.', url: 'https://ihealthlabs.com/' },
				{ id: 'ihealth-cardio', description: 'Creates an event for each heart rate or blood pressure measurement.', url: 'https://ihealthlabs.com/' },
				{ id: 'ihealth-food', description: 'Creates an event for each meal.', url: 'https://ihealthlabs.com/' },
				{ id: 'ihealth-glucose', description: 'Creates an event for each glucose measurement.', url: 'https://ihealthlabs.com/' },
				{ id: 'ihealth-sleep', description: 'Creates an event for each period of sleep.', url: 'https://ihealthlabs.com/' },
				{ id: 'ihealth-steps', description: 'Creates an event for the number of steps logged.', url: 'https://ihealthlabs.com/' },
				{ id: 'ihealth-weight', description: 'Creates an event for each body weight measurement.', url: 'https://ihealthlabs.com/' },
				{ id: 'lastfm-tracks', description: 'Creates an event for each track played.', url: 'https://www.last.fm/' },
				{ id: 'mapmyfitness-activities', description: 'Creates an event for each activity.', url: 'https://www.mapmyfitness.com/' },
				{ id: 'mapmyfitness-sleep', description: 'Creates an event for each period of sleep.', url: 'https://www.mapmyfitness.com/' },
				{ id: 'mapmyfitness-weight', description: 'Creates an event for each body weight measurement.', url: 'https://www.mapmyfitness.com/' },
				{ id: 'netatmo', description: 'Creates events for weather station measurements.', url: 'https://www.netatmo.com/' },
				{ id: 'oura-steps', description: 'Creates an event for the number of steps and calories burned each day.', url: 'https://ouraring.com/' },
				{ id: 'oura-sleep', description: 'Creates an event for each period of sleep.', url: 'https://ouraring.com/' },
				{ id: 'oura-readiness', description: 'Creates an event for the readiness score for each day.', url: 'https://ouraring.com/' },
				{ id: 'reporter-questions', description: 'Creates an event for each question answered.', url: 'http://www.reporter-app.com/' },
				{ id: 'rescuetime-productivity', description: 'Creates an event for every hour the computer was used.', url: 'https://www.rescuetime.com/' },
				{ id: 'runkeeper-activities', description: 'Creates an event for each activity.', url: 'https://runkeeper.com/' },
				{ id: 'runkeeper-weight', description: 'Creates an event for each body weight measurement.', url: 'https://runkeeper.com/' },
				{ id: 'sleepcloud', description: 'Creates an event for each period of sleep.', url: 'https://sites.google.com/site/sleepasandroid/sleepcloud' },
				{ id: 'strava-activities', description: 'Creates an event for each activity.', url: 'https://www.strava.com/' },
				{ id: 'trakt', description: 'Creates an event for each movie or episode watched.', url: 'https://trakt.tv/' },
				{ id: 'wakatime', description: 'Creates an event for every period of time logged for a project.', url: 'https://wakatime.com/' },
				{ id: 'withings-cardio', description: 'Creates an event for each heart rate or blood pressure measurement.', url: 'https://www.withings.com/' },
				{ id: 'withings-sleep', description: 'Creates an event for each period of sleep.', url: 'https://www.withings.com/' },
				{ id: 'withings-steps', description: 'Creates an event for the number of steps each day.', url: 'https://www.withings.com/' },
				{ id: 'withings-weight', description: 'Creates an event for each body weight measurement.', url: 'https://www.withings.com/' },
				{ id: 'withings-temperature', description: 'Creates an event for each body temperature measurement.', url: 'https://www.withings.com/' },
				// { id : 'demo', description : 'Creates a single event each time this task is run.' }
			];

			function selectType(id) {
				if (id) {
					var found = $scope.types.find((type) => type.id === id);
					if (found) {
						$scope.type = found;
					}
				} else {
					$scope.type = $scope.types[0];
				}
			}
			$scope.init = (type) => {
				$scope.message = '';
				selectType(type);
				tracker.event('dialog', 'create task');
			};
			$scope.getTemplate = (type) => (type ? '/' + type.id + '-settings.html' : null);
			$scope.data = () => ({
				type: $scope.type.id,
				bucket: $scope.bucketId,
				settings: $scope.settings,
			});
			$scope.create = () => {
				$scope.alert.clear();
				$http
					.post('/tasks/', $scope.data())
					.success((response, status) => {
						console.assert(status === 201, status);
						$scope.closeDialog();
						delay($scope.$parent.run);
					})
					.error(() => {
						$scope.message = "Couldn't create task. Try again later or contact support.";
					});
				tracker.event('action', 'create task');
			};
		},
	]);
})();
