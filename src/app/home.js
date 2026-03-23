(function() {

	'use strict';

	var app = angular.module('appModule');

	app.controller('BucketListController', ['$scope', '$http', 'delay', 'taskRunner', 'tracker', function($scope, $http, delay, taskRunner, tracker) {

		$scope.offset = 0;
		$scope.limit = 10;
		$scope.total = 0;
		$scope.buckets = null;
		$scope.include_archived = false;

		$scope.hasPrev = function() {
			return $scope.offset > 0;
		};
		$scope.hasNext = function() {
			return $scope.offset + $scope.limit < $scope.total;
		};
		$scope.prev = function() {
			$scope.refresh({ offset : $scope.offset - $scope.limit });
		};
		$scope.next = function() {
			$scope.refresh({ offset : $scope.offset + $scope.limit });
		};
		$scope.includeArchived = function(includeArchived) {
			$scope.refresh({ include_archived : includeArchived });
		};
		$scope.params = function() {
			return {
				order : 'label',
				offset : $scope.offset,
				limit : $scope.limit,
				include_archived : $scope.include_archived
			};
		};
		$scope.refresh = function(params) {
			$http.get('/users/' + $scope.profile['@id'] + '/buckets/?' + $.param($.extend($scope.params(), params)))
				.success(function(response) {
					$.extend($scope, params);
					if (response.total === 0 && !$scope.include_archived) {
						$scope.refresh({ include_archived : true });
					} else {
						$scope.total = response.total;
						$scope.buckets = response.buckets;
					}
				});
		};
		$scope.loading = {};
		$scope.run = function(bucketId) {
			$scope.loading[bucketId] = true;
			$scope.alert.clear();
			taskRunner.runAll($scope, bucketId).then(function() {
				delay($scope.refresh);
			})['finally'](function() {
				delete $scope.loading[bucketId];
			});
			tracker.event('action', 'run tasks');
		};

		$scope.$watch('profile', function(profile) {
			if ($scope.isSelf() && profile) {
				$scope.refresh({});
			}
		});
		$scope.$on('reload', $scope.refresh);
	}]);

	app.controller('CredentialsListController', ['$scope', '$http', 'tracker', 'delay', function($scope, $http, tracker, delay) {

		$scope.offset = 0;
		$scope.limit = 10;
		$scope.total = 0;
		$scope.credentials = null;

		$scope.hasPrev = function() {
			return $scope.offset > 0;
		};
		$scope.hasNext = function() {
			return $scope.offset + $scope.limit < $scope.total;
		};
		$scope.prev = function() {
			$scope.refresh({ offset : $scope.offset - $scope.limit });
		};
		$scope.next = function() {
			$scope.refresh({ offset : $scope.offset + $scope.limit });
		};
		$scope.params = function() {
			return {
				offset : $scope.offset,
				limit : $scope.limit
			};
		};
		$scope.refresh = function(params) {
			$http.get('/users/' + $scope.profile['@id'] + '/credentials/?' + $.param($.extend($scope.params(), params)))
				.success(function(response) {
					$.extend($scope, params);
					$scope.total = response.total;
					$scope.credentials = response.items;
				})
				.error(function(response, status) {
					if (status < 500) {
						$scope.message = 'Can\'t retrieve any credentials.';
					} else {
						$scope.message = 'Couldn\'t retrieve any credentials. Try again later or contact support.';
					}
				});
		};
		$scope.remove = function(credentialsId) {
			$scope.alert.clear();
			$http({ method : 'DELETE', url : '/credentials/' + credentialsId })
				.success(function(response, status, headers) {
					$scope.alert.show('Deleted credentials.', 'alert-success', headers('X-Command-ID'));
					$scope.offset = 0;
					delay($scope.refresh);
				})
				.error(function(response, status) {
					if (status < 500) {
						$scope.message = 'Can\'t delete credentials.';
					} else {
						$scope.message = 'Couldn\'t delete credentials. Try again later or contact support.';
					}
				});
			tracker.event('action', 'delete credentials');
		};

		$scope.$watch('profile', function(profile) {
			if ($scope.isSelf() && profile) {
				$scope.refresh({});
			}
		});
		$scope.$on('reload', $scope.refresh);
	}]);

	app.controller('AuthorizationListController', ['$scope', '$http', 'delay', function($scope, $http, delay) {

		$scope.offset = 0;
		$scope.limit = 10;
		$scope.total = 0;
		$scope.authorizations = null;

		$scope.hasPrev = function() {
			return $scope.offset > 0;
		};
		$scope.hasNext = function() {
			return $scope.offset + $scope.limit < $scope.total;
		};
		$scope.prev = function() {
			$scope.refresh({ offset : $scope.offset - $scope.limit });
		};
		$scope.next = function() {
			$scope.refresh({ offset : $scope.offset + $scope.limit });
		};
		$scope.params = function() {
			return {
				has_client : true,
				offset : $scope.offset,
				limit : $scope.limit
			};
		};
		$scope.refresh = function(params) {
			$http.get('/users/' + $scope.profile['@id'] + '/authorizations/?' + $.param($.extend($scope.params(), params)))
				.success(function(response) {
					$.extend($scope, params);
					$scope.total = response.total;
					$scope.authorizations = response.authorizations;
				});
		};
		$scope.remove = function(authId) {
			$http({ method : 'DELETE', url : '/authorizations/' + authId })
				.success(function(response, status, headers) {
					$scope.alert.show('Revoked an authorization.', 'alert-success', headers('X-Command-ID'));
					$scope.offset = 0;
					delay($scope.refresh);
				})
				.error(function(response, status) {
					if (status < 500) {
						$scope.alert.show('Can\'t revoke the authorization.', 'alert-error');
					} else {
						$scope.alert.show('Couldn\'t revoke the authorization. Try again later or contact support.', 'alert-error');
					}
				});
		};

		$scope.$watch('profile', function(profile) {
			if ($scope.isSelf() && profile) {
				$scope.refresh({});
			}
		});
		$scope.$on('reload', $scope.refresh);
	}]);

	app.controller('HomeController', ['$scope', '$http', '$location', '$timeout', 'token', 'tracker', function($scope, $http, $location, $timeout, token, tracker) {

		$scope.start = function() {
			$scope.alert.clear();
			$http({ method: 'POST', url: '/oauth/token', data: 'grant_type=client_credentials',
				headers: { 'Content-Type' : 'application/x-www-form-urlencoded' }
			})
				.success(function(response) {
					console.assert(response.access_token, 'missing access_token in getting started response');
					token.set(response.access_token);
					$scope.whoami(function(user) {
						$location.path('/users/' + user.getName());
						$timeout(function() {
							$scope.openDialog('create-bucket-dialog');
						}, 1000);
					});
				})
				.error(function(response, status) {
					if (status < 500) {
						$scope.alert.show('Can\'t create a guest account.', 'alert-error');
					} else {
						$scope.alert.show('Couldn\'t create a guest account. Try again later or contact support.', 'alert-error');
					}
				});
			tracker.event('action', 'get started');
		};
	}]);

	app.controller('CreateBucketDialogController', ['$scope', '$http', '$location', '$timeout', 'tracker', function($scope, $http, $location, $timeout, tracker) {

		$scope.init = function() {
			$scope.label = 'My Data';
			$scope.message = '';
			$scope.source = null;
			$scope.category = null;
			$scope.template = null;
			$http.get('/dashboard/templates.json').success(function(response) {
				$scope.templates = response;
			});
			tracker.event('dialog', 'create bucket');
		};
		$scope.sources = function() {
			var sources = [];
			if ($scope.templates) {
				$.each($scope.templates, function(i, template) {
					if (!$scope.category || $scope.category === template.category) {
						if (sources.indexOf(template.source) === -1) {
							console.assert(template.source, template);
							sources.push(template.source);
						}
					}
				});
			}
			return sources.sort(function(a, b) {
				return a.localeCompare(b);
			});
		};
		$scope.categories = function() {
			var categories = [];
			if ($scope.templates) {
				$.each($scope.templates, function(i, template) {
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
		$scope.valid = function() {
			return $scope.source && $scope.category || !$scope.source && !$scope.category;
		};
		$scope.validLabel = function() {
			return $scope.label && $scope.label.length > 0;
		};
		$scope.create = function() {
			$scope.alert.clear();
			$http.post('/buckets/', { label : $scope.label, widgets : $scope.template ? $scope.template.widgets : [] })
				.success(function(response, status, headers) {
					var location = headers('Location');
					console.assert(status === 201, status);
					console.assert(location, 'missing location header');
					$scope.closeDialog();
					$location.url(location);
					if ($scope.template) {
						if ($scope.template.task) {
							$timeout(function() {
								$scope.openDialog('create-task-dialog', $scope.template.task);
							}, 500);
						} else if ($scope.template.importer) {
							$timeout(function() {
								$scope.openDialog('import-dialog', $scope.template.importer);
							}, 500);
						}
					}
				})
				.error(function(response, status) {
					if (status === 400) {
						$scope.message = 'Can\'t create bucket.';
					} else {
						$scope.message = 'Couldn\'t create bucket. Please try agan later or contact support.';
					}
				});
			tracker.event('action', 'create bucket', $scope.template ? $scope.template.label : undefined);
		};

		var setTemplate = function() {
			if ($scope.templates) {
				if ($scope.source && $scope.category) {
					$.each($scope.templates, function(i, template) {
						if (template.source === $scope.source && template.category === $scope.category) {
							$scope.template = template;
							return false;
						}
					});
				} else {
					$scope.template = null;
				}
			}
		};
		$scope.$watch('source', setTemplate);
		$scope.$watch('category', setTemplate);
	}]);

	app.controller('CreateViewDialogController', ['$scope', '$http', '$location', '$timeout', 'tracker', function($scope, $http, $location, $timeout, tracker) {

		$scope.init = function() {
			$scope.label = 'My View';
			$scope.message = '';
			$scope.buckets = [];
			$scope.aliases = [];
			$scope.selected = null;
			$scope.filter = null;
			$http.get('/users/' + $scope.profile['@id'] + '/buckets/?' + $.param({ order : 'label', offset : 0, limit : 100, labels_only : true })).success(function(response) {
				$scope.buckets = response.buckets;
			});
			tracker.event('dialog', 'create view');
		};
		$scope.valid = function() {
			return $scope.aliases.length > 0;
		};
		$scope.create = function() {
			$scope.alert.clear();
			var aliases = $.map($scope.aliases, function(alias) {
				return { '@id' : alias['@id'], 'filter' : alias.filter };
			});
			$http.post('/buckets/', { label : $scope.label, aliases : aliases })
				.success(function(response, status, headers) {
					var location = headers('Location');
					console.assert(status === 201, status);
					console.assert(location, 'missing location header');
					$scope.closeDialog();
					$location.url(location);
				})
				.error(function(response, status) {
					if (status === 400) {
						$scope.message = 'Can\'t create view.';
					} else {
						$scope.message = 'Couldn\'t create view. Please try agan later or contact support.';
					}
				});
			tracker.event('action', 'create view');
		};
		$scope.listBuckets = function() {
			if ($scope.buckets) {
				return $.grep($scope.buckets, function(bucket) {
					return !bucket.aliases && $.grep($scope.aliases, function(alias) {
						return alias['@id'] == bucket['@id'];
					}).length === 0;
				});
			}
		};
		$scope.addBucket = function() {
			var alias = angular.copy($scope.selected);
			if ($scope.filter) {
				alias.filter = $scope.filter;
			}
			$scope.aliases.push(alias);
			$scope.selected = null;
			$scope.filter = null;
		};
		$scope.removeBucket = function(bucket) {
			$scope.aliases = $.grep($scope.aliases, function(alias) {
				return alias['@id'] != bucket['@id'];
			});
		};
	}]);

	app.controller('AddWidgetController', ['$scope', '$http', '$route', '$routeParams', '$location', '$timeout', 'random', function($scope, $http, $route, $routeParams, $location, $timeout, random) {

		$scope.dialog = $('#add-widget-dialog');
		$scope.templates = [
			{
				type : 'timeline',
				label : 'Timeline',
				description : 'Plots values on a timeline.',
				thumbnail : '/img/widgets/timeline.png',
				settings : { field : 'timestamp', statistic : 'count' }
			},
			{
				type : 'list',
				label : 'List',
				description : 'Shows all matching events, pageable.',
				thumbnail : '/img/widgets/list.png',
				settings : { limit : 10, order : '-timestamp' },
				singleton : true
			},
			{
				type : 'count',
				label : 'Count',
				description : 'Counts events by tag or author.',
				thumbnail : '/img/widgets/count.png',
				settings : { field : 'tag', order : '-count', limit : 5 }
			},
			{
				type : 'map',
				label : 'Map',
				description : 'Shows clusters of events on a map.',
				thumbnail : '/img/widgets/map.png',
				settings : { }
			},
			{
				type : 'heatmap',
				label : 'Map',
				description : 'Shows the density of events on a map.',
				thumbnail : '/img/widgets/heatmap.png',
				settings : { }
			},
			{
				type : 'ratings',
				label : 'Ratings',
				description : 'Counts events by their rating.',
				thumbnail : '/img/widgets/ratings.png',
				settings : { }
			},
			{
				type : 'histogram',
				label : 'Histogram',
				description : 'Shows the distribution of values in a field.',
				thumbnail : '/img/widgets/histogram.png',
				settings : { field : 'distance', interval : 10, unit : 'mi' }
			},
			{
				type : 'scoreboard',
				label : 'Scoreboard',
				description : 'Statistics for the values in a field.',
				thumbnail : '/img/widgets/scoreboard.png',
				settings : { key_field : 'author', value_field : 'distance', unit : 'mi', order : '-sum', limit : 10 }
			},
			{
				type : 'gantt',
				label : 'Frequency',
				description : 'Shows how long ago and how often certain events occur.',
				thumbnail : '/img/widgets/gantt.png',
				settings : { field : 'tag', order : '-max', limit : 10 }
			},
			{
				type : 'polar',
				label : 'Polar Chart',
				description : 'Plots values by month of year, day of week, or hour of day.',
				thumbnail : '/img/widgets/polar.png',
				settings : { interval : 'day_of_week', value_field : 'timestamp' }
			},
			{
				type : 'scatterplot',
				label : 'Scatter Plot',
				description : 'Correlates values from two fields.',
				thumbnail : '/img/widgets/scatterplot.png',
				settings : { field_x : 'count', field_y : 'count' }
			},
			{
				type : 'sonification',
				label : 'Sonify',
				description : 'Plays data from timeline widgets as sounds.',
				thumbnail : '/img/widgets/sonification.png',
				settings : { tempo : 176, scale : 'chromatic' },
				singleton : true
			}
		];
		$scope.init = function(placement) {
			$scope.placement = placement;
		};
		$scope.add = function(template) {
			var settings = {
				'id' : random.id(),
				'type' : template.type,
				'label' : template.label,
				'placement' : $scope.placement
			};
			$.extend(true, settings, template.settings);
			$scope.addWidget(settings);
			$timeout(function() {
				$('#' + settings.id + '-tab').tab('show');
				$scope.openDialog(settings.id + '-dialog');
				$scope.setDirty(true);
			}, 500);
		};
		$scope.findTemplates = function() {
			return $.grep($scope.templates, function(template) {
				return !template.singleton || !$scope.exists(template);
			});
		};
		$scope.exists = function(template) {
			return $scope.bucket && $.grep($scope.bucket.widgets, function(widget) {
				return widget.type === template.type;
			}).length > 0;
		};
	}]);

}());
