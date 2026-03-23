(function() {

	'use strict';

	var app = angular.module('appModule');

	app.directive('uiBindEvent', ['Field', '$compile', function(Field, $compile) {
		return {
			restrict : 'A',
			link : function(scope, element, attrs) {
				var event = scope.$eval(attrs.uiBindEvent);
				var html = '';
				if (event) {
					var count = 0;
					$.each(Field.findAll(), function(i, field) {
						var value = event[field.name];
						if (angular.isDefined(value)) {
							$.each($.isArray(value) ? value : [ value ], function(i, value) {
								if (count > 0) {
									html += ' &nbsp; ';
								}
								html += field.toHtml(value, true);
								++count;
							});
						}
					});
				}
				element.html(html);
				$compile(element.contents())(scope);
			}
		};
	}]);

	app.filter('field', ['Field', function(Field) {
		return function(value, fieldName) {
			var field = Field.find(fieldName);
			console.assert(field, 'Don\'t know how to format field: ' + fieldName);
			return field.toHtml(value);
		};
	}]);

	app.filter('age', [ 'moment', function(moment) {
		return function(date) {
			return date ? moment(date).utcOffset(date).fromNowOrNow(true) : '';
		};
	}]);

	app.filter('duration', ['moment', function(moment) {
		return function(millis) {
			return isFinite(millis) ? moment.duration(millis).countdown(1) : '';
		};
	}]);

	app.filter('stars', ['Field', function(Field) {
		var field = Field.find('rating');
		return function(rating) {
			return field.toHtml(rating);
		};
	}]);

	app.filter('username', ['User', function(User) {
		return function(identity) {
			return identity ? User.find(identity).getName() : '';
		};
	}]);

	app.filter('startFrom', function() {
		return function(input, start) {
			if (input) {
				return input.slice(+start);
			}
		};
	});

	app.directive('uiQuota', ['$interpolate', '$filter', function($interpolate, $filter) {
		return {
			restrict : 'A',
			compile : function() {
				return function(scope, element, attrs) {
					var template = $interpolate(
						'<div class="progress" title="{{title}}">' +
						'  <div class="bar {{class}}" style="width:{{percent}}%;"></div>' +
						'</div>');
					scope.$watch(attrs.uiQuota, function(quota) {
						if (quota) {
							var percent = Math.max(Math.ceil(quota.remaining / quota.limit * 100), 1);
							element.html(template({
								'title' : 'You have used ' + $filter('number')(quota.used) + '/' + $filter('number')(quota.limit) + ' events this month.',
								'class' : percent > 10 ? 'bar-success' : percent > 1 ? 'bar-warning' : 'bar-danger',
								'percent' : percent
							}));
						}
					});
				};
			}
		};
	}]);

	app.directive('uiCurrentYear', function() {
		return {
			restrict : 'A',
			link : function(scope, element) {
				element.html(new Date().getFullYear());
			}
		};
	});

	app.directive('uiFocusOn', function() {
		return {
			restrict : 'A',
			link : function(scope, element, attrs) {
				var tokens = attrs.uiFocusOn.split(':', 2);
				console.assert(tokens.length === 2);
				scope.$on(tokens[0], function(event, param) {
					if (event.name === tokens[0] && param === tokens[1]) {
						setTimeout(function() {
							element.select();
						}, 0);
					}
				});
			}
		};
	});

	app.directive('uiModal', function() {
		return {
			restrict : 'A',
			link : function(scope, element, attrs) {
				var id = attrs.id || scope.$eval(attrs.uiModal);
				console.assert(id, '@id is required');
				element.addClass('modal hide');
				element.on('hidden', function() {
					scope.closeDialog();
					if (scope.close) {
						scope.close();
					}
				});
				scope.$on('openDialog', function(event, dialogId, param) {
					if (dialogId === id) {
						if (scope.init) {
							scope.init(param);
						}
						element.modal('show');
					} else {
						element.modal('hide');
					}
				});
			}
		};
	});

	app.directive('uiDatepicker', ['moment', function(moment) {
		return {
			require : '?ngModel',
			restrict : 'A',
			link : function($scope, element, attrs, controller) {
				var updateModel = function(event) {
					element.datepicker('hide');
					element.blur();
					return $scope.$apply(function() {
						return controller.$setViewValue(event.date);
					});
				};
				if (controller !== null) {
					controller.$formatters.unshift(function(value) {
						return typeof value === 'object' ? moment.utc(value).format('YYYY-MM-DD') : null;
					});
					controller.$render = function() {
						element.datepicker().data().datepicker.date = controller.$modelValue;
						element.datepicker('setValue');
						element.datepicker('update');
						return controller.$viewValue;
					};
				}
				var options = {
					format : 'yyyy-mm-dd',
					weekStart : 1
				};
				return element.datepicker(options).on('changeDate', updateModel);
			}
		};
	}]);

	app.directive('uiTimepicker', ['moment', function(moment) {
		return {
			require: 'ngModel',
			link: function(scope, element, attrs, controller) {
				controller.$parsers.push(function(s) {
					return moment(s, [ 'H:mm:ss', 'H:mm:ss.SSS' ], true);
				});
				controller.$formatters.push(function(time) {
					return time.format('HH:mm:ss');
				});
			}
		};
	}]);

	app.directive('uiDefer', ['$timeout', function($timeout) {
		return {
			require : 'ngModel',
			link : function($scope, $element, $attrs, modelCtrl) {
				var $setViewValue = modelCtrl.$setViewValue;
				var bufferedValue;
				modelCtrl.$setViewValue = function(value) {
					bufferedValue = value;
				};
				$element.bind('change', function() {
					$timeout(function() {
						$setViewValue.call(modelCtrl, bufferedValue);
					});
				});
			}
		};
	}]);

	app.directive('uiChartOptions', ['tracker', function(tracker) {
		return {
			restrict : 'A',
			scope : true,
			link : function(scope, element, attrs) {
				var defaultOptions = {
					chart : {
						renderTo : element[0]
					},
					exporting : {
						enabled : false
					}
				};
				if (attrs.uiSnapshot !== undefined) {
					scope.$on('snapshot', function() {
						if (scope.chart) {
							var filename = scope.settings.label.replace(/\s+/g, '-').toLowerCase();
							scope.chart.exportChart({
								filename : filename,
								type : 'image/png',
								sourceWidth : element[0].offsetWidth,
								sourceHeight : element[0].offsetHeight,
								scale : 1,
								url : 'https://export.highcharts.com/'
							});
							tracker.event('action', 'snapshot');
						}
					});
				}
				scope.$watch(attrs.uiChartOptions, function(newOptions, oldOptions) {
					if (!angular.equals(newOptions, oldOptions)) {
						if (oldOptions) {
							scope.chart.destroy();
						}
						if (newOptions) {
							scope.chart = new Highcharts.Chart($.extend(true, {}, newOptions, defaultOptions));
							$('#' + attrs.uiId + '-tab').on('shown', function() {
								scope.chart.reflow();
							});
							if (newOptions.playable) {
								scope.$on('tic', function(event, clock, active) {
									var data = scope.chart.series[0].data;
									data[clock % data.length].select(active);
								});
							}
						}
					}
				}, true);
			}
		};
	}]);

	app.directive('uiBucketLabel', ['Bucket', function(Bucket) {
		return {
			restrict : 'A',
			link : function(scope, element, attrs) {
				var id = scope.$eval(attrs.uiBucketLabel);
				element.html(id);
				Bucket.getLabel(id, function(label) {
					element.html(label);
				});
			}
		};
	}]);

	app.directive('uiFieldValue', function() {
		return {
			require: 'ngModel',
			link: function(scope, element, attrs, controller) {
				controller.$parsers.unshift(function(value) {
					var field = scope.getField();
					var n = field.toNumber(value);
					return !isNaN(n) ? n : value;
				});
				controller.$formatters.unshift(function(value) {
					var field = scope.getField();
					return field.toText(value);
				});
			}
		};
	});

	app.directive('uiPasswordMatch', [function() {
		return {
			require : 'ngModel',
			link : function(scope, element, attrs, controller) {
				var firstPassword = '#' + attrs.uiPasswordMatch;
				element.add(firstPassword).on('keyup', function() {
					scope.$apply(function() {
						var v = element.val() === $(firstPassword).val();
						controller.$setValidity('match', v);
					});
				});
			}
		};
	}]);

	app.directive('uiCheckFilter', ['$http', function($http) {

		var validationErrorKey = 'filter';

		function checkSyntax(value) {
			return !value || $.grep(value.split('|'), function(expression) {
				return expression.split(':').length != 2;
			}).length === 0;
		}

		function checkResults(bucket, value, callback) {
			$http.get('/buckets/' + bucket['@id'] + '/?' + $.param({ 'q' : value.split('|'), 'limit' : 0 }, true))
			.success(function() {
				callback(true);
			})
			.error(function() {
				callback(false);
			});
		}

		return {
			require : 'ngModel',
			link : function(scope, element, attrs, controller) {
				if (!controller.$options) {
					controller.$options = {
						updateOn : 'blur',
						debounce : {
							'default' : 1000,
							'blur' : 0
						}
					};
					controller.$options.updateOnDefault = true;
				}
				controller.$parsers.unshift(function(value) {
					var valid = checkSyntax(value);
					if (valid && value) {
						var bucket = scope.$eval(attrs.uiCheckFilter);
						checkResults(bucket, value, function(valid) {
							controller.$setValidity(validationErrorKey, valid);
						});
					} else {
						controller.$setValidity(validationErrorKey, valid);
					}
					return value;
				});
				controller.$formatters.unshift(function(value) {
					var valid = checkSyntax(value);
					controller.$setValidity(validationErrorKey, valid);
					return value;
				});
			}
		};
	}]);

	/* Based on http://blog.parkji.co.uk/2013/08/11/native-drag-and-drop-in-angularjs.html */
	app.directive('uiDraggable', function() {
		return function(scope, element, attrs) {
			var el = element[0];
			el.draggable = true;
			el.addEventListener('dragstart', function(e) {
					e.dataTransfer.effectAllowed = 'move';
					e.dataTransfer.setData('text', attrs.uiDraggable);
					this.classList.add('drag');
					return false;
				}, false);
			el.addEventListener('dragend', function() {
					this.classList.remove('drag');
					return false;
				}, false);
		};
	});

	app.directive('uiDroppable', ['$timeout', function($timeout) {

		return {
			link : function(scope, element, attrs) {
				var el = element[0];
				el.addEventListener('dragover', function(e) {
						e.dataTransfer.dropEffect = 'move';
						if (e.preventDefault) {
							e.preventDefault();
						}
						this.classList.add('drop');
						return false;
					}, false);

				el.addEventListener('dragenter', function(e) {
						if (e.preventDefault) {
							e.preventDefault();
						}
						this.classList.add('drop');
						return false;
					}, false);

				el.addEventListener('dragleave', function() {
						this.classList.remove('drop');
						return false;
					}, false);

				el.addEventListener('drop', function(e) {
						if (e.stopPropagation) {
							e.stopPropagation();
						}
						if (e.preventDefault) {
							e.preventDefault();
						}
						this.classList.remove('drop');
						scope.$apply(function(scope) {
							var sourceId = e.dataTransfer.getData('text');
							var targetId = attrs.uiDroppable;
							if (sourceId !== targetId) {
								scope.moveWidget(sourceId, targetId);
								$timeout(function() {
									$('#' + sourceId + '-tab').tab('show');
									scope.setDirty(true);
								}, 0);
							}
						});
						return false;
					}, false);
			}
		};
	}]);

	app.directive('uiBlurOnEnter', function() {
		return {
			link : function(scope, element) {
				var el = element[0];
				el.addEventListener('keydown', function(e) {
					if (e.keyCode === 13) {
						el.blur();
					}
				});
			}
		};
	});

	app.directive('uiHighlight', ['$window', function($window) {
		return {
			link : function(scope, element) {
				$window.hljs.highlightBlock(element[0]);
			}
		};
	}]);

	app.directive('uiDownloadCsv', ['$window', function($window) {
		return {
			link : function(scope, element) {
				element.bind('click', function() {
					var spreadsheet = scope.toSpreadsheet();
					var url = ($window.URL || $window.webkitURL).createObjectURL(spreadsheet.toBlob());
					var a = document.createElement('a');
					document.body.appendChild(a);
					a.style.display = 'none';
					a.download = scope.settings.label.replace(/\s+/g, '-').toLowerCase() + '.csv';
					a.href = url;
					a.click();
					document.body.removeChild(a);
					$window.URL.revokeObjectURL(url);
				});
			}
		};
	}]);

	app.directive('uiTimezoneSelect', ['$http', function($http) {
		return {
			link : function(scope) {
				scope.timezones = Intl.supportedValuesOf('timeZone');
				scope.settings.timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
			}
		};
	}]);

}());
