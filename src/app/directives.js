(() => {
	var app = angular.module('appModule');

	app.directive('uiBindEvent', [
		'Field',
		'$compile',
		(Field, $compile) => ({
			restrict: 'A',
			link: (scope, element, attrs) => {
				var event = scope.$eval(attrs.uiBindEvent);
				var html = '';
				if (event) {
					var count = 0;
					$.each(Field.findAll(), (i, field) => {
						var value = event[field.name];
						if (angular.isDefined(value)) {
							$.each($.isArray(value) ? value : [value], (i, value) => {
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
			},
		}),
	]);

	app.filter('field', [
		'Field',
		(Field) => (value, fieldName) => {
			var field = Field.find(fieldName);
			console.assert(field, "Don't know how to format field: " + fieldName);
			return field.toHtml(value);
		},
	]);

	app.filter('age', ['moment', (moment) => (date) => (date ? moment(date).utcOffset(date).fromNowOrNow(true) : '')]);

	app.filter('duration', ['moment', (moment) => (millis) => (Number.isFinite(millis) ? moment.duration(millis).countdown(1) : '')]);

	app.filter('stars', [
		'Field',
		(Field) => {
			var field = Field.find('rating');
			return (rating) => field.toHtml(rating);
		},
	]);

	app.filter('username', ['User', (User) => (identity) => (identity ? User.find(identity).getName() : '')]);

	app.filter('startFrom', () => (input, start) => {
		if (input) {
			return input.slice(+start);
		}
	});

	app.directive('uiQuota', [
		'$interpolate',
		'$filter',
		($interpolate, $filter) => ({
			restrict: 'A',
			compile: () => (scope, element, attrs) => {
				var template = $interpolate('<div class="progress" title="{{title}}">' + '  <div class="bar {{class}}" style="width:{{percent}}%;"></div>' + '</div>');
				scope.$watch(attrs.uiQuota, (quota) => {
					if (quota) {
						var percent = Math.max(Math.ceil((quota.remaining / quota.limit) * 100), 1);
						element.html(
							template({
								title: 'You have used ' + $filter('number')(quota.used) + '/' + $filter('number')(quota.limit) + ' events this month.',
								class: percent > 10 ? 'bar-success' : percent > 1 ? 'bar-warning' : 'bar-danger',
								percent: percent,
							}),
						);
					}
				});
			},
		}),
	]);

	app.directive('uiCurrentYear', () => ({
		restrict: 'A',
		link: (scope, element) => {
			element.html(new Date().getFullYear());
		},
	}));

	app.directive('uiFocusOn', () => ({
		restrict: 'A',
		link: (scope, element, attrs) => {
			var tokens = attrs.uiFocusOn.split(':', 2);
			console.assert(tokens.length === 2);
			scope.$on(tokens[0], (event, param) => {
				if (event.name === tokens[0] && param === tokens[1]) {
					setTimeout(() => {
						element.select();
					}, 0);
				}
			});
		},
	}));

	app.directive('uiModal', () => ({
		restrict: 'A',
		link: (scope, element, attrs) => {
			var id = attrs.id || scope.$eval(attrs.uiModal);
			console.assert(id, '@id is required');
			element.addClass('modal hide');
			element.on('hidden', () => {
				scope.closeDialog();
				if (scope.close) {
					scope.close();
				}
			});
			scope.$on('openDialog', (event, dialogId, param) => {
				if (dialogId === id) {
					if (scope.init) {
						scope.init(param);
					}
					element.modal('show');
				} else {
					element.modal('hide');
				}
			});
		},
	}));

	app.directive('uiDatepicker', [
		'moment',
		(moment) => ({
			require: '?ngModel',
			restrict: 'A',
			link: ($scope, element, attrs, controller) => {
				var updateModel = (event) => {
					element.datepicker('hide');
					element.blur();
					return $scope.$apply(() => controller.$setViewValue(event.date));
				};
				if (controller !== null) {
					controller.$formatters.unshift((value) => (typeof value === 'object' ? moment.utc(value).format('YYYY-MM-DD') : null));
					controller.$render = () => {
						element.datepicker().data().datepicker.date = controller.$modelValue;
						element.datepicker('setValue');
						element.datepicker('update');
						return controller.$viewValue;
					};
				}
				var options = {
					format: 'yyyy-mm-dd',
					weekStart: 1,
				};
				return element.datepicker(options).on('changeDate', updateModel);
			},
		}),
	]);

	app.directive('uiTimepicker', [
		'moment',
		(moment) => ({
			require: 'ngModel',
			link: (scope, element, attrs, controller) => {
				controller.$parsers.push((s) => moment(s, ['H:mm:ss', 'H:mm:ss.SSS'], true));
				controller.$formatters.push((time) => time.format('HH:mm:ss'));
			},
		}),
	]);

	app.directive('uiDefer', [
		'$timeout',
		($timeout) => ({
			require: 'ngModel',
			link: ($scope, $element, $attrs, modelCtrl) => {
				var $setViewValue = modelCtrl.$setViewValue;
				var bufferedValue;
				modelCtrl.$setViewValue = (value) => {
					bufferedValue = value;
				};
				$element.bind('change', () => {
					$timeout(() => {
						$setViewValue.call(modelCtrl, bufferedValue);
					});
				});
			},
		}),
	]);

	app.directive('uiChartOptions', [
		'tracker',
		(tracker) => ({
			restrict: 'A',
			scope: true,
			link: (scope, element, attrs) => {
				var defaultOptions = {
					chart: {
						renderTo: element[0],
					},
					exporting: {
						enabled: false,
					},
				};
				if (attrs.uiSnapshot !== undefined) {
					scope.$on('snapshot', () => {
						if (scope.chart) {
							var filename = scope.settings.label.replace(/\s+/g, '-').toLowerCase();
							scope.chart.exportChart({
								filename: filename,
								type: 'image/png',
								sourceWidth: element[0].offsetWidth,
								sourceHeight: element[0].offsetHeight,
								scale: 1,
								url: 'https://export.highcharts.com/',
							});
							tracker.event('action', 'snapshot');
						}
					});
				}
				scope.$watch(
					attrs.uiChartOptions,
					(newOptions, oldOptions) => {
						if (!angular.equals(newOptions, oldOptions)) {
							if (oldOptions) {
								scope.chart.destroy();
							}
							if (newOptions) {
								scope.chart = new Highcharts.Chart($.extend(true, {}, newOptions, defaultOptions));
								$('#' + attrs.uiId + '-tab').on('shown', () => {
									scope.chart.reflow();
								});
								if (newOptions.playable) {
									scope.$on('tic', (event, clock, active) => {
										var data = scope.chart.series[0].data;
										data[clock % data.length].select(active);
									});
								}
							}
						}
					},
					true,
				);
			},
		}),
	]);

	app.directive('uiBucketLabel', [
		'Bucket',
		(Bucket) => ({
			restrict: 'A',
			link: (scope, element, attrs) => {
				var id = scope.$eval(attrs.uiBucketLabel);
				element.html(id);
				Bucket.getLabel(id, (label) => {
					element.html(label);
				});
			},
		}),
	]);

	app.directive('uiFieldValue', () => ({
		require: 'ngModel',
		link: (scope, element, attrs, controller) => {
			controller.$parsers.unshift((value) => {
				var field = scope.getField();
				var n = field.toNumber(value);
				return !Number.isNaN(n) ? n : value;
			});
			controller.$formatters.unshift((value) => {
				var field = scope.getField();
				return field.toText(value);
			});
		},
	}));

	app.directive('uiPasswordMatch', [
		() => ({
			require: 'ngModel',
			link: (scope, element, attrs, controller) => {
				var firstPassword = '#' + attrs.uiPasswordMatch;
				element.add(firstPassword).on('keyup', () => {
					scope.$apply(() => {
						var v = element.val() === $(firstPassword).val();
						controller.$setValidity('match', v);
					});
				});
			},
		}),
	]);

	app.directive('uiCheckFilter', [
		'$http',
		($http) => {
			var validationErrorKey = 'filter';

			function checkSyntax(value) {
				return !value || $.grep(value.split('|'), (expression) => expression.split(':').length !== 2).length === 0;
			}

			function checkResults(bucket, value, callback) {
				$http
					.get('/buckets/' + bucket['@id'] + '/?' + $.param({ q: value.split('|'), limit: 0 }, true))
					.success(() => {
						callback(true);
					})
					.error(() => {
						callback(false);
					});
			}

			return {
				require: 'ngModel',
				link: (scope, element, attrs, controller) => {
					if (!controller.$options) {
						controller.$options = {
							updateOn: 'blur',
							debounce: {
								default: 1000,
								blur: 0,
							},
						};
						controller.$options.updateOnDefault = true;
					}
					controller.$parsers.unshift((value) => {
						var valid = checkSyntax(value);
						if (valid && value) {
							var bucket = scope.$eval(attrs.uiCheckFilter);
							checkResults(bucket, value, (valid) => {
								controller.$setValidity(validationErrorKey, valid);
							});
						} else {
							controller.$setValidity(validationErrorKey, valid);
						}
						return value;
					});
					controller.$formatters.unshift((value) => {
						var valid = checkSyntax(value);
						controller.$setValidity(validationErrorKey, valid);
						return value;
					});
				},
			};
		},
	]);

	/* Based on http://blog.parkji.co.uk/2013/08/11/native-drag-and-drop-in-angularjs.html */
	app.directive('uiDraggable', () => (scope, element, attrs) => {
		var el = element[0];
		el.draggable = true;
		el.addEventListener(
			'dragstart',
			function (e) {
				e.dataTransfer.effectAllowed = 'move';
				e.dataTransfer.setData('text', attrs.uiDraggable);
				this.classList.add('drag');
				return false;
			},
			false,
		);
		el.addEventListener(
			'dragend',
			function () {
				this.classList.remove('drag');
				return false;
			},
			false,
		);
	});

	app.directive('uiDroppable', [
		'$timeout',
		($timeout) => ({
			link: (scope, element, attrs) => {
				var el = element[0];
				el.addEventListener(
					'dragover',
					function (e) {
						e.dataTransfer.dropEffect = 'move';
						if (e.preventDefault) {
							e.preventDefault();
						}
						this.classList.add('drop');
						return false;
					},
					false,
				);

				el.addEventListener(
					'dragenter',
					function (e) {
						if (e.preventDefault) {
							e.preventDefault();
						}
						this.classList.add('drop');
						return false;
					},
					false,
				);

				el.addEventListener(
					'dragleave',
					function () {
						this.classList.remove('drop');
						return false;
					},
					false,
				);

				el.addEventListener(
					'drop',
					function (e) {
						if (e.stopPropagation) {
							e.stopPropagation();
						}
						if (e.preventDefault) {
							e.preventDefault();
						}
						this.classList.remove('drop');
						scope.$apply((scope) => {
							var sourceId = e.dataTransfer.getData('text');
							var targetId = attrs.uiDroppable;
							if (sourceId !== targetId) {
								scope.moveWidget(sourceId, targetId);
								$timeout(() => {
									$('#' + sourceId + '-tab').tab('show');
									scope.setDirty(true);
								}, 0);
							}
						});
						return false;
					},
					false,
				);
			},
		}),
	]);

	app.directive('uiBlurOnEnter', () => ({
		link: (scope, element) => {
			var el = element[0];
			el.addEventListener('keydown', (e) => {
				if (e.keyCode === 13) {
					el.blur();
				}
			});
		},
	}));

	app.directive('uiHighlight', [
		'$window',
		($window) => ({
			link: (scope, element) => {
				$window.hljs.highlightBlock(element[0]);
			},
		}),
	]);

	app.directive('uiDownloadCsv', [
		'$window',
		($window) => ({
			link: (scope, element) => {
				element.bind('click', () => {
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
			},
		}),
	]);

	app.directive('uiTimezoneSelect', [
		'$http',
		($http) => ({
			link: (scope) => {
				scope.timezones = Intl.supportedValuesOf('timeZone');
				scope.settings.timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
			},
		}),
	]);
})();
