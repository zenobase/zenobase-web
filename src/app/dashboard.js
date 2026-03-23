(function() {

	'use strict';

	var app = angular.module('appModule');

	app.factory('Bucket', [ '$http', function($http) {

		var Bucket = function(data) {
			$.extend(this, data);
		};

		Bucket.getLabel = function(id, callback) {
			$http.get('/buckets/' + id + '/label')
				.success(function(response) {
					callback(response.label);
				});
		};

		Bucket.prototype.getLabel = function() {
			return this.label || '?';
		};

		Bucket.prototype.isPublished = function() {
			return $.grep(this.roles, function(role) {
				return role.principal === '*';
			}).length > 0;
		};

		Bucket.prototype.publish = function() {
			if (!this.isPublished()) {
				this.roles.push({ 'principal' : '*', 'role' : 'viewer' });
			}
		};

		Bucket.prototype.unpublish = function() {
			this.roles = $.grep(this.roles, function(role) {
				return role.principal !== '*';
			});
		};

		Bucket.prototype.getOwner = function() {
			for (var i = 0, max = this.roles.length; i < max; ++i) {
				if (this.roles[i].role === 'owner') {
					return this.roles[i].principal;
				}
			}
		};

		Bucket.prototype.canEdit = function(principal) {
			for (var i = 0; i < this.roles.length; ++i) {
				if (this.roles[i].principal === principal) {
					return this.roles[i].role === 'owner' || this.roles[i].role === 'contributor';
				}
			}
		};

		Bucket.prototype.isVirtual = function() {
			return this.aliases && this.aliases.length > 0;
		};

		return Bucket;
	}]);

	app.controller('DashboardController', ['$scope', '$http', '$route', '$routeParams', '$location', '$q', '$window', 'Bucket', 'Field', 'Constraint', 'tracker', 'delay', 'taskRunner', function($scope, $http, $route, $routeParams, $location, $q, $window, Bucket, Field, Constraint, tracker, delay, taskRunner) {

		function updateEditable() {
			$scope.editable = $scope.user && $scope.bucket.canEdit($scope.user['@id']);
		}

		$scope.bucketId = $routeParams.bucketId;
		$http.get('/buckets/' + $scope.bucketId)
			.success(function(response) {
				$scope.bucket = new Bucket(response);
				$scope.page.setTitle($scope.bucket.label);
				$scope.$watch('user', updateEditable);
			})
			.error(function(response, status) {
				if (status < 500) {
					$scope.message = 'Can\'t retrieve this bucket.';
				} else {
					$scope.message = 'Couldn\'t retrieve this bucket. Try again later or contact support.';
				}
			});

		$scope.constraints = [];
		$scope.constraintsB = [];
		$scope.widgets = [];

		var layout = {};
		$scope.$watch('bucket.widgets', function() {
			var l = {};
			if ($scope.bucket) {
				$.each($scope.bucket.widgets, function(i, widget) {
					l[widget.placement] = true;
				});
			}
			layout = l;
		});
		$scope.hasWidgets = function(placement) {
			return layout[placement];
		};

		$scope.getWidgetSettings = function(placement) {
			return $scope.bucket && $.grep($scope.bucket.widgets, function(widget) {
				return widget.placement === placement;
			});
		};
		$scope.removeWidget = function(settings) {
			if ($scope.bucket.widgets.length > 1) {
				delay(function() { // dialog won't close properly if we don't delay
					$scope.bucket.widgets = $.grep($scope.bucket.widgets, function(widget) {
						return widget.id !== settings.id;
					});
					$scope.widgets = $.grep($scope.widgets, function(widget) {
						return widget.settings.id !== settings.id;
					});
					var remaining = $scope.getWidgetSettings(settings.placement);
					if (remaining.length > 0) {
						$('#' + remaining[0].id + '-tab').tab('show');
					}
					$scope.setDirty(true);
				});
			}
		};
		$scope.canImport = function() {
			return typeof FileReader != 'undefined' && $scope.editable;
		};
		$scope.addWidget = function(settings) {
			$scope.bucket.widgets.push(settings);
		};
		$scope.moveWidget = function(sourceId, targetId) {
			var sourceWidget, sourceIndex;
			$.each($scope.bucket.widgets, function(i, widget) {
				if (widget.id === sourceId) {
					sourceIndex = i;
					sourceWidget = widget;
					return false;
				}
			});
			console.assert(sourceWidget, "missing source widget", sourceId);
			$scope.bucket.widgets.splice(sourceIndex, 1);
			if (targetId.charAt(0) === '+') {
				sourceWidget.placement = targetId.substring(1);
				$scope.bucket.widgets.push(sourceWidget);
			} else {
				$.each($scope.bucket.widgets, function(i, widget) {
					if (widget.id === targetId) {
						sourceWidget.placement = widget.placement;
						$scope.bucket.widgets.splice(i, 0, sourceWidget);
						return false;
					}
				});
			}
			$scope.refresh();
		};
		$scope.getTemplate = function(type) {
			return '/dashboard/' + type + '.html';
		};

		var register = function(widget) {
			$scope.widgets.push(widget);
		};
		var seen = 0;
		$scope.register = function(widget, implicit) {
			register(widget);
			if (!implicit) {
				if (++seen == $scope.bucket.widgets.length) {
					$scope.register = register;
					$scope.refresh();
				}
			}
		};

		function search(q, facets) {
			return $http.get('/buckets/' + $scope.bucketId + '/?' + $.param({ 'q' : q, 'facet' : facets }, true));
		}
		/**
		 * Escape commas.
		 */
		function escape(s) {
			return typeof s === 'string' ? s.replace(/,/g, '\\,') : s;
		}
		$scope.search = function(params, callback) {
			var facets = $.map(params, function(param) {
				return $.map(param, function(value, key) {
					return angular.isDefined(value) && value !== null && value !== '' ?
							key + ':' + escape(value) : null;
				}).join(',');
			});
			var t0 = new Date().getTime();
			var requests = [ search($scope.constraints, facets) ];
			if ($scope.constraintsB.length > 0) {
				requests.push(search($scope.constraintsB, facets));
			}
			$q.all(requests).then(function(responses) {
				var t1 = new Date().getTime();
				callback(responses[0].data, responses.length > 1 ? responses[1].data : null);
				tracker.timing('action', 'refresh', t1 - t0, $scope.bucketId);
			}, function() {
				callback({ total : -1 });
			});
		};
		$scope.refresh = function() {
			$scope.updateConstraints();
			var params = $.map($scope.widgets, function(widget) { return widget.params(); });
			$scope.$broadcast('refresh');
			$scope.search(params, function(response, responseB) {
				$scope.total = response.total;
				$scope.$broadcast('result', response, responseB);
			});
		};
		$scope.removeEvent = function(eventId) {
			$scope.alert.clear();
			$http({ method : 'DELETE', url : '/buckets/' + $scope.bucketId + '/' + eventId })
				.success(function(response, status, headers) {
					delay($scope.refresh);
					$scope.alert.show('Deleted an event.', 'alert-success', headers('X-Command-ID'));
				})
				.error(function(response, status) {
					if (status < 500) {
						$scope.alert.show('Can\'t delete the event.', 'alert-error');
					} else {
						$scope.alert.show('Couldn\'t delete the event. Try again later or contact support.', 'alert-error');
					}
				});
			tracker.event('action', 'delete event');
		};
		$scope.run = function() {
			$scope.alert.clear();
			$scope.loading = true;
			taskRunner.runAll($scope, $scope.bucketId).then(function() {
				delay($scope.refresh);
			})['finally'](function() {
				$scope.loading = false;
			});
			tracker.event('action', 'run tasks');
		};

		$scope.$on('$routeUpdate', function() {
			$scope.refresh();
		});
		$scope.$on('credentials', function() {
			$scope.run();
		});

		function parseConstraints(value) {
			if (value && !$.isArray(value)) {
				value = value.split('|');
			}
			return value ? $.map(value, function(s) { return Constraint.parse(s); }) : [];

		}
		$scope.updateConstraints = function() {
			$scope.constraints = parseConstraints($location.search()['q']);
			$scope.constraintsB = parseConstraints($location.search()['r']);
		};
		$scope.getConstraints = function(field) {
			return $.grep($scope.constraints, function(constraint) {
				return constraint.field === field;
			});
		};
		$scope.getConstraintsB = function(field) {
			return $.grep($scope.constraintsB, function(constraint) {
				return constraint.field === field;
			});
		};
		$scope.getConstraintsString = function() {
			var items = mapToString($scope.constraints);
			return items !== null ? items.join('|') : null;
		};
		function containsConstraint(constraint) {
			return $.grep($scope.constraints, function(c) {
				return angular.equals(c, constraint);
			}).length > 0;
		}
		function mapToString(values) {
			return values.length > 0 ?
				$.map(values, function(value) { return value.toString(); }) :
				null;
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
		$scope.addConstraint = function(field, value, replace, negated) {
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
				$scope.constraints = $.grep($scope.constraints, function(c) {
					return c.field !== constraint.field;
				});
			}
			$scope.constraints.push(constraint);
			$location.search(params());
		};
		$scope.addConstraints = function(constraints) {
			$scope.constraints = $scope.constraints.concat(constraints);
			$location.search(params());
		};
		$scope.removeConstraint = function(constraint) {
			$scope.constraints = $.grep($scope.constraints, function(c) {
				return !angular.equals(c, constraint);
			});
			$location.search(params());
		};
		$scope.removeConstraintB = function(constraint) {
			$scope.constraintsB = $.grep($scope.constraintsB, function(c) {
				return !angular.equals(c, constraint);
			});
			$location.search(params());
		};
		$scope.invertConstraint = function(constraint) {
			$scope.constraints = $.map($scope.constraints, function(c) {
				return angular.equals(c, constraint) ? c.invert() : c;
			});
			$location.search(params());
		};
		$scope.invertConstraintB = function(constraint) {
			$scope.constraintsB = $.map($scope.constraintsB, function(c) {
				return angular.equals(c, constraint) ? c.invert() : c;
			});
			$location.search(params());
		};
		$scope.getConstraintIcon = function(constraint) {
			var fieldName = constraint.field;
			var dot = fieldName.indexOf('.');
			if (dot != -1) {
				fieldName = fieldName.substring(0, dot);
			}
			var field = Field.find(fieldName);
			return field ? field.icon : 'fa-circle';
		};
		$scope.swapAB = function() {
			var tmp = $scope.constraints;
			$scope.constraints = $scope.constraintsB.length ? $scope.constraintsB : angular.copy($scope.constraints);
			$scope.constraintsB = tmp;
			$location.search(params());
			tracker.event('action', 'A/B test');
		};

		$scope.dirty = false;
		$scope.setDirty = function(dirty) {
			$scope.dirty = dirty;
		};

		var clock = 0;
		$scope.tic = function() {
			$scope.$broadcast('tic', clock++, true);
		};
		$scope.untic = function() {
			$scope.$broadcast('tic', clock, false);
			clock = 0;
		};
	}]);

	app.controller('EditWidgetsController', ['$scope', '$http', '$route', 'tracker', function($scope, $http, $route, tracker) {
		$scope.save = function() {
			$scope.alert.clear();
			$http.put('/buckets/' + $scope.bucketId, $scope.bucket)
				.success(function (response, status, headers) {
					$scope.alert.show('Saved settings.', 'alert-success', headers('X-Command-ID'));
					++$scope.$parent.bucket.version;
					$scope.setDirty(false);
				})
				.error(function(response, status) {
					if (status === 400) {
						$scope.alert.show('Can\'t save this bucket', 'alert-error');
					} else {
						$scope.alert.show('Couldn\'t save this bucket. Try again later or contact support.', 'alert-error');
					}
				});
			tracker.event('action', 'save widgets');
		};
		$scope.revert = function() {
			$route.reload();
		};
	}]);

	app.controller('SaveAsViewDialogController', ['$scope', '$http', '$location', '$timeout', 'tracker', function($scope, $http, $location, $timeout, tracker) {

		$scope.init = function() {
			$scope.label = $scope.$parent.bucket.label;
			$scope.message = '';
			tracker.event('dialog', 'save as view');
		};
		$scope.create = function() {
			var bucket = {
				'label' : $scope.label,
				'widgets' : $scope.$parent.bucket.widgets,
				'aliases' : [
					{
						'@id' : $scope.bucket['@id'],
						'filter' : $scope.$parent.getConstraintsString()
					}
				]
			};
			$http.post('/buckets/', bucket)
				.success(function(response, status, headers) {
					var location = headers('Location');
					console.assert(status === 201, status);
					console.assert(location, 'missing location header');
					$scope.alert.clear();
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
	}]);

	app.controller('EditBucketDialogController', ['$scope', '$http', '$location', 'delay', 'tracker', function($scope, $http, $location, delay, tracker) {

		$scope.init = function() {
			$scope.newBucket = angular.copy($scope.$parent.bucket);
			$scope.newBucket.refresh = $scope.newBucket.refresh && $scope.user.quota ? true : false;
			$scope.isView = $scope.newBucket.aliases && $scope.newBucket.aliases.length > 0;
			$scope.selected = null;
			$scope.filter = null;
			$http.get('/users/' + $scope.user['@id'] + '/buckets/?' + $.param({ 'order' : 'label', offset : 0, limit : 100, labels_only : true })).success(function(response) {
				$scope.buckets = response.buckets;
			});
			tracker.event('dialog', 'edit bucket');
		};
		$scope.listBuckets = function() {
			if ($scope.buckets) {
				return $.grep($scope.buckets, function(bucket) {
					return !bucket.aliases && $.grep($scope.newBucket.aliases, function(alias) {
						return alias['@id'] == bucket['@id'];
					}).length === 0;
				});
			}
		};
		$scope.addBucket = function() {
			$scope.newBucket.aliases.push({ '@id' : $scope.selected['@id'], 'filter' : $scope.filter });
			$scope.selected = null;
			$scope.filter = null;
		};
		$scope.removeBucket = function(bucketId) {
			$scope.newBucket.aliases = $.grep($scope.newBucket.aliases, function(bucket) {
				return bucket['@id'] !== bucketId;
			});
		};
		$scope.valid = function() {
			return !$scope.isView || $scope.newBucket.aliases.length > 0;
		};
		$scope.save = function() {
			$scope.message = '';
			$http.put('/buckets/' + $scope.bucketId, $scope.newBucket)
				.success(function(response, status, headers) {
					$scope.closeDialog();
					$scope.alert.show('Saved settings.', 'alert-success', headers('X-Command-ID'));
					$scope.newBucket.version += 1;
					$scope.$parent.bucket = $scope.newBucket;
					delay($scope.refresh);
					tracker.event('action', 'save bucket');
				})
				.error(function(response, status) {
					if (status === 400) {
						$scope.message = 'Can\'t save this bucket';
					} else {
						$scope.message = 'Couldn\'t save this bucket. Try again later or contact support.';
					}
				});
		};
		$scope.archiveBucket = function(archive) {
			$scope.alert.clear();
			if (archive) {
				$scope.newBucket.archived = true;
			} else {
				delete $scope.newBucket.archived;
			}
			$http.put('/buckets/' + $scope.bucketId, $scope.newBucket)
				.success(function() {
					$scope.closeDialog();
					$location.url('/users/' + $scope.$parent.user.getName());
				})
				.error(function(response, status) {
					if (status < 500) {
						$scope.message = 'Can\'t archive this bucket.';
					} else {
						$scope.message = 'Couldn\'t archive this bucket. Try again later or contact support.';
					}
				});
			tracker.event('action', 'delete bucket');
		};
		$scope.deleteBucket = function() {
			$scope.alert.clear();
			$http({ method : 'DELETE', url : '/buckets/' + $scope.bucketId })
				.success(function() {
					$scope.closeDialog();
					$location.url('/users/' + $scope.$parent.user.getName());
				})
				.error(function(response, status) {
					if (status < 500) {
						$scope.message = 'Can\'t delete this bucket.';
					} else {
						$scope.message = 'Couldn\'t delete this bucket. Try again later or contact support.';
					}
				});
			tracker.event('action', 'delete bucket');
		};
	}]);

}());
