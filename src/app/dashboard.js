(() => {
	var app = angular.module('appModule');

	app.factory('Bucket', [
		'$http',
		($http) => {
			var Bucket = function (data) {
				$.extend(this, data);
			};

			Bucket.getLabel = (id, callback) => {
				$http.get('/buckets/' + id + '/label').success((response) => {
					callback(response.label);
				});
			};

			Bucket.prototype.getLabel = function () {
				return this.label || '?';
			};

			Bucket.prototype.isPublished = function () {
				return $.grep(this.roles, (role) => role.principal === '*').length > 0;
			};

			Bucket.prototype.publish = function () {
				if (!this.isPublished()) {
					this.roles.push({ principal: '*', role: 'viewer' });
				}
			};

			Bucket.prototype.unpublish = function () {
				this.roles = $.grep(this.roles, (role) => role.principal !== '*');
			};

			Bucket.prototype.getOwner = function () {
				for (var i = 0, max = this.roles.length; i < max; ++i) {
					if (this.roles[i].role === 'owner') {
						return this.roles[i].principal;
					}
				}
			};

			Bucket.prototype.canEdit = function (principal) {
				for (var i = 0; i < this.roles.length; ++i) {
					if (this.roles[i].principal === principal) {
						return this.roles[i].role === 'owner' || this.roles[i].role === 'contributor';
					}
				}
			};

			Bucket.prototype.isVirtual = function () {
				return this.aliases && this.aliases.length > 0;
			};

			return Bucket;
		},
	]);

	app.controller('DashboardController', [
		'$scope',
		'$http',
		'$route',
		'$routeParams',
		'$location',
		'$q',
		'$window',
		'Bucket',
		'Field',
		'Constraint',
		'tracker',
		'delay',
		'taskRunner',
		($scope, $http, $route, $routeParams, $location, $q, $window, Bucket, Field, Constraint, tracker, delay, taskRunner) => {
			function updateEditable() {
				$scope.editable = $scope.user && $scope.bucket.canEdit($scope.user['@id']);
			}

			$scope.bucketId = $routeParams.bucketId;
			$http
				.get('/buckets/' + $scope.bucketId)
				.success((response) => {
					$scope.bucket = new Bucket(response);
					$scope.page.setTitle($scope.bucket.label);
					$scope.$watch('user', updateEditable);
				})
				.error((response, status) => {
					if (status < 500) {
						$scope.message = "Can't retrieve this bucket.";
					} else {
						$scope.message = "Couldn't retrieve this bucket. Try again later or contact support.";
					}
				});

			$scope.constraints = [];
			$scope.constraintsB = [];
			$scope.widgets = [];

			var layout = {};
			$scope.$watch('bucket.widgets', () => {
				var l = {};
				if ($scope.bucket) {
					$.each($scope.bucket.widgets, (i, widget) => {
						l[widget.placement] = true;
					});
				}
				layout = l;
			});
			$scope.hasWidgets = (placement) => layout[placement];

			$scope.getWidgetSettings = (placement) => $scope.bucket && $.grep($scope.bucket.widgets, (widget) => widget.placement === placement);
			$scope.removeWidget = (settings) => {
				if ($scope.bucket.widgets.length > 1) {
					delay(() => {
						// dialog won't close properly if we don't delay
						$scope.bucket.widgets = $.grep($scope.bucket.widgets, (widget) => widget.id !== settings.id);
						$scope.widgets = $.grep($scope.widgets, (widget) => widget.settings.id !== settings.id);
						var remaining = $scope.getWidgetSettings(settings.placement);
						if (remaining.length > 0) {
							$('#' + remaining[0].id + '-tab').tab('show');
						}
						$scope.setDirty(true);
					});
				}
			};
			$scope.canImport = () => typeof FileReader !== 'undefined' && $scope.editable;
			$scope.addWidget = (settings) => {
				$scope.bucket.widgets.push(settings);
			};
			$scope.moveWidget = (sourceId, targetId) => {
				var sourceWidget, sourceIndex;
				$.each($scope.bucket.widgets, (i, widget) => {
					if (widget.id === sourceId) {
						sourceIndex = i;
						sourceWidget = widget;
						return false;
					}
				});
				console.assert(sourceWidget, 'missing source widget', sourceId);
				$scope.bucket.widgets.splice(sourceIndex, 1);
				if (targetId.charAt(0) === '+') {
					sourceWidget.placement = targetId.substring(1);
					$scope.bucket.widgets.push(sourceWidget);
				} else {
					$.each($scope.bucket.widgets, (i, widget) => {
						if (widget.id === targetId) {
							sourceWidget.placement = widget.placement;
							$scope.bucket.widgets.splice(i, 0, sourceWidget);
							return false;
						}
					});
				}
				$scope.refresh();
			};
			$scope.getTemplate = (type) => '/dashboard/' + type + '.html';

			var register = (widget) => {
				$scope.widgets.push(widget);
			};
			var seen = 0;
			$scope.register = (widget, implicit) => {
				register(widget);
				if (!implicit) {
					if (++seen === $scope.bucket.widgets.length) {
						$scope.register = register;
						$scope.refresh();
					}
				}
			};

			function search(q, facets) {
				return $http.get('/buckets/' + $scope.bucketId + '/?' + $.param({ q: q, facet: facets }, true));
			}
			/**
			 * Escape commas.
			 */
			function escape(s) {
				return typeof s === 'string' ? s.replace(/,/g, '\\,') : s;
			}
			$scope.search = (params, callback) => {
				var facets = $.map(params, (param) => $.map(param, (value, key) => (angular.isDefined(value) && value !== null && value !== '' ? key + ':' + escape(value) : null)).join(','));
				var t0 = Date.now();
				var requests = [search($scope.constraints, facets)];
				if ($scope.constraintsB.length > 0) {
					requests.push(search($scope.constraintsB, facets));
				}
				$q.all(requests).then(
					(responses) => {
						var t1 = Date.now();
						callback(responses[0].data, responses.length > 1 ? responses[1].data : null);
						tracker.timing('action', 'refresh', t1 - t0, $scope.bucketId);
					},
					() => {
						callback({ total: -1 });
					},
				);
			};
			$scope.refresh = () => {
				$scope.updateConstraints();
				var params = $.map($scope.widgets, (widget) => widget.params());
				$scope.$broadcast('refresh');
				$scope.search(params, (response, responseB) => {
					$scope.total = response.total;
					$scope.$broadcast('result', response, responseB);
				});
			};
			$scope.removeEvent = (eventId) => {
				$scope.alert.clear();
				$http({ method: 'DELETE', url: '/buckets/' + $scope.bucketId + '/' + eventId })
					.success((response, status, headers) => {
						delay($scope.refresh);
						$scope.alert.show('Deleted an event.', 'alert-success', headers('X-Command-ID'));
					})
					.error((response, status) => {
						if (status < 500) {
							$scope.alert.show("Can't delete the event.", 'alert-error');
						} else {
							$scope.alert.show("Couldn't delete the event. Try again later or contact support.", 'alert-error');
						}
					});
				tracker.event('action', 'delete event');
			};
			$scope.run = () => {
				$scope.alert.clear();
				$scope.loading = true;
				taskRunner
					.runAll($scope, $scope.bucketId)
					.then(() => {
						delay($scope.refresh);
					})
					['finally'](() => {
						$scope.loading = false;
					});
				tracker.event('action', 'run tasks');
			};

			$scope.$on('$routeUpdate', () => {
				$scope.refresh();
			});
			$scope.$on('credentials', () => {
				$scope.run();
			});

			function parseConstraints(value) {
				if (value && !$.isArray(value)) {
					value = value.split('|');
				}
				return value ? $.map(value, (s) => Constraint.parse(s)) : [];
			}
			$scope.updateConstraints = () => {
				$scope.constraints = parseConstraints($location.search()['q']);
				$scope.constraintsB = parseConstraints($location.search()['r']);
			};
			$scope.getConstraints = (field) => $.grep($scope.constraints, (constraint) => constraint.field === field);
			$scope.getConstraintsB = (field) => $.grep($scope.constraintsB, (constraint) => constraint.field === field);
			$scope.getConstraintsString = () => {
				var items = mapToString($scope.constraints);
				return items !== null ? items.join('|') : null;
			};
			function containsConstraint(constraint) {
				return $.grep($scope.constraints, (c) => angular.equals(c, constraint)).length > 0;
			}
			function mapToString(values) {
				return values.length > 0 ? $.map(values, (value) => value.toString()) : null;
			}
			function params() {
				var value = {};
				if ($scope.constraints.length > 0) {
					value.q = mapToString($scope.constraints);
				}
				if ($scope.constraintsB.length > 0) {
					value.r = mapToString($scope.constraintsB);
				}
				return value;
			}
			$scope.addConstraint = (field, value, replace, negated) => {
				var subfield = null;
				var p = field.indexOf('$');
				if (p > 0) {
					subfield = field.substring(p + 1);
					field = field.substring(0, p);
				}
				var constraint = new Constraint(field, value, negated, subfield);
				if (containsConstraint(constraint)) {
					return;
				}
				if (replace) {
					$scope.constraints = $.grep($scope.constraints, (c) => c.field !== constraint.field);
				}
				$scope.constraints.push(constraint);
				$location.search(params());
			};
			$scope.addConstraints = (constraints) => {
				$scope.constraints = $scope.constraints.concat(constraints);
				$location.search(params());
			};
			$scope.removeConstraint = (constraint) => {
				$scope.constraints = $.grep($scope.constraints, (c) => !angular.equals(c, constraint));
				$location.search(params());
			};
			$scope.removeConstraintB = (constraint) => {
				$scope.constraintsB = $.grep($scope.constraintsB, (c) => !angular.equals(c, constraint));
				$location.search(params());
			};
			$scope.invertConstraint = (constraint) => {
				$scope.constraints = $.map($scope.constraints, (c) => (angular.equals(c, constraint) ? c.invert() : c));
				$location.search(params());
			};
			$scope.invertConstraintB = (constraint) => {
				$scope.constraintsB = $.map($scope.constraintsB, (c) => (angular.equals(c, constraint) ? c.invert() : c));
				$location.search(params());
			};
			$scope.getConstraintIcon = (constraint) => {
				var fieldName = constraint.field;
				var dot = fieldName.indexOf('.');
				if (dot !== -1) {
					fieldName = fieldName.substring(0, dot);
				}
				var field = Field.find(fieldName);
				return field ? field.icon : 'fa-circle';
			};
			$scope.swapAB = () => {
				var tmp = $scope.constraints;
				$scope.constraints = $scope.constraintsB.length ? $scope.constraintsB : angular.copy($scope.constraints);
				$scope.constraintsB = tmp;
				$location.search(params());
				tracker.event('action', 'A/B test');
			};

			$scope.dirty = false;
			$scope.setDirty = (dirty) => {
				$scope.dirty = dirty;
			};

			var clock = 0;
			$scope.tic = () => {
				$scope.$broadcast('tic', clock++, true);
			};
			$scope.untic = () => {
				$scope.$broadcast('tic', clock, false);
				clock = 0;
			};
		},
	]);

	app.controller('EditWidgetsController', [
		'$scope',
		'$http',
		'$route',
		'tracker',
		($scope, $http, $route, tracker) => {
			$scope.save = () => {
				$scope.alert.clear();
				$http
					.put('/buckets/' + $scope.bucketId, $scope.bucket)
					.success((response, status, headers) => {
						$scope.alert.show('Saved settings.', 'alert-success', headers('X-Command-ID'));
						++$scope.$parent.bucket.version;
						$scope.setDirty(false);
					})
					.error((response, status) => {
						if (status === 400) {
							$scope.alert.show("Can't save this bucket", 'alert-error');
						} else {
							$scope.alert.show("Couldn't save this bucket. Try again later or contact support.", 'alert-error');
						}
					});
				tracker.event('action', 'save widgets');
			};
			$scope.revert = () => {
				$route.reload();
			};
		},
	]);

	app.controller('SaveAsViewDialogController', [
		'$scope',
		'$http',
		'$location',
		'$timeout',
		'tracker',
		($scope, $http, $location, $timeout, tracker) => {
			$scope.init = () => {
				$scope.label = $scope.$parent.bucket.label;
				$scope.message = '';
				tracker.event('dialog', 'save as view');
			};
			$scope.create = () => {
				var bucket = {
					label: $scope.label,
					widgets: $scope.$parent.bucket.widgets,
					aliases: [
						{
							'@id': $scope.bucket['@id'],
							filter: $scope.$parent.getConstraintsString(),
						},
					],
				};
				$http
					.post('/buckets/', bucket)
					.success((response, status, headers) => {
						var location = headers('Location');
						console.assert(status === 201, status);
						console.assert(location, 'missing location header');
						$scope.alert.clear();
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
		},
	]);

	app.controller('EditBucketDialogController', [
		'$scope',
		'$http',
		'$location',
		'delay',
		'tracker',
		($scope, $http, $location, delay, tracker) => {
			$scope.init = () => {
				$scope.newBucket = angular.copy($scope.$parent.bucket);
				$scope.newBucket.refresh = !!($scope.newBucket.refresh && $scope.user.quota);
				$scope.isView = $scope.newBucket.aliases && $scope.newBucket.aliases.length > 0;
				$scope.selected = null;
				$scope.filter = null;
				$http.get('/users/' + $scope.user['@id'] + '/buckets/?' + $.param({ order: 'label', offset: 0, limit: 100, labels_only: true })).success((response) => {
					$scope.buckets = response.buckets;
				});
				tracker.event('dialog', 'edit bucket');
			};
			$scope.listBuckets = () => {
				if ($scope.buckets) {
					return $.grep($scope.buckets, (bucket) => !bucket.aliases && $.grep($scope.newBucket.aliases, (alias) => alias['@id'] === bucket['@id']).length === 0);
				}
			};
			$scope.addBucket = () => {
				$scope.newBucket.aliases.push({ '@id': $scope.selected['@id'], filter: $scope.filter });
				$scope.selected = null;
				$scope.filter = null;
			};
			$scope.removeBucket = (bucketId) => {
				$scope.newBucket.aliases = $.grep($scope.newBucket.aliases, (bucket) => bucket['@id'] !== bucketId);
			};
			$scope.valid = () => !$scope.isView || $scope.newBucket.aliases.length > 0;
			$scope.save = () => {
				$scope.message = '';
				$http
					.put('/buckets/' + $scope.bucketId, $scope.newBucket)
					.success((response, status, headers) => {
						$scope.closeDialog();
						$scope.alert.show('Saved settings.', 'alert-success', headers('X-Command-ID'));
						$scope.newBucket.version += 1;
						$scope.$parent.bucket = $scope.newBucket;
						delay($scope.refresh);
						tracker.event('action', 'save bucket');
					})
					.error((response, status) => {
						if (status === 400) {
							$scope.message = "Can't save this bucket";
						} else {
							$scope.message = "Couldn't save this bucket. Try again later or contact support.";
						}
					});
			};
			$scope.archiveBucket = (archive) => {
				$scope.alert.clear();
				if (archive) {
					$scope.newBucket.archived = true;
				} else {
					delete $scope.newBucket.archived;
				}
				$http
					.put('/buckets/' + $scope.bucketId, $scope.newBucket)
					.success(() => {
						$scope.closeDialog();
						$location.url('/users/' + $scope.$parent.user.getName());
					})
					.error((response, status) => {
						if (status < 500) {
							$scope.message = "Can't archive this bucket.";
						} else {
							$scope.message = "Couldn't archive this bucket. Try again later or contact support.";
						}
					});
				tracker.event('action', 'delete bucket');
			};
			$scope.deleteBucket = () => {
				$scope.alert.clear();
				$http({ method: 'DELETE', url: '/buckets/' + $scope.bucketId })
					.success(() => {
						$scope.closeDialog();
						$location.url('/users/' + $scope.$parent.user.getName());
					})
					.error((response, status) => {
						if (status < 500) {
							$scope.message = "Can't delete this bucket.";
						} else {
							$scope.message = "Couldn't delete this bucket. Try again later or contact support.";
						}
					});
				tracker.event('action', 'delete bucket');
			};
		},
	]);
})();
