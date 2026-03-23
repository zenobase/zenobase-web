(function() {

	'use strict';

	var app = angular.module('appModule');

	app.factory('WidgetControllerSupport', function() {
		return function($scope) {
			$scope.classesForOrderBy = function(column) {
				var classes = [];
				if ($scope.settings.order && $scope.settings.order.indexOf(column) !== -1) {
					classes.push('fa');
					classes.push($scope.settings.order.charAt(0) === '-' ? 'fa-sort-desc' : 'fa-sort-asc');
				}
				return classes;
			};
		};
	});

	app.factory('WidgetDialogControllerSupport', ['Field', function(Field) {
		return function($scope, orderBy) {
			$scope.init = function() {
				$scope.settings = angular.copy($scope.$parent.settings);
			};
			$scope.save = function() {
				$scope.refresh({}, $scope.settings);
				$scope.closeDialog();
				$scope.setDirty(true);
			};
			$scope.getField = function(name) {
				return Field.find(name);
			};
			if (orderBy) {
				$scope.orderBy = orderBy;
				$scope.ascDesc = { 'asc' : true, 'desc' : false };
				$scope.asc = function(asc) {
					if (angular.isDefined(asc)) {
						if (!asc && $scope.asc()) {
							$scope.settings.order = '-' + $scope.settings.order;
						} else if (asc && !$scope.asc()) {
							$scope.settings.order = $scope.settings.order.substr(1);
						}
					}
					return $scope.settings.order && $scope.settings.order.charAt(0) !== '-';
				};
				$scope.order = function(order) {
					if (angular.isDefined(order)) {
						if (!$scope.asc()) {
							order = '-' + order;
						}
						$scope.settings.order = order;
					}
					return $scope.settings.order && $scope.settings.order.charAt(0) === '-' ?
						$scope.settings.order.substr(1) : $scope.settings.order;
				};
			}
		};
	}]);


	app.factory('WidgetFilter', ['Constraint', function(Constraint) {

		var WidgetFilter = function(fields) {
			this.fields = fields;
			this.field = fields[0];
			this.value = null;
		};

		WidgetFilter.prototype.clear = function() {
			this.value = null;
		};

		WidgetFilter.prototype.build = function() {
			var field = this.field.id;
			var values = [];
			if (this.value) {
				if (this.field.tokenized) {
					var r = /([^"]\S*|".+?")\s*/g;
					var m;
					while (m = r.exec(this.value)) {
						values.push(m[1]);
					}
				} else {
					values = [ this.value ];
				}
			}
			return $.map(values, function (value) {
				return new Constraint(field, value);
			});
		};

		return WidgetFilter;
	}]);


	app.controller('ListWidgetController', ['$scope', 'WidgetFilter', function($scope, WidgetFilter) {

		$scope.init = function() {
			$scope.offset = 0;
			$scope.total = 0;
			$scope.items = null;
		};
		$scope.hasPrev = function() {
			return $scope.offset > 0;
		};
		$scope.hasNext = function() {
			return $scope.offset + $scope.settings.limit < $scope.total;
		};
		$scope.prev = function() {
			$scope.refresh({ offset : $scope.offset - $scope.settings.limit });
		};
		$scope.next = function() {
			$scope.refresh({ offset : $scope.offset + $scope.settings.limit });
		};
		$scope.filter = new WidgetFilter([
			{
				id : 'resource.title',
				label : 'resources',
				icon : 'fa-bookmark',
				tokenized : true
			}, {
				id : 'source.title',
				label : 'sources',
				icon : 'fa-external-link',
                tokenized : true
			}, {
				id : 'tag',
				label : 'tags',
				icon : 'fa-tag',
                tokenized : false
			}, {
				id : 'note',
				label : 'notes',
				icon : 'fa-comment-o',
                tokenized : true
			}
		]);
		$scope.applyFilter = function() {
			$scope.addConstraints($scope.filter.build());
			$scope.filter.clear();
		};
		$scope.params = function() {
			return {
				id : $scope.settings.id,
				type : 'list',
				offset : 0,
				limit : $scope.settings.limit,
				order : $scope.settings.order,
				filter : $scope.filter.build().join('|')
			};
		};
		$scope.refresh = function(options, settings) {
			$scope.search([ $.extend($scope.params(), options, settings) ], function(result) {
				$scope.init();
				$.extend($scope, options);
				$.extend($scope.settings, settings);
				$scope.update(null, result);
			});
		};
		$scope.update = function(event, result) {
			$scope.total = result.total;
			$scope.items = result[$scope.settings.id] || [];
		};

		$scope.init();
		$scope.register($scope);
		$scope.$on('result', $scope.update);
		$scope.$on('refresh', $scope.init);
		$scope.$watch('filter', function(to, from) {
			if (from !== to) {
				$scope.refresh({ offset : 0 });
			}
		}, true);
	}]);

	app.controller('ListWidgetDialogController', ['$scope', 'WidgetDialogControllerSupport', 'Field', function($scope, WidgetDialogControllerSupport, Field) {

		var fields = [ 'timestamp' ];
		$.each(Field.findByType('numeric'), function(i, field) {
			fields.push(field.name);
		});

		new WidgetDialogControllerSupport($scope, fields);
	}]);

	app.controller('CountWidgetController', ['$scope', 'WidgetControllerSupport', function($scope, WidgetControllerSupport) {

		new WidgetControllerSupport($scope);

		$scope.init = function() {
			$scope.offset = 0;
			$scope.more = false;
			$scope.terms = null;
		};
		$scope.hasPrev = function() {
			return $scope.offset > 0;
		};
		$scope.hasNext = function() {
			return $scope.more;
		};
		$scope.prev = function() {
			$scope.refresh({ offset : $scope.offset - $scope.settings.limit });
		};
		$scope.next = function() {
			$scope.refresh({ offset : $scope.offset + $scope.settings.limit });
		};
		$scope.params = function() {
			return {
				id : $scope.settings.id,
				type : 'count',
				field : $scope.settings.field,
				offset : $scope.offset,
				limit : $scope.settings.limit,
				order : $scope.settings.order,
				filter : $scope.settings.filter
			};
		};
		$scope.refresh = function(options, settings) {
			$scope.init();
			$scope.search([ $.extend($scope.params(), options, settings) ], function(result) {
				$.extend($scope, options);
				$.extend($scope.settings, settings);
				$scope.update(null, result);
			});
		};
		$scope.update = function(event, result) {
			var terms = result[$scope.settings.id] || [];
			$scope.more = terms.length > $scope.settings.limit;
			$scope.terms = $scope.more ? terms.slice(0, $scope.settings.limit) : terms;
		};
		$scope.filter = function(term) {
			$scope.offset = 0;
			$scope.addConstraint($scope.settings.field, term.label);
		};

		$scope.init();
		$scope.register($scope);
		$scope.$on('result', $scope.update);
		$scope.$on('refresh', $scope.init);
	}]);

	app.controller('CountWidgetDialogController', ['$scope', 'WidgetDialogControllerSupport', 'Field', function($scope, WidgetDialogControllerSupport, Field) {

		new WidgetDialogControllerSupport($scope, [ 'term', 'count' ]);

		$scope.fields = Field.findByType('text');
	}]);

	app.controller('GanttWidgetController', ['$scope', 'WidgetControllerSupport', 'timezone', function($scope, WidgetControllerSupport, timezone) {

		new WidgetControllerSupport($scope);

		$scope.keyField = 'timestamp';

		$scope.init = function() {
			$scope.terms = null;
			$scope.settings.key_field = $scope.settings.key_field || $scope.keyField;
		};
		$scope.params = function() {
			return {
				id : $scope.settings.id,
				type : 'gantt',
				key_field : $scope.settings.key_field,
				field : $scope.settings.field,
				timezone : timezone,
				order : $scope.settings.order,
				limit : $scope.settings.limit,
				filter : $scope.settings.filter
			};
		};
		$scope.refresh = function(options, settings) {
			$scope.init();
			$scope.search([ $.extend($scope.params(), options, settings) ], function(result) {
				$.extend($scope, options);
				$.extend($scope.settings, settings);
				$scope.update(null, result);
			});
		};
		$scope.update = function(event, result) {
			$scope.terms = result[$scope.settings.id] || [];
			if ($scope.terms) {
				$.each($scope.terms, function(i, term) {
					term.freq = Math.round((new Date(term.last).getTime() - new Date(term.first).getTime()) / (term.count - 1));
				});
			}
		};
		$scope.filter = function(term) {
			$scope.addConstraint($scope.settings.field, term.label);
		};

		$scope.init();
		$scope.register($scope);
		$scope.$on('result', $scope.update);
		$scope.$on('refresh', $scope.init);
	}]);

	app.controller('GanttWidgetDialogController', ['$scope', 'WidgetDialogControllerSupport', 'Field', function($scope, WidgetDialogControllerSupport, Field) {

		new WidgetDialogControllerSupport($scope, [ 'term', 'max' ]);

		$scope.fields = Field.findByType('text');
		$scope.subfields = $.map(Field.find($scope.keyField).subfields, function(subfield) {
			return { label : subfield, value : (subfield ? $scope.keyField + '$' + subfield : $scope.keyField) };
		});
	}]);

	app.controller('RatingsWidgetController', ['$scope', function($scope) {

		$scope.field = 'rating';

		$scope.init = function() {
			$scope.ratings = null;
		};
		$scope.params = function() {
			return {
				id : $scope.settings.id,
				type : 'ratings',
				filter : $scope.settings.filter
			};
		};
		$scope.update = function(event, result) {
			$scope.ratings = result[$scope.settings.id] || [];
		};
		$scope.refresh = function(options, settings) {
			$scope.init();
			$scope.search([ $.extend($scope.params(), options, settings) ], function(result) {
				$.extend($scope, options);
				$.extend($scope.settings, settings);
				$scope.update(null, result);
			});
		};
		function toString(value) {
			return typeof value === 'number' ? value + '%' : '*';
		}
		$scope.filter = function(rating) {
			$scope.offset = 0;
			$scope.addConstraint($scope.field, '[' + toString(rating.from) + '..' + toString(rating.to) + ')');
		};

		$scope.init();
		$scope.register($scope);
		$scope.$on('result', $scope.update);
		$scope.$on('refresh', $scope.init);
	}]);

	app.controller('RatingsWidgetDialogController', ['$scope', 'WidgetDialogControllerSupport', function($scope, WidgetDialogControllerSupport) {
		new WidgetDialogControllerSupport($scope);
	}]);

	app.controller('HistogramWidgetController', ['$scope', '$timeout', 'Field', 'Spreadsheet', function($scope, $timeout, Field, Spreadsheet) {

		$scope.init = function() {
			$scope.intervals = null;
		};
		$scope.params = function() {
			return {
				id : $scope.settings.id,
				type : 'histogram',
				field : $scope.settings.field,
				interval : $scope.settings.interval,
				unit : $scope.settings.unit,
				filter : $scope.settings.filter
			};
		};
		$scope.refresh = function(options, settings) {
			$scope.init();
			$scope.search([ $.extend($scope.params(), options, settings) ], function(result, resultB) {
				$.extend($scope, options);
				$.extend($scope.settings, settings);
				$scope.update(null, result, resultB);
			});
		};
		$scope.update = function(event, result) {
			$scope.intervals = result[$scope.settings.id] || [];
			$timeout($scope.draw, 0); // delay for correct width
		};
		$scope.snapshot = function() {
			$scope.$broadcast('snapshot');
		};
		$scope.toSpreadsheet = function() {
			var spreadsheet = new Spreadsheet([ $scope.settings.field, 'count' ]);
			var field = Field.find($scope.settings.field);
			$.each($scope.intervals, function(i, interval) {
				var value = '[' + field.toText(interval.from) + '..' + field.toText(interval.to) + ')';
				spreadsheet.addRecord([ value, interval.count ]);
			});
			return spreadsheet;
		};
		$scope.draw = function() {
			if ($scope.intervals && $scope.intervals.length) {
				var field = Field.find($scope.settings.field);
				var height = Math.max($scope.intervals.length * 20, 150);
				if ($scope.intervalsB && $scope.intervalsB.length) {
					height *= 2;
				}
				var options = {
					chart : {
						type : 'bar',
						zoomType : 'x',
						height : height,
						animation : false,
						events : {
							selection : function(event) {
								var min = (event.xAxis[0].min !== undefined) ? Math.ceil(event.xAxis[0].min) : 0;
								var max = (event.xAxis[0].max !== undefined) ? Math.floor(event.xAxis[0].max) : $scope.intervals.length - 1;
								if (min <= max) {
									var from = field.toText($scope.intervals[max].from);
									var to = field.toText($scope.intervals[min].to);
									if (from || to) {
										var range = '[' + from + '..' + to + ')';
										$scope.$apply(function() {
											$scope.addConstraint($scope.settings.field, range, true);
										});
									}
								}
								return false;
							}
						}
					},
					title : {
						text : null
					},
					xAxis : {
						categories : [],
						tickLength : 0
					},
					yAxis : {
						title : null,
						labels : {
							overflow : 'justify'
						},
						allowDecimals : false
					},
					series : [{
						name : 'count',
						color : 'rgba(47, 126, 216, 0.4)',
						data : []
					}],
					tooltip : {
						shared : false,
						hideDelay : 0,
						crosshairs : false,
						headerFormat : '<b>{point.key}</b>: ',
						pointFormat : '{point.y}'
					},
					plotOptions : {
						series : {
							pointWidth : 10,
							borderRadius : 5,
							borderWidth : 0,
							cursor : 'pointer',
							animation : false,
							events : {
								click : function(event) {
									var interval = $scope.intervals[event.point.x];
									var range = '[' + field.toText(interval.from) + '..' + field.toText(interval.to) + ')';
									$scope.$apply(function() {
										$scope.addConstraint($scope.settings.field, range, true);
									});
								}
							}
						}
					},
					legend : {
						enabled : false
					},
					credits: {
						enabled: false
					}
				};
				$.each($scope.intervals, function(i, interval) {
					options.xAxis.categories.push(field.toText(interval.from) + '..' + field.toText(interval.to));
					options.series[0].data.push(interval.count);
				});
				$scope.chartOptions = options;
			}
		};

		$scope.init();
		$scope.register($scope);
		$scope.$on('result', $scope.update);
		$scope.$on('refresh', $scope.init);
	}]);

	app.controller('HistogramWidgetDialogController', ['$scope', 'WidgetDialogControllerSupport', 'Field', function($scope, WidgetDialogControllerSupport, Field) {

		new WidgetDialogControllerSupport($scope);

		function isUnitValid() {
			var units = $scope.getUnits();
			return units.length === 0 ?
					$scope.settings.unit === null :
					$.inArray($scope.settings.unit, units) != -1;
		}

		$scope.getField = function() {
			return Field.find($scope.settings.field);
		};
		$scope.getFields = function() {
			return Field.findByType('numeric');
		};
		$scope.getUnits = function() {
			var f = Field.find($scope.settings.field);
			return f ? f.units : [];
		};
		$scope.valid = function() {
			return $scope.settings.interval > 0.0 && isUnitValid();
		};
		$scope.$watch('settings.field', function() {
			if (!isUnitValid()) {
				$scope.settings.unit = null;
			}
		});
	}]);

	app.controller('ScoreboardWidgetController', ['$scope', 'WidgetControllerSupport', function($scope, WidgetControllerSupport) {

		new WidgetControllerSupport($scope);

		$scope.init = function() {
			$scope.terms = null;
			if (!$scope.settings.statistics) {
				$scope.settings.statistics = [ 'count', 'sum', 'avg' ];
			}
		};
		$scope.params = function() {
			return {
				id : $scope.settings.id,
				type : 'scoreboard',
				key_field : $scope.settings.key_field,
				value_field : $scope.settings.value_field,
				unit : $scope.settings.unit,
				order : $scope.settings.order,
				limit : $scope.settings.limit,
				filter : $scope.settings.filter
			};
		};
		$scope.refresh = function(options, settings) {
			$scope.init();
			$scope.search([ $.extend($scope.params(), options, settings) ], function(result) {
				$.extend($scope, options);
				$.extend($scope.settings, settings);
				$scope.update(null, result);
			});
		};
		$scope.update = function(event, result) {
			$scope.terms = result[$scope.settings.id] || [];
		};
		$scope.filter = function(term) {
			$scope.addConstraint($scope.settings.key_field, term.label);
		};
		$scope.selected = function(value) {
			return $scope.settings.statistics.indexOf(value) != -1;
		};

		$scope.init();
		$scope.register($scope);
		$scope.$on('result', $scope.update);
		$scope.$on('refresh', $scope.init);
	}]);

	app.controller('ScoreboardWidgetDialogController', ['$scope', 'WidgetDialogControllerSupport', 'Field', function($scope, WidgetDialogControllerSupport, Field) {

		new WidgetDialogControllerSupport($scope, [ 'term', 'count', 'sum', 'min', 'max', 'avg' ]);

		$scope.isUnitValid = function() {
			var units = $scope.getUnits();
			return units.length === 0 ?
				$scope.settings.unit === null :
				$.inArray($scope.settings.unit, units) != -1;
		};
		$scope.getKeyFields = function() {
			return Field.findByType('text');
		};
		$scope.getValueFields = function() {
			return Field.findByType('numeric');
		};
		$scope.getUnits = function() {
			var valueField = Field.find($scope.settings.value_field);
			return valueField ? valueField.units : [];
		};
		$scope.toggle = function(value) {
			var i = $scope.settings.statistics.indexOf(value);
			if (i != -1) {
				$scope.settings.statistics.splice(i, 1);
			} else {
				$scope.settings.statistics.push(value);
			}
		};

		$scope.$watch('settings.value_field', function() {
			if (!$scope.isUnitValid()) {
				$scope.settings.unit = null;
			}
		});
	}]);

	app.factory('Interval', function() {

		var Interval = function(name, pattern, minTickInterval, symbol) {
			this.name = name;
			this.pattern = pattern.length;
			this.minTickInterval = minTickInterval;
			this.symbol = symbol;
		};

		Interval.VALUES = [
			new Interval('year', 'yyyy', 366 * 24 * 60 * 60 * 1000, 'y'),
			new Interval('month', 'yyyy-MM', 28 * 24 * 60 * 60 * 1000, 'M'),
			new Interval('week', 'yyyy-Www', 7 * 24 * 60 * 60 * 1000, 'w'),
			new Interval('day', 'yyyy-MM-dd', 24 * 60 * 60 * 1000, 'd'),
			new Interval('hour', 'yyyy-MM-ddTHH', 60 * 60 * 1000, 'h'),
			new Interval('minute', 'yyyy-MM-ddTHH:mm', 60 * 1000, 'm'),
			new Interval('second', 'yyyy-MM-ddTHH:mm:ss', 1000, 's')
		];

		Interval.VALUES[0].zoomIn = Interval.VALUES[1]; // year -> month
		Interval.VALUES[1].zoomIn = Interval.VALUES[3]; // month -> day
		Interval.VALUES[2].zoomIn = Interval.VALUES[3]; // week -> day
		Interval.VALUES[3].zoomIn = Interval.VALUES[4]; // day -> hour
		Interval.VALUES[4].zoomIn = Interval.VALUES[5]; // hour -> minute
		Interval.VALUES[5].zoomIn = Interval.VALUES[6]; // minute -> second

		Interval.match = function(value) {
			if (value.match(/^[0-9]{4}/)) {
				if (!value.match(/Z|[+-]\d\d:\d\d/)) {
					var i, max;
					for (i = 1, max = Interval.VALUES.length; i < max; ++i) {
						if (value.length === Interval.VALUES[i].pattern) {
							return Interval.VALUES[i].zoomIn;
						}
					}
				}
			}
		};

		function getFirst(rangeExpression) {
			if (rangeExpression.length >= 12 && rangeExpression.indexOf('..') != -1) {
				var tokens = rangeExpression.substring(1, rangeExpression.length - 1).split('..');
				if (tokens[0] == '*') {
					return tokens[1];
				}
				if (tokens[1] == '*') {
					return tokens[0];
				}
				return tokens[0];
			}
		}

		Interval.matchRange = function(value) {
			value = getFirst(value);
			if (value && value.match(/^[0-9]{4}/)) {
				if (!value.match(/Z|[+-]\d\d:\d\d/)) {
					var i, max;
					for (i = 0, max = Interval.VALUES.length; i < max; ++i) {
						if (value.length === Interval.VALUES[i].pattern) {
							return Interval.VALUES[i];
						}
					}
				}
			}
		};

		Interval.matchSymbol = function(value) {
			if (value) {
				var i, max;
				for (i = 0, max = Interval.VALUES.length; i < max; ++i) {
					if (value.indexOf(Interval.VALUES[i].symbol) != -1) {
						return Interval.VALUES[i];
					}
				}
			}
		};

		Interval.valueOf = function(name) {
			if (name) {
				var i, max;
				for (i = 0, max = Interval.VALUES.length; i < max; ++i) {
					if (Interval.VALUES[i].name === name) {
						return Interval.VALUES[i];
					}
				}
			}
		};

		return Interval;
	});

	app.controller('TimelineWidgetController', ['$scope', '$timeout', 'Field', 'Interval', 'Spreadsheet', 'moment', 'statistics', function($scope, $timeout, Field, Interval, Spreadsheet, moment, statistics) {

		$scope.keyField = 'timestamp';

		function commonPrefix(a, b) {
			if (!a) {
				return '';
			}
			if (!b) {
				return a;
			}
			var i = 0;
			var at = a.split(/(?=[-T:Z]+)/);
			var bt = b.split(/(?=[-T:Z]+)/);
			while (i < at.length && i < bt.length) {
				if (at[i] !== bt[i]) {
					break;
				}
				++i;
			}
			return at.slice(0, i).join('');
		}
		function filter(value) {
			$scope.addConstraint($scope.settings.key_field, value, true);
		}

		$scope.init = function() {
			$scope.times = null;
			$scope.timesB = null;
			$scope.paired = false;
			$scope.settings.key_field = $scope.settings.key_field || $scope.keyField;
		};
		$scope.params = function() {
			$scope.interval = Interval.valueOf($scope.settings.interval) || Interval.VALUES[1];
			$scope.range = '';
			var q = '';
			$.each($scope.getConstraints($scope.keyField), function(i, constraint) {
				q = constraint.value;
			});
			var r = '';
			$.each($scope.getConstraintsB($scope.keyField), function(i, constraint) {
				r = constraint.value;
			});
			var prefix = commonPrefix(q, r);
			if (prefix) {
				var interval = Interval.match(prefix) || Interval.matchRange(prefix) || Interval.matchSymbol(prefix);
				if (interval) {
					$scope.interval = interval;
					// $scope.range = prefix; // doesn't handle OR constraints
				}
			}
			return {
				id : $scope.settings.id,
				type : 'timeline',
				key_field : $scope.settings.key_field,
				field : $scope.settings.field,
				unit : $scope.settings.unit,
				interval : $scope.interval.name,
				range : $scope.range,
				filter : $scope.settings.filter
			};
		};
		$scope.refresh = function(options, settings) {
			$scope.init();
			$scope.search([ $.extend($scope.params(), options, settings) ], function(result, resultB) {
				$.extend($scope, options);
				$.extend($scope.settings, settings);
				$scope.$broadcast('settings'); // notify nested widget
				$scope.update(null, result, resultB);
			});
		};
		$scope.update = function(event, result, resultB) {
			$scope.times = result[$scope.settings.id] || [];
			$scope.timesB = resultB && resultB[$scope.settings.id] || [];
			$scope.paired = isPaired($scope.times, $scope.timesB);
			$timeout($scope.draw, 1); // delay for correct width
		};
		/**
		 * Returns true if the two arrays contain an object with the same "time" properties and non-zero "count" properties.
		 */
		function isPaired(a, b) {
			for (var i = 0, j = 0; b && i < a.length && j < b.length;) {
				if (a[i].time === b[j].time) {
					if (a[i].count * b[j].count === 0) {
						++i;
						++j;
					} else {
						return true;
					}
				} else if (a[i].time < b[j].time) {
					++i;
				} else if (a[i].time > b[j].time) {
					++j;
				}
			}
			return false;
		}
		function toRanges(times) {
			var ranges = [];
			var begin = null;
			var end = null;
			var length = 0;
			$.each(times, function(i, time) {
				if (time.count > 0) {
					begin = begin || time.value;
					++length;
				} else {
					if (begin !== null) {
						ranges.push(length === 1 ? begin : '[' + begin + '..' + time.value + ')');
						begin = null;
						length = 0;
					}
				}
				end = time.value;
			});
			if (begin !== null) {
				ranges.push(length === 1 ? begin : '[' + begin + '..' + end + ']');
			}
			return ranges;
		}
		$scope.filters = {
				thisYear : function() {
					filter(moment().format('YYYY'));
				},
				lastYear : function() {
					filter(moment().subtract(1, 'years').format('YYYY'));
				},
				thisMonth : function() {
					filter(moment().format('YYYY-MM'));
				},
				lastMonth : function() {
					filter(moment().subtract(1, 'months').format('YYYY-MM'));
				},
				lastMonths : function(n) {
					filter('[' + moment().subtract(n, 'months').format('YYYY-MM') + '..' + moment().format('YYYY-MM') + ')');
				},
				thisWeek : function() {
					filter(moment().format('GGGG-[W]WW'));
				},
				lastWeek : function() {
					filter(moment().subtract(1, 'weeks').format('GGGG-[W]WW'));
				},
				today : function() {
					filter(moment().format('YYYY-MM-DD'));
				},
				yesterday : function() {
					filter(moment().subtract(1, 'days').format('YYYY-MM-DD'));
				},
				lastHours : function(n) {
					filter('[-' + n + 'h..*)');
				},
				select : function(offset) {
					var times = [];
					for (var i = 0; i < $scope.times.length; ++i) {
						if (i + offset >= 0 && i + offset < $scope.times.length) {
							times.push({
								value : $scope.times[i + offset].label,
								count : $scope.times[i].count
							});
						}
					}
					var ranges = toRanges(times);
					if (ranges.length) {
						filter(ranges.join(' OR '));
					}
				}
		};
		$scope.snapshot = function() {
			$scope.$broadcast('snapshot');
		};
		$scope.toSpreadsheet = function() {
			var header = $scope.settings.statistic + '_' + $scope.settings.field;
			if ($scope.settings.unit) {
				header += '_' + $scope.settings.unit;
			}
			var spreadsheet = new Spreadsheet([ $scope.interval.name, header ]);
			var field = Field.find($scope.settings.field);
			$.each($scope.times, function(i, time) {
				var value = time[$scope.settings.statistic || 'count'];
				spreadsheet.addRecord([ time.label, angular.isDefined(value) ? field.toNumber(value) : '' ]);
			});
			if ($scope.timesB && $scope.timesB.length) {
				spreadsheet.addHeader(header);
				$.each($scope.timesB, function(i, time) {
					var value = time[$scope.settings.statistic || 'count'];
					spreadsheet.mergeRecord([ time.label, angular.isDefined(value) ? field.toNumber(value) : '' ]);
				});
			}
			return spreadsheet;
		};
		$scope.draw = function() {
			if ($scope.times && $scope.times.length || $scope.timesB && $scope.timesB.length) {
				var type = $scope.settings.statistic === 'count' || $scope.settings.statistic === 'sum' ? 'column' : 'line';
				var field = Field.find($scope.settings.field);
				var options = {
					chart : {
						animation : false,
						zoomType : 'x',
						events : {
							selection : function(event) {
								var from = null;
								var to = null;
								$.each($scope.times, function(i, time) {
									from = from || time.label;
									to = time.label;
								});
								$.each($scope.times, function(i, time) {
									if (time.time >= event.xAxis[0].min) {
										from = time.label;
										return false;
									}
								});
								$.each($scope.times, function(i, time) {
									if (time.time <= event.xAxis[0].max) {
										to = time.label;
									}
								});
								if (from !== null && to !== null) {
									var range = from === to ? from : '[' + from + '..' + to + ']';
									$scope.$apply(function() {
										filter(range);
									});
								}
								return false;
							}
						}
					},
					title : {
						text : null
					},
					xAxis : {
						type : 'datetime',
						labels : {
							overflow : 'justify'
						},
						minTickInterval : $scope.interval.minTickInterval,
						tickLength : 5,
						tickWidth : 1,
						lineWidth : 1,
						gridLineWidth : 0
					},
					yAxis : {
						title : {
							text : null
						},
						tickLength : 5,
						tickWidth : 1,
						lineWidth : 0,
						gridLineWidth : 0,
						startOnTick : false,
						floor : field.minValue,
						ceiling : field.maxValue
					},
					tooltip : {
						crosshairs : false,
						shared : false,
						hideDelay : 0
					},
					series : [{
						name : $scope.settings.statistic || 'count',
						type : type,
						data : [],
						color: 'rgba(47, 126, 216, 0.4)',
						lineColor: 'rgb(47, 126, 216)',
						marker : {
							symbol : 'circle',
							fillColor : 'white',
							lineWidth : 2,
							lineColor: 'rgb(47, 126, 216)'
						},
						borderRadius : 5,
						borderWidth : 2,
						zIndex: 1
					}, {
						name : 'range',
						data : [],
						type : 'arearange',
						lineWidth : 0,
						linkedTo : ':previous',
						fillColor : 'rgba(47, 126, 216, 0.1)',
						zIndex: 0
					}],
					plotOptions : {
						series : {
							animation : false,
							tooltip : {
								headerFormat : '<b>{point.key}:</b> ',
								pointFormat : "{point.tooltip}"
							}
						}
					},
					legend : {
						enabled : false
					},
					credits : {
						enabled : false
					},
					playable : true
				};
				if ($scope.interval != Interval.VALUES[Interval.VALUES.length - 1]) {
					options.plotOptions.series.cursor = 'pointer';
					options.plotOptions.series.events = {
						click : function(event) {
							$scope.$apply(function() {
								filter(event.point.options.filter);
							});
						}
					};
				}
				if ($scope.settings.placement === 'top') {
					options.chart.height = 150;
				}
				$.each($scope.times, function(i, time) {
					var value = time[$scope.settings.statistic || 'count'];
					if (value !== undefined) {
						options.series[0].data.push({ x : time.time, y : field.toNumber(value), filter : time.label, tooltip : field.toText(value) });
						if ($scope.settings.statistic === 'avg') {
							options.series[1].data.push({
								x : time.time,
								low : field.toNumber(time['min']),
								high : field.toNumber(time['max']),
								filter : time.label,
								tooltip : field.toText(time['min']) + '..' + field.toText(time['max'])
							});
						}
					} else {
						options.series[0].data.push({ x : time.time, y : null });
						if ($scope.settings.statistic === 'avg') {
							options.series[1].data.push({
								x : time.time,
								low : null,
								high : null
							});
						}
					}
				});
				if ($scope.timesB && $scope.timesB.length) {
					options.series.push({
						name : $scope.settings.statistic || 'count',
						type : type,
						data : [],
						color: 'rgba(204, 102, 0, 0.4)',
						lineColor : 'rgb(204, 102, 0)',
						marker : {
							symbol : 'circle',
							fillColor : 'white',
							lineWidth : 2,
							lineColor: 'rgb(204, 102, 0)'
						},
						borderRadius : 5,
						borderWidth : 2,
						zIndex: 1
					});
					options.series.push({
						name : 'range',
						data : [],
						type : 'arearange',
						lineWidth : 0,
						linkedTo : ':previous',
						fillColor : 'rgba(204, 102, 0, 0.1)',
						zIndex: 0
					});
					$.each($scope.timesB, function(i, time) {
						var value = time[$scope.settings.statistic || 'count'];
						if (value !== undefined) {
							options.series[2].data.push({ x : time.time, y : field.toNumber(value), filter : time.label, tooltip : field.toText(value) });
							if ($scope.settings.statistic === 'avg') {
								options.series[3].data.push([ time.time, field.toNumber(time['min']), field.toNumber(time['max']) ]);
							}
						} else {
							options.series[2].data.push({ x : time.time, y : null });
							if ($scope.settings.statistic === 'avg') {
								options.series[3].data.push([ time.time, null, null ]);
							}
						}
					});
				}
				if ($scope.times.length > 1 && $scope.settings.regression == 'linear') {
					var regression = statistics.regression(toXY($scope.times));
					if (regression) {
						options.series.push({
							type : 'line',
							data : regression.data,
							color : 'rgb(119, 152, 191)',
							dashStyle : 'Dot',
							lineWidth : 2,
							enableMouseTracking : false,
							marker : {
								enabled : false
							}
						});
					}
				}
				if ($scope.timesB && $scope.timesB.length > 1 && $scope.settings.regression == 'linear') {
					var regressionB = statistics.regression(toXY($scope.timesB));
					if (regressionB) {
						options.series.push({
							type : 'line',
							data : regressionB.data,
							color : 'rgb(204, 102, 0)',
							dashStyle : 'Dot',
							lineWidth : 2,
							enableMouseTracking : false,
							marker : {
								enabled : false
							}
						});
					}
				}
				field.formatAxis(options.yAxis);
				$scope.chartOptions = options;
			}
		};
		function toXY(times) {
			var xy = [];
			var field = Field.find($scope.settings.field);
			$.each(times, function(i, time) {
				var value = time[$scope.settings.statistic || 'count'];
				if (value !== undefined) {
					xy.push([ time.time, field.toNumber(value) ]);
				}
			});
			return xy;
		}

		$scope.init();
		$scope.register($scope);
		$scope.$on('result', $scope.update);
		$scope.$on('refresh', $scope.init);
	}]);

	app.controller('EffectSizeWidgetController', ['$scope', '$timeout', 'Field', function($scope, $timeout, Field) {

		$scope.init = function() {
			$scope.stats = null;
			$scope.statsB = null;
		};
		function shouldRequestStats() {
			return $scope.constraintsB && $scope.settings.statistic === 'avg';
		}
		$scope.params = function() {
			return shouldRequestStats() ? {
				id : $scope.settings.id + '-stats',
				type : 'stats',
				field : $scope.settings.field,
				unit : $scope.settings.unit,
				filter : $scope.settings.filter
			} : null;
		};
		$scope.refresh = function(options, settings) {
			$scope.init();
			if (shouldRequestStats()) {
				$scope.search([ $.extend($scope.params(), options, settings) ], function(result, resultB) {
					$scope.update(null, result, resultB);
				});
			} else {
				$scope.$evalAsync($scope.update);
			}
		};
		$scope.update = function(event, result, resultB) {
			if ($scope.settings.statistic === 'avg') {
				$scope.stats = result[$scope.settings.id + '-stats'];
				$scope.statsB = resultB && resultB[$scope.settings.id + '-stats'];
			} else {
				$scope.stats = stats($scope.times);
				$scope.statsB = stats($scope.timesB);
			}
			$timeout($scope.draw, 1); // delay for correct width
		};
		function stats(times) {
			var field = Field.find($scope.settings.field);
			var values = toNumbers(times, field);
			if (!values.length) {
				return null;
			}
			var r = { avg : 0, stdev : 0, count : values.length }, variance = 0;
			for (var m, s = 0, l = r.count; l--; s += values[l]);
			for (m = r.avg = s / r.count, l = r.count, s = 0; l--; s += Math.pow(values[l] - m, 2));
			r.stdev = toObject(Math.sqrt(variance = s / r.count));
			r.avg = toObject(r.avg);
			return r;
		}
		function toNumbers(items, field) {
			var numbers = $.map(items, function(item) {
				return field.toNumber(item[$scope.settings.statistic || 'count']);
			});
			return $.grep(numbers, function(number) {
				return !isNaN(number);
			});
		}
		function toObject(number) {
			return $scope.settings.unit ? { '@value' : number, 'unit' : $scope.settings.unit } : number;
		}
		$scope.draw = function() {
			if ($scope.stats && $scope.stats.avg !== undefined && $scope.statsB && $scope.statsB.avg !== undefined) {
				var field = Field.find($scope.settings.field);
				var avgA = field.toNumber($scope.stats.avg);
				var avgB = field.toNumber($scope.statsB.avg);
				var avgAB = avgB - avgA;
				var z = 1.96;
				var stdevA = field.toNumber($scope.stats.stdev);
				var stdevB = field.toNumber($scope.statsB.stdev);
				var nA = $scope.stats.count;
				var nB = $scope.statsB.count;

				var d = z * Math.sqrt((stdevA * stdevA / nA) + (stdevB * stdevB / nB));
				var lower = avgAB - d;
				var upper = avgAB + d;

				var color;
				if (lower <= 0 && upper >= 0) {
					color = '#C0C0C0'; // light-gray
				} else {
					color = '#555'; // dark-gray
				}

				var rChartOptions = {
					chart : {
						type : 'line',
						inverted : true,
						height : 75,
						plotBorderWidth : 1,
						plotBackgroundColor : '#fafafa',
						marginLeft : 45,
						marginRight : 25,
						animation : false
					},
					title : {
						text : null
					},
					xAxis : {
						title : {
							text : null
						},
						labels : {
							enabled : false
						},
						lineWidth : 0,
						tickLength : 0
					},
					yAxis : {
						title : {
							text : null
						},
						labels : {
							autoRotation : false
						},
						lineWidth : 0,
						tickColor : '#C0C0C0',
						tickWidth : 1,
						tickLength : 5,
						tickPosition : 'inside',
						gridLineWidth : 0
					},
					tooltip : {
						enabled : false
					},
					series : [{
						data : [[ 0, avgAB ]],
						color : color,
						animation : false,
						marker : {
							radius : 5,
							symbol : 'circle'
						},
						states : {
							hover : {
								enabled : false
							}
						}
					}],
					legend : {
						enabled : false
					},
					credits : {
						enabled : false
					}
				};
				if (d > 0) {
					rChartOptions.series.push({
						type : 'errorbar',
						data : [[ 0, avgAB - d, avgAB + d ]],
						lineWidth : 2,
						color : color,
						animation : false,
						states : {
							hover : {
								enabled : false
							}
						}
					});
				}
				field.formatAxis(rChartOptions.yAxis);
				$scope.rChartOptions = rChartOptions;
			}
		};

		$scope.init();
		$scope.register($scope, true);
		$scope.$on('result', $scope.update);
		$scope.$on('refresh', $scope.init);
		$scope.$on('settings', function() {
			$scope.refresh();
		});
	}]);

	app.controller('TimelineWidgetDialogController', ['$scope', 'WidgetDialogControllerSupport', 'Field', 'Interval', function($scope, WidgetDialogControllerSupport, Field, Interval) {

		new WidgetDialogControllerSupport($scope);

		$scope.regressionMethods = [ 'linear' ];

		function isUnitValid() {
			var units = $scope.getUnits();
			return units.length === 0 ?
					$scope.settings.unit === null :
					$.inArray($scope.settings.unit, units) != -1;
		}
		function isStatisticValid() {
			return $.grep($scope.getStatistics($scope.settings.field), function(statistic) {
				return $scope.settings.statistic === statistic;
			}).length > 0;
		}

		$scope.init = function() {
			$scope.settings = angular.copy($scope.$parent.settings);
			$scope.settings.interval = $scope.settings.interval || Interval.VALUES[1].name;
		};
		$scope.getFields = function() {
			var fields = Field.findByType('numeric');
			fields.unshift(Field.find($scope.keyField));
			return fields;
		};
		$scope.getStatistics = function(field) {
			return field === $scope.keyField ? [ 'count' ] : [ 'sum', 'avg', 'min', 'max' ];
		};
		$scope.getUnits = function() {
			return Field.find($scope.settings.field).units || [];
		};
		$scope.subfields = $.map(Field.find($scope.keyField).subfields, function(subfield) {
			return { label : subfield, value : (subfield ? $scope.keyField + '$' + subfield : $scope.keyField) };
		});
		$scope.getIntervals = function() {
			return Interval.VALUES;
		};
		$scope.valid = function() {
			return isUnitValid() && isStatisticValid();
		};

		$scope.$watch('settings.field', function() {
			if (!isUnitValid()) {
				$scope.settings.unit = null;
			}
			if (!isStatisticValid()) {
				$scope.settings.statistic = $scope.getStatistics($scope.settings.field)[0];
			}
		});
	}]);

	app.controller('PolarWidgetController', ['$scope', '$timeout', 'Field', 'Spreadsheet', function($scope, $timeout, Field, Spreadsheet) {

		$scope.keyField = 'timestamp';

		/**
		 * Based on https://stackoverflow.com/a/18070247/1144085
		 */
		function circular_avg(data) {
			var f = 2 * Math.PI / data.length; // factor for converting keys to radians
			var x = 0;
			var y = 0;
			$.each(data, function(i, time) {
				x += time.count * Math.sin(f * i);
				y += time.count * Math.cos(f * i);
			});
			var z = Math.atan2(x, y);
			if (z < 0) {
				z += 2 * Math.PI;
			}
			return (Math.round(z / f * 2) / 2) % data.length; // modulo and round to 0.5
		}

		function addPlotBand(chartOptions, value, max, color) {
			chartOptions.xAxis.plotBands.push({
				color : color,
				from: value - 0.5,
				to : value + 0.5
			});
			if (value - 0.5 < 0) {
				chartOptions.xAxis.plotBands.push({
					color : color,
					from: max - 0.5,
					to : max
				});
			}
		}

		$scope.init = function() {
			$scope.times = null;
			$scope.timesB = null;
			$scope.settings.key_field = $scope.settings.key_field || $scope.keyField;
		};
		$scope.params = function() {
			return {
				id : $scope.settings.id,
				type : 'polar',
				key_field : $scope.settings.key_field,
				value_field : $scope.settings.value_field,
				unit : $scope.settings.unit,
				interval : $scope.settings.interval,
				filter : $scope.settings.filter
			};
		};
		$scope.refresh = function(options, settings) {
			$scope.init();
			$scope.search([ $.extend($scope.params(), options, settings) ], function(result, resultB) {
				$.extend($scope, options);
				$.extend($scope.settings, settings);
				$scope.update(null, result, resultB);
			});
		};
		$scope.update = function(event, result, resultB) {
			$scope.times = result[$scope.settings.id] || [];
			$scope.timesB = resultB && resultB[$scope.settings.id] || [];
			$timeout($scope.draw, 0); // delay for correct width
		};
		$scope.filter = function(value, negated) {
			$scope.addConstraint($scope.settings.key_field + '.' + $scope.settings.interval, value, true, negated);
		};
		$scope.snapshot = function() {
			$scope.$broadcast('snapshot');
		};
		$scope.toSpreadsheet = function() {
			var header = $scope.settings.statistic + '_' + $scope.settings.value_field;
			if ($scope.settings.unit) {
				header += '_' + $scope.settings.unit;
			}
			var spreadsheet = new Spreadsheet([ $scope.settings.interval, header ]);
			var field = Field.find($scope.settings.value_field);
			$.each($scope.times, function(i, time) {
				var value = time[$scope.settings.statistic || 'count'];
				spreadsheet.addRecord([ time.value, angular.isDefined(value) ? field.toNumber(value) : '' ]);
			});
			if ($scope.timesB && $scope.timesB.length) {
				spreadsheet.addHeader(header);
				$.each($scope.timesB, function(i, time) {
					var value = time[$scope.settings.statistic || 'count'];
					spreadsheet.mergeRecord([ time.value, angular.isDefined(value) ? field.toNumber(value) : '' ]);
				});
			}
			return spreadsheet;
		};
		$scope.draw = function() {
			if ($scope.times && $scope.times.length || $scope.timesB && $scope.timesB.length) {
				var field = Field.find($scope.settings.value_field);
				var options = {
					chart : {
						type : 'column',
						polar: true,
						animation : false
					},
					title : {
						text : null
					},
					xAxis : {
						categories : [],
						plotBands: []
					},
					yAxis : {
						title : {
							text : null
						},
						floor : field.minValue,
						ceiling : field.maxValue
					},
					tooltip : {
						shared : false,
						hideDelay : 0,
						formatter : function() {
							return '<b>' + this.x + '</b>: ' + (field.toText(this.y) || this.y) + ($scope.settings.unit || '');
						}
					},
					series : [{
						name : $scope.settings.statistic || 'count',
						data : []
					}],
					plotOptions : {
						series : {
							color : 'rgba(47, 126, 216, 0.4)',
							animation : false,
							pointPlacement: 'on',
							cursor : 'pointer',
							events : {
								click : function(event) {
									$scope.$apply(function() {
										$scope.filter($scope.times[event.point.x].value);
									});
								}
							}
						},
						column : {
							pointPadding: 0,
							groupPadding: 0
						}
					},
					legend : {
						enabled : false
					},
					credits: {
						enabled: false
					}
				};
				if ($scope.settings.mark === 'avg') {
					addPlotBand(options, circular_avg($scope.times), $scope.times.length, 'rgba(47, 126, 216, 0.2)');
				}
				if ($scope.settings.placement === 'top') {
					options.chart.height = 150;
				}
				$.each($scope.times, function(i, time) {
					var value = time[$scope.settings.statistic || 'count'];
					options.xAxis.categories.push(time.label);
					options.series[0].data.push(value !== undefined ? field.toNumber(value) : 0);
				});
				if ($scope.timesB && $scope.timesB.length) {
					options.series.push({
						name : $scope.settings.statistic || 'count',
						data : [],
						color: 'rgba(204, 102, 0, 0.4)',
						events : {
							click : function(event) {
								$scope.$apply(function() {
									$scope.filter($scope.timesB[event.point.x].value);
								});
							}
						}
					});
					$.each($scope.timesB, function(i, time) {
						var value = time[$scope.settings.statistic || 'count'];
						options.xAxis.categories.push(time.label);
						options.series[1].data.push(value !== undefined ? field.toNumber(value) : 0);
					});
					if ($scope.settings.mark === 'avg') {
						addPlotBand(options, circular_avg($scope.timesB), $scope.timesB.length, 'rgba(204, 102, 0, 0.2)');
					}
				}
				field.formatAxis(options.yAxis);
				$scope.chartOptions = options;
			}
		};

		$scope.init();
		$scope.register($scope);
		$scope.$on('result', $scope.update);
		$scope.$on('refresh', $scope.init);
	}]);

	app.controller('PolarWidgetDialogController', ['$scope', 'WidgetDialogControllerSupport', 'Field', function($scope, WidgetDialogControllerSupport, Field) {

		new WidgetDialogControllerSupport($scope);

		$scope.intervals = [
			{ id : 'hour_of_day', label : 'hour of day' },
			{ id : 'day_of_week', label : 'day of week' },
			{ id : 'day_of_month', label : 'day of month' },
			{ id : 'month_of_year', label : 'month of year' }
		];

		function isUnitValid() {
			var units = $scope.getUnits();
			return units.length === 0 ?
				$scope.settings.unit === null :
				$.inArray($scope.settings.unit, units) != -1;
		}
		function isStatisticValid() {
			return $.grep($scope.getStatistics($scope.settings.value_field), function(statistic) {
				return $scope.settings.statistic === statistic;
			}).length > 0;
		}

		$scope.subfields = $.map(Field.find($scope.keyField).subfields, function(subfield) {
			return { label : subfield, value : (subfield ? $scope.keyField + '$' + subfield : $scope.keyField) };
		});
		$scope.getFields = function() {
			var fields = Field.findByType('numeric');
			fields.unshift(Field.find($scope.keyField));
			return fields;
		};
		$scope.getStatistics = function(field) {
			return field === $scope.keyField ? [ 'count' ] : [ 'sum', 'avg', 'min', 'max' ];
		};
		$scope.getUnits = function() {
			var valueField = Field.find($scope.settings.value_field);
			return valueField ? valueField.units : [];
		};
		$scope.getIntervals = function() {
			return Interval.VALUES;
		};
		$scope.valid = function() {
			return isUnitValid() && isStatisticValid();
		};

		$scope.$watch('settings.value_field', function() {
			if (!isUnitValid()) {
				$scope.settings.unit = null;
			}
			if (!isStatisticValid()) {
				$scope.settings.statistic = $scope.getStatistics($scope.settings.value_field)[0];
			}
		});
	}]);


	/**
	 * Based on https://github.com/virtualstaticvoid/highcharts_trendline
	 */
	app.factory('statistics', function() {

		function regression(X, Y) {
			var N = X.length;
			var SX = 0;
			var SY = 0;
			var SXX = 0;
			var SXY = 0;
			var SYY = 0;
			for (var i = 0; i < N; ++i) {
				SX = SX + X[i];
				SY = SY + Y[i];
				SXY = SXY + X[i] * Y[i];
				SXX = SXX + X[i] * X[i];
				SYY = SYY + Y[i] * Y[i];
			}
			var slope = (N * SXY - SX * SY) / (N * SXX - SX * SX);
			var intercept = (SY - slope * SX) / N;
			return {
				slope : slope,
				intercept : intercept
			};
		}

		function pearson(x, y) {

			console.assert(x.length == y.length, 'expected arrays with same length');

			var n = x.length;
			var xy = [];
			var x2 = [];
			var y2 = [];

			for (var i = 0; i < n; ++i) {
				xy.push(x[i] * y[i]);
				x2.push(x[i] * x[i]);
				y2.push(y[i] * y[i]);
			}

			var sum_x = 0;
			var sum_y = 0;
			var sum_xy = 0;
			var sum_x2 = 0;
			var sum_y2 = 0;

			for (i = 0; i < n; ++i) {
				sum_x += x[i];
				sum_y += y[i];
				sum_xy += xy[i];
				sum_x2 += x2[i];
				sum_y2 += y2[i];
			}

			var step1 = (n * sum_xy) - (sum_x * sum_y);
			var step2 = (n * sum_x2) - (sum_x * sum_x);
			var step3 = (n * sum_y2) - (sum_y * sum_y);
			var step4 = Math.sqrt(step2 * step3);
			var answer = step1 / step4;

			return answer;
		}

		function rank(x) {
			var ranked = [];
			$.each(x, function(i, a) {
				var rank = 1;
				var freq = 0;
				$.each(x, function(j, b) {
					if (b > a) {
						++rank;
					} else if (b == a) {
						++freq;
					}
				});
				if (freq > 1) {
					rank = (freq * (2 * rank + freq - 1)) / (2 * freq); // derived from sum of arithmetic sequence formula
				}
				ranked.push(rank);
			});
			return ranked;
		}

		function tanh(x) {
			var e = Math.exp(2 * x);
			return (e - 1) / (e + 1);
		}

		function atanh(x) {
			return 0.5 * (log1p(x) - log1p(-x));
		}

		/**
		 * Computes log(1 + x) accurately for small values of x.
		 * Based on http://phpjs.org/functions/log1p/.
		 */
		function log1p(x) {
			if (x <= -1) {
				return Number.NEGATIVE_INFINITY;
			}
			if (x < 0 || x > 1) {
				return Math.log(1 + x);
			}
			var value = 0;
			var precision = 50;
			for (var i = 1; i < precision; ++i) {
				if ((i % 2) === 0) {
					value -= Math.pow(x, i) / i;
				} else {
					value += Math.pow(x, i) / i;
				}
			}
			return value;
		}

		/**
		 * Computes the 95% confidence interval for a correlation coefficient.
		 * Based on https://stats.stackexchange.com/a/18904.
		 */
		function confidence(r, n) {
			console.assert(n > 3, 'not enough samples');
			var stderr = 1.0 / Math.sqrt(n - 3);
			var delta = 1.96 * stderr;
			var lower = tanh(atanh(r) - delta);
			var upper = tanh(atanh(r) + delta);
			return [ lower, upper ];
		}

		return {
			regression : function(data) {
				var x = [];
				var y = [];
				var min = 0;
				var max = 0;
				var i = 0;
				for (; i < data.length; ++i) {
					x.push(data[i][0]);
					y.push(data[i][1]);
					if (data[i][0] > data[max][0]) {
						max = i;
					}
					if (data[i][0] < data[min][0]) {
						min = i;
					}
				}
				var params = regression(x, y);
				return !isNaN(params.slope) ? {
					data : [
						[x[min], params.slope * x[min] + params.intercept],
						[x[max], params.slope * x[max] + params.intercept]
					],
					slope : params.slope,
					intercept : params.intercept
				} : null;
			},
			correlate : function(data, ranked) {
				var x = [];
				var y = [];
				var i = 0;
				for (; i < data.length; ++i) {
					x.push(data[i][0]);
					y.push(data[i][1]);
				}
				if (ranked) {
					x = rank(x);
					y = rank(y);
				}
				var r = pearson(x, y);
				var c = confidence(r, x.length);
				return {
					r : r,
					lower : c[0],
					upper : c[1]
				};
			}
		};
	});

	app.controller('ScatterPlotWidgetController', ['$scope', '$timeout', 'Field', 'Spreadsheet', 'timezone', 'statistics', function($scope, $timeout, Field, Spreadsheet, timezone, statistics) {

		$scope.keyField = 'timestamp';

		$scope.init = function() {
			$scope.data = null;
			$scope.settings.key_field = $scope.settings.key_field || $scope.keyField;
		};
		$scope.params = function() {
			return {
				id : $scope.settings.id,
				type : 'scatterplot',
				field_x : $scope.settings.field_x,
				unit_x : $scope.settings.unit_x,
				statistic_x : $scope.settings.statistic_x,
				filter_x : $scope.settings.filter_x,
				field_y : $scope.settings.field_y,
				unit_y : $scope.settings.unit_y,
				statistic_y : $scope.settings.statistic_y,
				filter_y : $scope.settings.filter_y,
				key_field : $scope.settings.key_field,
				interval : $scope.settings.interval,
				lag : $scope.settings.lag
			};
		};
		$scope.refresh = function(options, settings) {
			$scope.init();
			var params = $.extend($scope.params(), options, settings);
			if (/hour|minute|second/.test(params.interval)) {
				params.timezone = timezone;
			}
			$scope.search([ params ], function(result, resultB) {
				$.extend($scope, options);
				$.extend($scope.settings, settings);
				$scope.update(null, result, resultB);
			});
		};
		$scope.update = function(event, result, resultB) {
			$scope.data = result[$scope.settings.id] || [];
			$scope.dataB = resultB && resultB[$scope.settings.id] || [];
			$timeout($scope.draw, 0); // delay for correct width
		};
		$scope.snapshot = function() {
			$scope.$broadcast('snapshot');
		};
		$scope.toSpreadsheet = function() {
			function buildHeader(label, statistic, field, unit) {
				var header = label;
				if (!header) {
					header = statistic + '_' + field;
					if (unit) {
						header += '_' + unit;
					}
				}
				return header;
			}
			var compareMode = $scope.dataB && $scope.dataB.length;
			var spreadsheet = new Spreadsheet([
				buildHeader($scope.settings.label_x, $scope.settings.statistic_x, $scope.settings.field_x, $scope.settings.unit_x),
				buildHeader($scope.settings.label_y, $scope.settings.statistic_y, $scope.settings.field_y, $scope.settings.unit_y),
				compareMode ? 'dataset' : ''
			]);
			$.each($scope.data, function(i, value) {
				spreadsheet.addRecord([ value[0], value[1], compareMode ? 'a' : '' ]);
			});
			if (compareMode) {
				$.each($scope.dataB, function(i, value) {
					spreadsheet.addRecord([ value[0], value[1], 'b' ]);
				});
			}
			return spreadsheet;
		};
		$scope.draw = function() {
			function buildLabel(label, statistic, field, unit) {
				var header = label;
				if (!header) {
					header = statistic + ' of ' + field;
					if (unit) {
						header += ' (' + unit + ')';
					}
				}
				return header;
			}
			var xField = Field.find($scope.settings.field_x);
			var yField = Field.find($scope.settings.field_y);
			if ($scope.data && $scope.data.length || $scope.dataB && $scope.dataB.length) {
				var options = {
					chart : {
						type : 'scatter',
						zoomType: 'xy',
						animation : false
					},
					title : {
						text : null
					},
					xAxis : {
						title : {
							text : buildLabel($scope.settings.label_x, $scope.settings.statistic_x, $scope.settings.field_x, $scope.settings.unit_x)
						},
						tickLength : 5,
						tickWidth : 1,
						lineWidth : 0,
						gridLineWidth : 0,
						startOnTick : false,
						floor : xField.minValue,
						ceiling : xField.maxValue
					},
					yAxis : {
						title : {
							text : buildLabel($scope.settings.label_y, $scope.settings.statistic_y, $scope.settings.field_y, $scope.settings.unit_y)
						},
						tickLength : 5,
						tickWidth : 1,
						lineWidth : 0,
						gridLineWidth : 0,
						startOnTick : false,
						floor : yField.minValue,
						ceiling : yField.maxValue
					},
					tooltip : {
						crosshairs : false,
						shared : false,
						hideDelay : 0,
						formatter : function() {
							return '<b>x</b>: ' + (xField.toText(this.x) || this.x) + ($scope.settings.unit_x || '') + ', ' +
								'<b>y</b>: ' + (yField.toText(this.y) || this.y) + ($scope.settings.unit_y || '');
						}
					},
					series : [{
						data : $scope.data,
						animation : false,
						color : 'rgba(119, 152, 191, 0.5)',
						allowPointSelect : true,
						marker : {
							radius : 5,
							symbol : 'circle'
						}
					}],
					plotOptions : {
						series : {
							animation : false,
							stickyTracking : false
						}
					},
					legend: {
						enabled: false
					},
					credits: {
						enabled: false
					}
				};
				if ($scope.dataB && $scope.dataB.length) {
					options.series.push({
						data : $scope.dataB,
						animation : false,
						color : 'rgba(204, 102, 0, 0.5)',
						allowPointSelect : true,
						marker : {
							radius : 5,
							symbol : 'circle'
						}
					});
				}
				if ($scope.data.length > 1 && $scope.settings.regression == 'linear') {
					var regression = statistics.regression($scope.data);
					if (regression) {
						options.series.push({
							type : 'line',
							data : regression.data,
							color : 'rgb(119, 152, 191)',
							dashStyle : 'Dot',
							lineWidth : 2,
							enableMouseTracking : false,
							marker : {
								enabled : false
							}
						});
					}
				}
				if ($scope.dataB && $scope.dataB.length > 1 && $scope.settings.regression == 'linear') {
					var regressionB = statistics.regression($scope.dataB);
					if (regressionB) {
						options.series.push({
							type : 'line',
							data : regressionB.data,
							color : 'rgb(204, 102, 0)',
							dashStyle : 'Dot',
							lineWidth : 2,
							enableMouseTracking : false,
							marker : {
								enabled : false
							}
						});
					}
				}
				if ($scope.data.length > 3 || $scope.dataB.length > 3) {
					var rChartOptions = {
						chart : {
							type : 'line',
							inverted : true,
							height : 75,
							plotBorderWidth : 1,
							plotBackgroundColor : '#fafafa',
							marginLeft : 65,
							animation : false
						},
						title : {
							text : null
						},
						xAxis : {
							title : {
								text : null
							},
							labels : {
								enabled : false
							},
							lineWidth : 0,
							tickLength : 0
						},
						yAxis : {
							title : {
								text : null
							},
							max : 1.0,
							min : -1.0,
							lineWidth : 0,
							tickInterval : 1.0,
							tickWidth : 0,
							gridLineWidth : 1
						},
						tooltip : {
							shared : true,
							hideDelay : 0
						},
						series : [],
						legend : {
							enabled : false
						},
						credits : {
							enabled : false
						}
					};
					if ($scope.data && $scope.data.length > 3) {
						var correlation = statistics.correlate($scope.data, true);
						rChartOptions.series.push({
							data : [[ 0, correlation.r ]],
							color : 'rgb(119, 152, 191)',
							animation : false,
							marker : {
								radius : 5,
								symbol : 'circle'
							},
							tooltip : {
								headerFormat : '',
								pointFormat : "<b>Spearman's rho:</b> {point.y}<br/>",
								valueDecimals : 3
							},
							states : {
								hover : {
									enabled : false
								}
							}
						});
						rChartOptions.series.push({
							type : 'errorbar',
							data : [[ 0, correlation.lower, correlation.upper ]],
							lineWidth : 2,
							color : 'rgb(119, 152, 191)',
							animation : false,
							tooltip : {
								headerFormat : '',
								pointFormat : '<b>95% confidence interval:</b> [' + correlation.lower.toFixed(3) + '..' + correlation.upper.toFixed(3) + ']<br/>'
							}
						});
					}
					if ($scope.dataB && $scope.dataB.length > 3) {
						var correlationB = statistics.correlate($scope.dataB, true);
						rChartOptions.series.push({
							data : [[ 1, correlationB.r ]],
							color : 'rgb(204, 102, 0)',
							animation : false,
							marker : {
								radius : 5,
								symbol : 'circle'
							},
							tooltip : {
								headerFormat : '',
								pointFormat : "<b>Spearman's rho:</b> {point.y}<br/>",
								valueDecimals : 3
							},
							states : {
								hover : {
									enabled : false
								}
							}
						});
						rChartOptions.series.push({
							type : 'errorbar',
							data : [[ 1, correlationB.lower, correlationB.upper ]],
							lineWidth : 2,
							color : 'rgb(204, 102, 0)',
							animation : false,
							tooltip : {
								headerFormat : '',
								pointFormat : '<b>95% confidence interval:</b> [' + correlationB.lower.toFixed(3) + '..' + correlationB.upper.toFixed(3) + ']<br/>'
							}
						});
					}
					$scope.rChartOptions = rChartOptions;
				}
				if ($scope.settings.placement === 'top') {
					options.chart.height = 150;
				}
				xField.formatAxis(options.xAxis);
				yField.formatAxis(options.yAxis);
				$scope.chartOptions = options;
			}
		};

		$scope.init();
		$scope.register($scope);
		$scope.$on('result', $scope.update);
		$scope.$on('refresh', $scope.init);
	}]);

	app.controller('ScatterPlotWidgetDialogController', ['$scope', 'WidgetDialogControllerSupport', 'Field', 'Interval', function($scope, WidgetDialogControllerSupport, Field, Interval) {

		new WidgetDialogControllerSupport($scope);

		var keyField = Field.find('timestamp');

		function isUnitValid(field, unit) {
			var units = $scope.getUnits(field);
			return units.length === 0 ?
				unit === null :
				$.inArray(unit, units) != -1;
		}

		$scope.regressionMethods = [ 'linear' ];

		$scope.getFields = function() {
			var fields = Field.findByType('numeric');
			fields.unshift(keyField);
			return fields;
		};
		$scope.subfields = $.map(Field.find($scope.keyField).subfields, function(subfield) {
			return { label : subfield, value : (subfield ? $scope.keyField + '$' + subfield : $scope.keyField) };
		});
		$scope.getIntervals = function() {
			return Interval.VALUES;
		};
		$scope.getStatistics = function(field) {
			return field === keyField.name ? [ 'count' ] : [ 'sum', 'avg', 'min', 'max' ];
		};
		$scope.getUnits = function(field) {
			return field && Field.find(field).units || [];
		};
		$scope.valid = function() {
			return isUnitValid($scope.settings.field_x, $scope.settings.unit_x) &&
				isUnitValid($scope.settings.field_y, $scope.settings.unit_y);
		};
		$scope.swap = function() {
			function swap(object, p1, p2) {
				var tmp = object[p1];
				object[p1] = object[p2];
				object[p2] = tmp;
			}
			swap($scope.settings, 'label_x', 'label_y');
			swap($scope.settings, 'statistic_x', 'statistic_y');
			swap($scope.settings, 'field_x', 'field_y');
			swap($scope.settings, 'unit_x', 'unit_y');
			swap($scope.settings, 'filter_x', 'filter_y');
			if ($scope.settings.lag) {
				$scope.settings.lag = -$scope.settings.lag;
			}
		};

		$scope.$watch('settings.field_x', function() {
			if (!isUnitValid($scope.settings.field_x, $scope.settings.unit_x)) {
				$scope.settings.unit_x = null;
			}
		});
		$scope.$watch('settings.field_y', function() {
			if (!isUnitValid($scope.settings.field_y, $scope.settings.unit_y)) {
				$scope.settings.unit_y = null;
			}
		});
	}]);

	app.controller('MapWidgetController', ['$scope', '$timeout', function($scope, $timeout) {

		$scope.field = 'location';

		$scope.init = function() {
			$scope.map = null;
			$scope.points = null;
			$scope.pointsB = null;
			$scope.bounds = null;
			$scope.boundsB = null;
			$scope.markers = [];
			$scope.factor = 1.0;
			$scope.shown = false;
		};
		function params(settings) {
			if (settings) {
				var filters = [];
				if (settings.filter) {
					filters.push(settings.filter);
				}
				return {
					id : settings.id,
					type : 'geobounds',
					filter : filters.join('|')
				};
			}
		}
		$scope.params = function() {
			return params($scope.settings);
		};
		$scope.refresh = function(options, settings) {
			$scope.init();
			$scope.search([ $.extend(params($scope.settings), params(settings)) ], function(result, resultB) {
				$.extend($scope, options);
				$.extend($scope.settings, settings);
				$scope.update(null, result, resultB);
			});
		};
		$scope.update = function(event, result, resultB) {
			$scope.bounds = toBounds(result[$scope.settings.id] || {});
			$scope.boundsB = toBounds(resultB && resultB[$scope.settings.id] || {});
			$timeout($scope.draw, 1); // delay for correct width
		};
		function toBounds(result) {
			var bounds;
			if (angular.isDefined(result.lat_min)) {
				var sw = new google.maps.LatLng(result.lat_min, result.lon_min);
				var ne = new google.maps.LatLng(result.lat_max, result.lon_max);
				bounds = new google.maps.LatLngBounds(sw, ne);
			} else {
				bounds = new google.maps.LatLngBounds();
			}
			return bounds;
		}
		var boundsUpdate;
		$scope.draw = function() {
			if (!$scope.bounds.isEmpty() || !$scope.boundsB.isEmpty()) {
				var options = {
					mapTypeId : google.maps.MapTypeId.ROADMAP,
					streetViewControl : false,
					mapTypeControlOptions : {
						style : google.maps.MapTypeControlStyle.DROPDOWN_MENU
					},
					styles : [ { 'stylers' : [ { 'saturation' : -100 } ] } ],
					minZoom : 1
				};
				$scope.map = new google.maps.Map(document.getElementById($scope.settings.id + '-map'), options);
				$scope.map.fitBounds($scope.bounds.union($scope.boundsB));
				google.maps.event.addListener($scope.map, 'bounds_changed', function() {
					$timeout.cancel(boundsUpdate);
					boundsUpdate = $timeout(function() {
						var bounds = $scope.map.getBounds();
						if (bounds.toSpan().lat() !== 0) {
							if ($scope.map.getZoom() <= 4) {
								$scope.factor = 1.0;
							} else if ($scope.map.getZoom() <= 7) {
								$scope.factor = 0.8;
							} else if ($scope.map.getZoom() <= 9) {
								$scope.factor = 0.6;
							} else if ($scope.map.getZoom() <= 12) {
								$scope.factor = 0.4;
							} else if ($scope.map.getZoom() <= 14) {
								$scope.factor = 0.2;
							} else {
								$scope.factor = 0.0;
							}
							$scope.bounds = bounds;
						}
					}, 1000);
				});
				$scope.shown = false;
				drawConstraintBounds($scope.getConstraints($scope.field), 'rgb(47, 126, 216)');
				drawConstraintBounds($scope.getConstraintsB($scope.field), 'rgb(204, 102, 0)');
				$scope.map.controls[google.maps.ControlPosition.TOP_RIGHT].push($scope.createFilterControl());
			} else {
				$('#' + $scope.settings.id + 'map').html('<i class="none">None</i>');
			}
		};
		function drawConstraintBounds(constraints, lineColor) {
			$.each(constraints, function(i, constraint) {
				var c = constraint.value.split(',');
				if (c.length === 4) {
					var sw = new google.maps.LatLng(c[0], c[1]);
					var ne = new google.maps.LatLng(c[2], c[3]);
					new google.maps.Rectangle({
						strokeColor : lineColor,
						strokeOpacity : 0.8,
						strokeWeight : 2,
						fillOpacity : 0,
						map : $scope.map,
						bounds : new google.maps.LatLngBounds(sw, ne),
						clickable : false
					});
				}
			});
		}
		$scope.createFilterControl = function() {
			var parent = document.createElement('div');
			parent.style.padding = '0 10px';
			var control = document.createElement('div');
			control.title = 'Filter bucket for events in this area';
			control.className = 'map-control';
			parent.appendChild(control);
			var label = document.createElement('i');
			label.className = 'fa fa-filter';
			control.appendChild(label);
			control.addEventListener('click', function() {
				$scope.$apply(function() {
					$scope.filterBounds();
				});
			});
			return parent;
		};
		$scope.pointsParams = function() {
			return {
				id : $scope.settings.id,
				type : 'map',
				field : 'location',
				factor : $scope.factor,
				filter : getFilter()
			};
		};
		function getFilter() {
			var filter = $scope.settings.filter;
			if ($scope.bounds && !$scope.bounds.isEmpty()) {
				filter = filter ? filter + '|' : '';
				filter += 'location:' + [
					$scope.bounds.getSouthWest().lat(),
					$scope.bounds.getSouthWest().lng(),
					$scope.bounds.getNorthEast().lat(),
					$scope.bounds.getNorthEast().lng()
				].join(',');
			}
			return filter;
		}
		$scope.refreshPoints = function() {
			$scope.search([ $scope.pointsParams() ], function(result, resultB) {
				$scope.updatePoints(null, result, resultB);
			});
		};
		$scope.updatePoints = function(event, result, resultB) {
			$scope.points = result[$scope.settings.id] || [];
			$scope.pointsB = resultB && resultB[$scope.settings.id] || [];
			$scope.addPoints();
		};
		$scope.filterBounds = function() {
			$scope.addConstraint($scope.field, $scope.map.getBounds().toUrlValue(3), true);
		};
		$scope.addPoints = function() {
			$.each($scope.markers, function(i, marker) {
				marker.setMap(null);
			});
			$scope.markers = [];
			if ($scope.map && ($scope.points && $scope.points.length || $scope.pointsB && $scope.pointsB.length)) {
				$.each($scope.points, function(i, point) {
					var marker = new google.maps.Marker({
						position : new google.maps.LatLng(point.lat, point.lon),
						map : $scope.map,
						title : point.count + (point.count == 1 ? ' event' : ' events'),
						icon : {
							path : google.maps.SymbolPath.CIRCLE,
							fillOpacity : 1 - 1 / (point.count + 1), // [0.5..1.0]
							fillColor : 'rgb(47, 126, 216)',
							strokeWeight : 0,
							scale : 5
						}
					});
					$scope.markers.push(marker);
					var sw = new google.maps.LatLng(point.lat_min, point.lon_min);
					var ne = new google.maps.LatLng(point.lat_max, point.lon_max);
					var filterBounds = new google.maps.LatLngBounds(sw, ne);
					if (point.lat_min != point.lat_max) {
						var options = {
							bounds : filterBounds,
							strokeWeight : 0,
							fillOpacity : 0,
							clickable : true,
							visible : true,
							map : $scope.map
						};
						var filterRectangle = new google.maps.Rectangle(options);
						google.maps.event.addListener(filterRectangle, 'mouseover', function() {
							options.strokeWeight = 1;
							filterRectangle.setOptions(options);
						});
						google.maps.event.addListener(filterRectangle, 'mouseout', function() {
							options.strokeWeight = 0;
							filterRectangle.setOptions(options);
						});
						google.maps.event.addListener(filterRectangle, 'click', function() {
							$scope.$apply(function() {
								$scope.addConstraint($scope.field, filterBounds.toUrlValue(6), true);
							});
						});
						google.maps.event.addListener(marker, 'click', function() {
							$scope.$apply(function() {
								$scope.addConstraint($scope.field, filterBounds.toUrlValue(6), true);
							});
						});
						$scope.markers.push(filterRectangle);
					}
				});
				$.each($scope.pointsB, function(i, point) {
					$scope.markers.push(new google.maps.Marker({
						position : new google.maps.LatLng(point.lat, point.lon),
						map : $scope.map,
						title : point.count + (point.count == 1 ? ' event' : ' events'),
						icon : {
							path : google.maps.SymbolPath.CIRCLE,
							fillOpacity : 1 - 1 / (point.count + 1), // [0.5..1.0]
							fillColor : 'rgb(204, 102, 0)',
							strokeWeight : 0,
							scale : 5
						}
					}));
				});
			}
		};

		$scope.init();
		$scope.register($scope);
		$scope.$on('result', $scope.update);
		$scope.$on('refresh', $scope.init);
		$scope.$watch('bounds', function() {
			if ($scope.map) {
				$scope.refreshPoints();
			}
		}, true);
		$('#' + $scope.settings.id + '-tab').on('shown', function() {
			if ($scope.map && !$scope.shown) {
				google.maps.event.trigger($scope.map, 'resize');
				$scope.map.fitBounds($scope.bounds);
				$scope.shown = true;
			}
		});
	}]);

	app.controller('MapWidgetDialogController', ['$scope', 'WidgetDialogControllerSupport', function($scope, WidgetDialogControllerSupport) {

		new WidgetDialogControllerSupport($scope);
	}]);

	app.controller('HeatmapWidgetController', ['$scope', '$timeout', 'Field', function($scope, $timeout, Field) {

		$scope.field = 'location';

		$scope.init = function() {
			$scope.map = null;
			$scope.points = null;
			$scope.pointsB = null;
			$scope.overlay = null;
			$scope.bounds = null;
			$scope.boundsB = null;
			$scope.precision = 8;
			$scope.shown = false;
		};
		function params(settings) {
			if (settings) {
				var filters = [];
				if (settings.filter) {
					filters.push(settings.filter);
				}
				if (settings.value_field) {
					filters.push(settings.value_field + ':*');
				}
				return {
					id : settings.id,
					type : 'geobounds',
					filter : filters.join('|')
				};
			}
		}
		$scope.params = function() {
			return params($scope.settings);
		};
		$scope.refresh = function(options, settings) {
			$scope.init();
			$scope.search([ $.extend(params($scope.settings), params(settings)) ], function(result, resultB) {
				$.extend($scope, options);
				$.extend($scope.settings, settings);
				$scope.update(null, result, resultB);
			});
		};
		$scope.update = function(event, result, resultB) {
			$scope.bounds = toBounds(result[$scope.settings.id] || {});
			$scope.boundsB = toBounds(resultB && resultB[$scope.settings.id] || {});
			$timeout($scope.draw, 1); // delay for correct width
		};
		function toBounds(result) {
			var bounds;
			if (angular.isDefined(result.lat_min)) {
				var sw = new google.maps.LatLng(result.lat_min, result.lon_min);
				var ne = new google.maps.LatLng(result.lat_max, result.lon_max);
				bounds = new google.maps.LatLngBounds(sw, ne);
			} else {
				bounds = new google.maps.LatLngBounds();
			}
			return bounds;
		}
		var boundsUpdate;
		$scope.draw = function() {
			if (!$scope.bounds.isEmpty() || !$scope.boundsB.isEmpty()) {
				var options = {
					mapTypeId: google.maps.MapTypeId.ROADMAP,
					streetViewControl: false,
					mapTypeControlOptions : {
						style : google.maps.MapTypeControlStyle.DROPDOWN_MENU
					},
					styles : [ { 'stylers' : [ { 'saturation' : -100 } ] } ],
					minZoom : 1
				};
				$scope.map = new google.maps.Map(document.getElementById($scope.settings.id + '-map'), options);
				$scope.map.fitBounds($scope.bounds.union($scope.boundsB));
				google.maps.event.addListener($scope.map, 'bounds_changed', function() {
					$timeout.cancel(boundsUpdate);
					boundsUpdate = $timeout(function() {
						var bounds = $scope.map.getBounds();
						if (bounds.toSpan().lat() !== 0) {
							$scope.precision = Math.min(Math.ceil($scope.map.getZoom() / 3.0) + 3, 9);
							$scope.bounds = bounds;
						}
					}, 1000);
				});
				$scope.shown = false;

				$scope.overlay = new deck.GoogleMapsOverlay();
				$scope.overlay.setMap($scope.map);
				drawConstraintBounds($scope.getConstraints($scope.field), 'rgb(47, 126, 216)');
				drawConstraintBounds($scope.getConstraintsB($scope.field), 'rgb(204, 102, 0)');
				$scope.map.controls[google.maps.ControlPosition.TOP_RIGHT].push(createFilterControl());
			} else {
				$('#' + $scope.settings.id + 'map').html('<i class="none">None</i>');
			}
		};
		function drawConstraintBounds(constraints, lineColor) {
			$.each(constraints, function(i, constraint) {
				var c = constraint.value.split(',');
				if (c.length === 4) {
					var sw = new google.maps.LatLng(c[0], c[1]);
					var ne = new google.maps.LatLng(c[2], c[3]);
					new google.maps.Rectangle({
						strokeColor : lineColor,
						strokeOpacity : 0.8,
						strokeWeight : 2,
						fillOpacity : 0,
						map : $scope.map,
						bounds : new google.maps.LatLngBounds(sw, ne),
						clickable : false
					});
				}
			});
		}
		function createFilterControl() {
			var parent = document.createElement('div');
			parent.style.padding = '0 10px';
			var control = document.createElement('div');
			control.title = 'Filter bucket for events in this area';
			control.className = 'map-control';
			parent.appendChild(control);
			var label = document.createElement('i');
			label.className = 'fa fa-filter';
			control.appendChild(label);
			control.addEventListener('click', function() {
				$scope.$apply(function() {
					$scope.filterBounds();
				});
			});
			return parent;
		}
		$scope.pointsParams = function() {
			return {
				id : $scope.settings.id,
				type : 'heatmap',
				precision : $scope.precision,
				value_field : $scope.settings.value_field,
				unit : $scope.settings.unit,
				filter : getFilter()
			};
		};
		function getFilter() {
			var filter = $scope.settings.filter;
			if ($scope.bounds && !$scope.bounds.isEmpty()) {
				filter = filter ? filter + '|' : '';
				filter += 'location:' + [
					$scope.bounds.getSouthWest().lat(),
					$scope.bounds.getSouthWest().lng(),
					$scope.bounds.getNorthEast().lat(),
					$scope.bounds.getNorthEast().lng()
				].join(',');
			}
			return filter;
		}
		$scope.refreshPoints = function() {
			$scope.search([ $scope.pointsParams() ], function(result, resultB) {
				$scope.updatePoints(null, result, resultB);
			});
		};
		$scope.updatePoints = function(event, result, resultB) {
			$scope.points = result[$scope.settings.id] || [];
			$scope.pointsB = resultB && resultB[$scope.settings.id] || [];
			$scope.addPoints();
		};
		$scope.filterBounds = function() {
			$scope.addConstraint($scope.field, $scope.map.getBounds().toUrlValue(3), true);
		};
		$scope.addPoints = function() {
			if ($scope.map && ($scope.points && $scope.points.length || $scope.pointsB && $scope.pointsB.length)) {
				var field = Field.find($scope.settings.value_field);
				var data = [];
				$.each($scope.points, function(i, point) {
					var weight = field && $scope.points.length > 1 ? field.toNumber(point.sum) : point.count;
					data.push({ position : [point.lon, point.lat], weight : weight });
				});
				var dataB = [];
				$.each($scope.pointsB, function(i, point) {
					var weight = field && $scope.pointsB.length > 1 ? field.toNumber(point.sum) : point.count;
					dataB.push({ position : [point.lon, point.lat], weight : weight });
				});
				var layers = [];
				if (data.length) {
					layers.push(new deck.HeatmapLayer({
						id : 'heatmap-primary',
						data : data,
						getPosition : function(d) { return d.position; },
						getWeight : function(d) { return d.weight; },
						radiusPixels : 20,
						opacity : 0.5,
						colorRange : [[0,126,216], [64,126,216], [128,126,216], [192,126,216], [255,126,216]]
					}));
				}
				if (dataB.length) {
					layers.push(new deck.HeatmapLayer({
						id : 'heatmap-secondary',
						data : dataB,
						getPosition : function(d) { return d.position; },
						getWeight : function(d) { return d.weight; },
						radiusPixels : 20,
						opacity : 0.5,
						colorRange : [[204,103,0], [204,140,0], [204,180,0], [204,220,0], [204,255,0]]
					}));
				}
				$scope.overlay.setProps({ layers : layers });
			}
		};

		$scope.init();
		$scope.register($scope);
		$scope.$on('result', $scope.update);
		$scope.$on('refresh', $scope.init);
		$scope.$watch('bounds', function() {
			if ($scope.map) {
				$scope.refreshPoints();
			}
		}, true);
		$('#' + $scope.settings.id + '-tab').on('shown', function() {
			if ($scope.map && !$scope.shown) {
				google.maps.event.trigger($scope.map, 'resize');
				$scope.map.fitBounds($scope.bounds);
				$scope.shown = true;
			}
		});
	}]);

	app.controller('HeatmapWidgetDialogController', ['$scope', 'WidgetDialogControllerSupport', 'Field', function($scope, WidgetDialogControllerSupport, Field) {

		new WidgetDialogControllerSupport($scope);

		$scope.getFields = function() {
			return Field.findByType('numeric');
		};

		$scope.$watch('settings.value_field', function(fieldName) {
			var field = Field.find(fieldName);
			$scope.settings.unit = field && field.units.length ? field.units[0] : '';
		});

	}]);

	app.controller('SonificationWidgetController', ['$scope', '$window', '$interval', function($scope, $window, $interval) {

		var audio = null;

		var pitches = {
			'A3' : 220.0,
			'Bb3' : 233.1,
			'B3' : 246.9,
			'C4' : 261.6,
			'C#4' : 277.2,
			'D4' : 293.7,
			'Eb4' : 311.1,
			'E4' : 329.6,
			'F4' : 349.2,
			'F#4' : 370.0,
			'G4' : 392.0,
			'G#4' : 415.3,
			'A4' : 440.0,
			'Bb4' : 466.2,
			'B4' : 493.9,
			'C5' : 523.3,
			'Cs5' : 554.4,
			'D5' : 587.3,
			'Eb5' : 622.3,
			'E5' : 659.3,
			'F5' : 698.5,
			'F#5' : 740.0
		};

		var scales = {
			chromatic : [
				pitches['C4'],
				pitches['C#4'],
				pitches['D4'],
				pitches['Eb4'],
				pitches['E4'],
				pitches['F4'],
				pitches['F#4'],
				pitches['G4'],
				pitches['G#4'],
				pitches['A4'],
				pitches['Bb4'],
				pitches['B4'],
				pitches['C5']
			],
			octatonic : [
				pitches['C4'],
				pitches['C#4'],
				pitches['Eb4'],
				pitches['E4'],
				pitches['F#4'],
				pitches['G4'],
				pitches['A4'],
				pitches['Bb4'],
				pitches['C5']
			],
			pentatonic : [
				pitches['C4'],
				pitches['D4'],
				pitches['E4'],
				pitches['G4'],
				pitches['A4'],
				pitches['C5']
			]
		};

		$scope.init = function() {
			$scope.stop();
			$scope.tracks = [];
		};
		$scope.params = function() {
			return null;
		};
		$scope.update = function(event, result) {
			$.each(result, function(id, data) {
				if ($.isArray(data) && data.length && data[0].time) {
					var useCounts = true;
					var unit = null;
					var values = $.map(data, function(item) {
						if (item.hasOwnProperty('avg')) {
							if (typeof item.avg === 'object') {
								unit = item.avg.unit;
								return item.avg['@value'];
							}
							useCounts = false;
							return item.avg;
						} else {
							return useCounts ? item.count : 0;
						}
					});
					$scope.tracks.push(normalize(values));
				}
			});
		};
		$scope.refresh = function(options, settings) {
			$scope.stop();
			$.extend($scope.settings, settings);
			if ($scope.tracks.length === 0) {
				$scope.$parent.refresh();
			}
		};
		$scope.play = function() {
			audio.resume();
			if ($scope.playing === 0) {
				$.each($scope.tracks, function(i, track) {
					play(track, scales[$scope.settings.scale], $scope.settings.tempo, 1.0 / $scope.tracks.length);
				});
			}
		};
		$scope.stop = function() {
			if (audio) {
				audio.suspend();
				audio.close();
			}
			audio = $window.AudioContext ? new $window.AudioContext() : new $window.webkitAudioContext();
			audio.suspend();
			var ticker = null;
			audio.onstatechange = function() {
				if (audio.state === 'running') {
					$scope.tic();
					ticker = $interval(function() {
						$scope.tic();
					}, Math.round(60000 / $scope.settings.tempo));
				} else if (ticker) {
					$interval.cancel(ticker);
					$scope.untic();
				}
			};
			$scope.playing = 0;
		};
		$scope.isRunning = function() {
			return audio.state === 'running';
		};

		$scope.init();
		$scope.register($scope);
		$scope.$on('result', $scope.update);
		$scope.$on('refresh', $scope.init);

		function normalize(values) {
			var nonZeroValues = $.grep(values, function(value) { return value !== 0; });
			var min = Math.min.apply(null, nonZeroValues) || 0;
			values = $.map(values, function(value) {
				return Math.max(value - min, 0);
			});
			var max = Math.max.apply(null, values) || 1;
			return $.map(values, function(value) {
				return value / max;
			});
		}

		function play(notes, scale, tempo, volume) {
			for (var i = 0; i < notes.length; ++i) {
				var freq = notes[i] > 0 ? scale[Math.ceil(notes[i] * scale.length) - 1] : 0;
				var d = 60 / tempo;
				var t = audio.currentTime + i * d;
				var gain = audio.createGain();
				gain.connect(audio.destination);
				gain.gain.setValueAtTime(0.0, t);
				gain.gain.linearRampToValueAtTime(volume, t + d / 5);
				gain.gain.linearRampToValueAtTime(0.0, t + d);
				var osc = audio.createOscillator();
				osc.frequency.value = freq;
				osc.connect(gain);
				osc.start(t);
				osc.stop(t + d + d / 5);
				osc.onended = ended;
				++$scope.playing;
			}
		}

		function ended() {
			$scope.$apply(function() {
				if (--$scope.playing === 0) {
					audio.suspend();
				}
			});
		}
	}]);

	app.controller('SonificationWidgetDialogController', ['$scope', 'WidgetDialogControllerSupport', function($scope, WidgetDialogControllerSupport) {
		new WidgetDialogControllerSupport($scope);
		$scope.scales = [ 'chromatic', 'octatonic', 'pentatonic' ];
	}]);

}());
