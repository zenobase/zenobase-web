(() => {
	var app = angular.module('appModule');

	app.controller('BucketListController', [
		'$scope',
		'$http',
		'delay',
		'taskRunner',
		'tracker',
		($scope, $http, delay, taskRunner, tracker) => {
			$scope.offset = 0;
			$scope.limit = 10;
			$scope.total = 0;
			$scope.buckets = null;
			$scope.include_archived = false;

			$scope.hasPrev = () => $scope.offset > 0;
			$scope.hasNext = () => $scope.offset + $scope.limit < $scope.total;
			$scope.prev = () => {
				$scope.refresh({ offset: $scope.offset - $scope.limit });
			};
			$scope.next = () => {
				$scope.refresh({ offset: $scope.offset + $scope.limit });
			};
			$scope.includeArchived = (includeArchived) => {
				$scope.refresh({ include_archived: includeArchived });
			};
			$scope.params = () => ({
				order: 'label',
				offset: $scope.offset,
				limit: $scope.limit,
				include_archived: $scope.include_archived,
			});
			$scope.refresh = (params) => {
				$http.get('/users/' + $scope.profile['@id'] + '/buckets/?' + param(Object.assign($scope.params(), params))).success((response) => {
					Object.assign($scope, params);
					if (response.total === 0 && !$scope.include_archived) {
						$scope.refresh({ include_archived: true });
					} else {
						$scope.total = response.total;
						$scope.buckets = response.buckets;
					}
				});
			};
			$scope.loading = {};
			$scope.run = (bucketId) => {
				$scope.loading[bucketId] = true;
				$scope.alert.clear();
				taskRunner
					.runAll($scope, bucketId)
					.then(() => {
						delay($scope.refresh);
					})
					['finally'](() => {
						delete $scope.loading[bucketId];
					});
				tracker.event('action', 'run tasks');
			};

			$scope.$watch('profile', (profile) => {
				if ($scope.isSelf() && profile) {
					$scope.refresh({});
				}
			});
			$scope.$on('reload', $scope.refresh);
		},
	]);

	app.controller('CredentialsListController', [
		'$scope',
		'$http',
		'tracker',
		'delay',
		($scope, $http, tracker, delay) => {
			$scope.offset = 0;
			$scope.limit = 10;
			$scope.total = 0;
			$scope.credentials = null;

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
					.get('/users/' + $scope.profile['@id'] + '/credentials/?' + param(Object.assign($scope.params(), params)))
					.success((response) => {
						Object.assign($scope, params);
						$scope.total = response.total;
						$scope.credentials = response.items;
					})
					.error((response, status) => {
						if (status < 500) {
							$scope.message = "Can't retrieve any credentials.";
						} else {
							$scope.message = "Couldn't retrieve any credentials. Try again later or contact support.";
						}
					});
			};
			$scope.remove = (credentialsId) => {
				$scope.alert.clear();
				$http({ method: 'DELETE', url: '/credentials/' + credentialsId })
					.success((response, status, headers) => {
						$scope.alert.show('Deleted credentials.', 'alert-success', headers('X-Command-ID'));
						$scope.offset = 0;
						delay($scope.refresh);
					})
					.error((response, status) => {
						if (status < 500) {
							$scope.message = "Can't delete credentials.";
						} else {
							$scope.message = "Couldn't delete credentials. Try again later or contact support.";
						}
					});
				tracker.event('action', 'delete credentials');
			};

			$scope.$watch('profile', (profile) => {
				if ($scope.isSelf() && profile) {
					$scope.refresh({});
				}
			});
			$scope.$on('reload', $scope.refresh);
		},
	]);

	app.controller('AuthorizationListController', [
		'$scope',
		'$http',
		'delay',
		($scope, $http, delay) => {
			$scope.offset = 0;
			$scope.limit = 10;
			$scope.total = 0;
			$scope.authorizations = null;

			$scope.hasPrev = () => $scope.offset > 0;
			$scope.hasNext = () => $scope.offset + $scope.limit < $scope.total;
			$scope.prev = () => {
				$scope.refresh({ offset: $scope.offset - $scope.limit });
			};
			$scope.next = () => {
				$scope.refresh({ offset: $scope.offset + $scope.limit });
			};
			$scope.params = () => ({
				has_client: true,
				offset: $scope.offset,
				limit: $scope.limit,
			});
			$scope.refresh = (params) => {
				$http.get('/users/' + $scope.profile['@id'] + '/authorizations/?' + param(Object.assign($scope.params(), params))).success((response) => {
					Object.assign($scope, params);
					$scope.total = response.total;
					$scope.authorizations = response.authorizations;
				});
			};
			$scope.remove = (authId) => {
				$http({ method: 'DELETE', url: '/authorizations/' + authId })
					.success((response, status, headers) => {
						$scope.alert.show('Revoked an authorization.', 'alert-success', headers('X-Command-ID'));
						$scope.offset = 0;
						delay($scope.refresh);
					})
					.error((response, status) => {
						if (status < 500) {
							$scope.alert.show("Can't revoke the authorization.", 'alert-error');
						} else {
							$scope.alert.show("Couldn't revoke the authorization. Try again later or contact support.", 'alert-error');
						}
					});
			};

			$scope.$watch('profile', (profile) => {
				if ($scope.isSelf() && profile) {
					$scope.refresh({});
				}
			});
			$scope.$on('reload', $scope.refresh);
		},
	]);

	app.controller('HomeController', [
		'$scope',
		'$http',
		'$location',
		'$timeout',
		'token',
		'tracker',
		($scope, $http, $location, $timeout, token, tracker) => {
			$scope.start = () => {
				$scope.alert.clear();
				$http({ method: 'POST', url: '/oauth/token', data: 'grant_type=client_credentials', headers: { 'Content-Type': 'application/x-www-form-urlencoded' } })
					.success((response) => {
						console.assert(response.access_token, 'missing access_token in getting started response');
						token.set(response.access_token);
						$scope.whoami((user) => {
							$location.path('/users/' + user.getName());
							$timeout(() => {
								$scope.openDialog('create-bucket-dialog');
							}, 1000);
						});
					})
					.error((response, status) => {
						if (status < 500) {
							$scope.alert.show("Can't create a guest account.", 'alert-error');
						} else {
							$scope.alert.show("Couldn't create a guest account. Try again later or contact support.", 'alert-error');
						}
					});
				tracker.event('action', 'get started');
			};
		},
	]);

	app.controller('CreateBucketDialogController', [
		'$scope',
		'$http',
		'$location',
		'$timeout',
		'tracker',
		($scope, $http, $location, $timeout, tracker) => {
			$scope.init = () => {
				$scope.label = 'My Data';
				$scope.message = '';
				$scope.source = null;
				$scope.category = null;
				$scope.template = null;
				$http.get('/dashboard/templates.json').success((response) => {
					$scope.templates = response;
				});
				tracker.event('dialog', 'create bucket');
			};
			$scope.sources = () => {
				var sources = [];
				if ($scope.templates) {
					$scope.templates.forEach((template) => {
						if (!$scope.category || $scope.category === template.category) {
							if (sources.indexOf(template.source) === -1) {
								console.assert(template.source, template);
								sources.push(template.source);
							}
						}
					});
				}
				return sources.sort((a, b) => a.localeCompare(b));
			};
			$scope.categories = () => {
				var categories = [];
				if ($scope.templates) {
					$scope.templates.forEach((template) => {
						if (!$scope.source || $scope.source === template.source) {
							if (categories.indexOf(template.category) === -1) {
								console.assert(template.category, template);
								categories.push(template.category);
							}
						}
					});
				}
				return categories.sort();
			};
			$scope.valid = () => ($scope.source && $scope.category) || (!$scope.source && !$scope.category);
			$scope.validLabel = () => $scope.label && $scope.label.length > 0;
			$scope.create = () => {
				$scope.alert.clear();
				$http
					.post('/buckets/', { label: $scope.label, widgets: $scope.template ? $scope.template.widgets : [] })
					.success((response, status, headers) => {
						var location = headers('Location');
						console.assert(status === 201, status);
						console.assert(location, 'missing location header');
						$scope.closeDialog();
						$location.url(location);
						if ($scope.template) {
							if ($scope.template.task) {
								$timeout(() => {
									$scope.openDialog('create-task-dialog', $scope.template.task);
								}, 500);
							} else if ($scope.template.importer) {
								$timeout(() => {
									$scope.openDialog('import-dialog', $scope.template.importer);
								}, 500);
							}
						}
					})
					.error((response, status) => {
						if (status === 400) {
							$scope.message = "Can't create bucket.";
						} else {
							$scope.message = "Couldn't create bucket. Please try agan later or contact support.";
						}
					});
				tracker.event('action', 'create bucket', $scope.template ? $scope.template.label : undefined);
			};

			var setTemplate = () => {
				if ($scope.templates) {
					if ($scope.source && $scope.category) {
						$scope.template = $scope.templates.find((template) => template.source === $scope.source && template.category === $scope.category) || null;
					} else {
						$scope.template = null;
					}
				}
			};
			$scope.$watch('source', setTemplate);
			$scope.$watch('category', setTemplate);
		},
	]);

	app.controller('CreateViewDialogController', [
		'$scope',
		'$http',
		'$location',
		'$timeout',
		'tracker',
		($scope, $http, $location, $timeout, tracker) => {
			$scope.init = () => {
				$scope.label = 'My View';
				$scope.message = '';
				$scope.buckets = [];
				$scope.aliases = [];
				$scope.selected = null;
				$scope.filter = null;
				$http.get('/users/' + $scope.profile['@id'] + '/buckets/?' + param({ order: 'label', offset: 0, limit: 100, labels_only: true })).success((response) => {
					$scope.buckets = response.buckets;
				});
				tracker.event('dialog', 'create view');
			};
			$scope.valid = () => $scope.aliases.length > 0;
			$scope.create = () => {
				$scope.alert.clear();
				var aliases = $scope.aliases.map((alias) => ({ '@id': alias['@id'], filter: alias.filter }));
				$http
					.post('/buckets/', { label: $scope.label, aliases: aliases })
					.success((response, status, headers) => {
						var location = headers('Location');
						console.assert(status === 201, status);
						console.assert(location, 'missing location header');
						$scope.closeDialog();
						$location.url(location);
					})
					.error((response, status) => {
						if (status === 400) {
							$scope.message = "Can't create view.";
						} else {
							$scope.message = "Couldn't create view. Please try agan later or contact support.";
						}
					});
				tracker.event('action', 'create view');
			};
			$scope.listBuckets = () => {
				if ($scope.buckets) {
					return $scope.buckets.filter((bucket) => !bucket.aliases && !$scope.aliases.some((alias) => alias['@id'] === bucket['@id']));
				}
			};
			$scope.addBucket = () => {
				var alias = angular.copy($scope.selected);
				if ($scope.filter) {
					alias.filter = $scope.filter;
				}
				$scope.aliases.push(alias);
				$scope.selected = null;
				$scope.filter = null;
			};
			$scope.removeBucket = (bucket) => {
				$scope.aliases = $scope.aliases.filter((alias) => alias['@id'] !== bucket['@id']);
			};
		},
	]);

	app.controller('AddWidgetController', [
		'$scope',
		'$http',
		'$route',
		'$routeParams',
		'$location',
		'$timeout',
		'random',
		($scope, $http, $route, $routeParams, $location, $timeout, random) => {
			$scope.dialog = $('#add-widget-dialog');
			$scope.templates = [
				{
					type: 'timeline',
					label: 'Timeline',
					description: 'Plots values on a timeline.',
					thumbnail: '/img/widgets/timeline.png',
					settings: { field: 'timestamp', statistic: 'count' },
				},
				{
					type: 'list',
					label: 'List',
					description: 'Shows all matching events, pageable.',
					thumbnail: '/img/widgets/list.png',
					settings: { limit: 10, order: '-timestamp' },
					singleton: true,
				},
				{
					type: 'count',
					label: 'Count',
					description: 'Counts events by tag or author.',
					thumbnail: '/img/widgets/count.png',
					settings: { field: 'tag', order: '-count', limit: 5 },
				},
				{
					type: 'map',
					label: 'Map',
					description: 'Shows clusters of events on a map.',
					thumbnail: '/img/widgets/map.png',
					settings: {},
				},
				{
					type: 'heatmap',
					label: 'Map',
					description: 'Shows the density of events on a map.',
					thumbnail: '/img/widgets/heatmap.png',
					settings: {},
				},
				{
					type: 'ratings',
					label: 'Ratings',
					description: 'Counts events by their rating.',
					thumbnail: '/img/widgets/ratings.png',
					settings: {},
				},
				{
					type: 'histogram',
					label: 'Histogram',
					description: 'Shows the distribution of values in a field.',
					thumbnail: '/img/widgets/histogram.png',
					settings: { field: 'distance', interval: 10, unit: 'mi' },
				},
				{
					type: 'scoreboard',
					label: 'Scoreboard',
					description: 'Statistics for the values in a field.',
					thumbnail: '/img/widgets/scoreboard.png',
					settings: { key_field: 'author', value_field: 'distance', unit: 'mi', order: '-sum', limit: 10 },
				},
				{
					type: 'gantt',
					label: 'Frequency',
					description: 'Shows how long ago and how often certain events occur.',
					thumbnail: '/img/widgets/gantt.png',
					settings: { field: 'tag', order: '-max', limit: 10 },
				},
				{
					type: 'polar',
					label: 'Polar Chart',
					description: 'Plots values by month of year, day of week, or hour of day.',
					thumbnail: '/img/widgets/polar.png',
					settings: { interval: 'day_of_week', value_field: 'timestamp' },
				},
				{
					type: 'scatterplot',
					label: 'Scatter Plot',
					description: 'Correlates values from two fields.',
					thumbnail: '/img/widgets/scatterplot.png',
					settings: { field_x: 'count', field_y: 'count' },
				},
				{
					type: 'sonification',
					label: 'Sonify',
					description: 'Plays data from timeline widgets as sounds.',
					thumbnail: '/img/widgets/sonification.png',
					settings: { tempo: 176, scale: 'chromatic' },
					singleton: true,
				},
			];
			$scope.init = (placement) => {
				$scope.placement = placement;
			};
			$scope.add = (template) => {
				var settings = {
					id: random.id(),
					type: template.type,
					label: template.label,
					placement: $scope.placement,
				};
				deepExtend(settings, template.settings);
				$scope.addWidget(settings);
				$timeout(() => {
					$('#' + settings.id + '-tab').tab('show');
					$scope.openDialog(settings.id + '-dialog');
					$scope.setDirty(true);
				}, 500);
			};
			$scope.findTemplates = () => $scope.templates.filter((template) => !template.singleton || !$scope.exists(template));
			$scope.exists = (template) => $scope.bucket?.widgets.some((widget) => widget.type === template.type);
		},
	]);
})();
