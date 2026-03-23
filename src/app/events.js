(function() {

	'use strict';

	var app = angular.module('appModule');

	app.factory('Event', function() {

		var Event = function(data) {
			$.extend(true, this, data);
		};

		Event.prototype.get = function(fields) {
			var self = this;
			var entries = [];
			$.each(fields, function(i, field) {
				var value = self[field.name];
				if (value !== undefined) {
					$.each($.isArray(value) ? value : [ value ], function(i, value) {
						entries.push({ field : field, value : value });
					});
				}
			});
			return entries;
		};

		Event.prototype.add = function(field, value) {
			var values = this[field.name];
			if (values === undefined) {
				values = this[field.name] = [];
			} else if (!$.isArray(values)) {
				values = this[field.name] = [ values ];
				this[field.name] = values;
			}
			values.push(value);
		};

		return Event;
	});

	app.controller('EventDialogController', ['$scope', '$http', '$routeParams', 'Event', 'Field', 'tracker', 'delay', 'moment', function($scope, $http, $routeParams, Event, Field, tracker, delay, moment) {

		$scope.params = $routeParams;
		$scope.fields = Field.findEditable();
		$scope.init = function(event) {
			$scope.event = new Event(event);
			$scope.entries = $scope.event.get($scope.fields);
			$scope.isNew = $.isEmptyObject($scope.entries);
			$scope.message = '';
			$scope.field = null;
			$scope.value = '';
			$scope.$watch('event', function(event) {
				$scope.entries = event.get($scope.fields);
			}, true);
			tracker.event('dialog', $scope.isNew ? 'create event' : 'edit event');
		};
		$scope.getTemplate = function(field) {
			return field ? '/create-' + field.name + '.html' : null;
		};
		$scope.save = function() {
			if (!$scope.event['timestamp']) {
				$scope.event.add(Field.find('timestamp'), moment().format('YYYY-MM-DDTHH:mm:ss.000Z'));
			}
			$scope.alert.clear();
			if ($scope.isNew) {
				$http.post('/buckets/' + $scope.params.bucketId + '/', $scope.event)
					.success(function() {
						$scope.closeDialog();
						delay($scope.refresh);
					})
					.error(function(response) {
						$scope.message = response.message || 'Couldn\'t create this event.';
					});
			} else {
				$http.put('/buckets/' + $scope.params.bucketId + '/' + $scope.event['@id'], $scope.event)
					.success(function(response, status, headers) {
						$scope.closeDialog();
						$scope.alert.show('Updated an event.', 'alert-success', headers('X-Command-ID'));
						delay($scope.refresh);
					})
					.error(function(response) {
						$scope.message = response.message || 'Couldn\'t update this event.';
					});
			}
			tracker.event('action', 'save event');
		};
		$scope.remove = function(entry) {
			var values = $scope.event[entry.field.name];
			if ($.isArray(values)) {
				values = $.grep(values, function(value) {
					return value !== entry.value;
				});
				if (values.length === 1) {
					$scope.event[entry.field.name] = values[0];
				} else if (values.length > 0) {
					$scope.event[entry.field.name] = values;
				} else {
					delete $scope.event[entry.field.name];
				}
			} else {
				delete $scope.event[entry.field.name];
			}
		};
		$scope.reset = function() {
			$scope.field = null;
		};
	}]);

	app.controller('CreateTagFieldController', ['$scope', '$http', function($scope, $http) {

		var input = $('#tag-value-field');

		$scope.init = function() {
			$scope.value = '';
		};
		$scope.addField = function() {
			$scope.value = $.trim(input.val());
			$scope.event.add($scope.field, $scope.value);
			$scope.reset();
		};
		$scope.valid = function() {
			return $scope.value;
		};

		$scope.init();
		if ($scope.total > 0) {
			$http.get('/buckets/' + $scope.bucket['@id'] + '/tags/')
			.success(function(response) {
				input.typeahead({ source : response });
			});
		}
	}]);

	app.controller('CreateLocationFieldController', ['$scope', function($scope) {

		function parseLatLng(value) {
			var p = value.indexOf(',');
			if (p == -1) {
				return null;
			}
			var lat = parseFloat(value.substring(0, p));
			var lng = parseFloat(value.substring(p + 1));
			return !isNaN(lat) && !isNaN(lng) ? new google.maps.LatLng(lat, lng) : null;
		}

		$scope.init = function() {
			var center = new google.maps.LatLng(0, 0);
			var options = {
				center : center,
				zoom : 2,
				mapTypeId: google.maps.MapTypeId.ROADMAP,
				streetViewControl: false,
				draggableCursor : 'crosshair',
				mapTypeControlOptions : {
					style : google.maps.MapTypeControlStyle.DROPDOWN_MENU
				}
			};
			$scope.map = new google.maps.Map(document.getElementById('create-location-map'), options);
			google.maps.event.addListener($scope.map, 'click', function(e) {
				$scope.moveMarker(e.latLng);
			});
			var input = $('#location-search-field');
			input.on('input', function() {
				var latLng = parseLatLng(input.val());
				if (latLng) {
					$scope.moveMarker(latLng);
					$scope.map.setCenter(latLng);
				}
			});
			var autocomplete = new google.maps.places.Autocomplete(input.get(0));
			autocomplete.bindTo('bounds', $scope.map);
			google.maps.event.addListener(autocomplete, 'place_changed', function() {
				var place = autocomplete.getPlace();
				if (place.geometry) {
					if (place.geometry.viewport) {
						$scope.map.fitBounds(place.geometry.viewport);
					}
					if (place.geometry.location) {
						$scope.moveMarker(place.geometry.location);
						$scope.map.setCenter(place.geometry.location);
					}
				}
			});

			if (navigator.geolocation) {
				navigator.geolocation.getCurrentPosition(function(position) {
					var latLng = new google.maps.LatLng(position.coords.latitude, position.coords.longitude);
					$scope.moveMarker(latLng);
					$scope.map.setCenter(latLng);
					$scope.map.setZoom(10);
				});
			}
		};
		$scope.moveMarker = function(latLng) {
			if ($scope.marker) {
				$scope.marker.setPosition(latLng);
			} else {
				$scope.marker = new google.maps.Marker({
					position : latLng,
					map : $scope.map,
					title : 'Location',
					draggable: true
				});
				google.maps.event.addListener($scope.marker, 'dragend', function() {
					$scope.setValue($scope.marker.getPosition());
				});
			}
			$scope.setValue(latLng);
		};
		$scope.setValue = function(latLng) {
			$scope.$apply(function() {
				$scope.value = {
						lat : latLng.lat(),
						lon : latLng.lng()
				};
			});
		};
		$scope.valid = function() {
			return $scope.value && $scope.value.lat >= -90 && $scope.value.lat <= 90 &&
				$scope.value.lon >= -180 && $scope.value.lon <= 180;
		};
		$scope.addField = function() {
			$scope.event.add($scope.field, $scope.value);
			$scope.reset();
		};

		$scope.init();
	}]);


	app.controller('CreateTimestampFieldController', ['$scope', 'timezone', 'moment', function($scope, timezone, moment) {

		$scope.timezones = [
			'-12:00', '-11:00', '-10:00', '-09:30', '-09:00', '-08:00', '-07:00', '-06:00','-05:00', '-04:30', '-04:00', '-03:00', '-02:00', '-01:00', 'Z',
			'+01:00', '+02:00', '+03:00', '+04:00', '+04:30', '+05:00', '+05:30', '+05:45', '+06:00', '+06:30', '+07:00', '+08:00', '+08:45', '+09:00', '+09:30', '+10:00', '+11:00', '+11:30', '+12:00', '+12:45', '+13:00', '+14:00'
		];

		function getValue() {
			var day = (typeof $scope.date === 'object') ? moment(local($scope.date)).format('YYYY-MM-DD') : $scope.date;
			var time = $scope.time.format('HH:mm:ss.SSS');
			return day + 'T' + time + $scope.timezone;
		}
		function local(date) {
			return new Date(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
		}
		function utc(date) {
			return new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
		}

		$scope.init = function() {
			$scope.date = utc(new Date());
			$scope.time = moment().seconds(0).milliseconds(0);
			$scope.timezone = timezone;
		};
		$scope.addField = function() {
			$scope.event.add($scope.field, getValue());
			$scope.reset();
		};
		$scope.valid = function() {
			return moment(getValue()).isValid();
		};

		$scope.init();
	}]);

	app.controller('CreateDurationFieldController', ['$scope', function($scope) {

		$scope.init = function() {
			$scope.days = $scope.hours = $scope.minutes = $scope.seconds = 0;
		};
		$scope.millis = function() {
			return ((($scope.days * 24 + $scope.hours) * 60 + $scope.minutes) * 60 + $scope.seconds) * 1000;
		};
		$scope.addField = function() {
			$scope.event.add($scope.field, $scope.millis());
			$scope.reset();
		};
		$scope.valid = function() {
			return $scope.millis() > 0;
		};

		$scope.init();
	}]);

	app.controller('CreatePaceFieldController', ['$scope', function($scope) {

		$scope.init = function() {
			$scope.minutes = $scope.seconds = 0;
			$scope.unit = null;
		};
		$scope.addField = function() {
			$scope.event.add($scope.field, {
				'@value' : $scope.minutes * 60 + $scope.seconds,
				'unit' : 's/' + $scope.unit
			});
			$scope.reset();
		};
		$scope.getUnits = function() {
			return $.map($scope.field.units, function(unit) {
				return unit.substring(2);
			});
		};
		$scope.valid = function() {
			return ($scope.minutes + $scope.seconds) > 0 && $scope.unit;
		};

		$scope.init();
	}]);

	app.controller('CreateResourceFieldController', ['$scope', '$http', function($scope, $http) {

		$scope.init = function() {
			$scope.value = {};
			$scope.loading = false;
		};
		$scope.addField = function() {
			$scope.event.add($scope.field, $scope.value);
			$scope.reset();
		};
		$scope.prefillTitle = function() {
			if ($scope.value.url) {
				$scope.loading = true;
				$http.get('/og?' + $.param({ url : $scope.value.url }))
					.success(function(response) {
						$scope.value.title = response.title;
						$scope.loading = false;
					})
					.error(function() {
						$scope.loading = false;
					});
			}
		};
		$scope.valid = function() {
			return $scope.value.url && $scope.value.title;
		};
		$scope.change = function() {

		};
		$scope.$watch('value.url', function(url) {
			if (url && !$scope.value.title) {
				$scope.prefillTitle();
			}
		});
		$scope.init();
	}]);

	app.controller('CreateUnitFieldController', ['$scope', function($scope) {

		$scope.init = function() {
			$scope.value = {};
		};
		$scope.addField = function() {
			$scope.event.add($scope.field, $scope.value);
			$scope.reset();
		};
		$scope.getUnits = function() {
			return $scope.field.units;
		};
		$scope.valid = function() {
			return $.isNumeric($scope.value['@value']) && $scope.value.unit;
		};

		$scope.init();
	}]);

	app.controller('CreateIntegerFieldController', ['$scope', function($scope) {

		$scope.init = function() {
			$scope.value = 0;
		};
		$scope.addField = function() {
			$scope.event.add($scope.field, $scope.value);
			$scope.reset();
		};
		$scope.valid = function() {
			return /^\d+$/.test($scope.value);
		};

		$scope.init();
	}]);

	app.controller('CreateRatingFieldController', ['$scope', function($scope) {

		$scope.init = function() {
			$scope.stars = 0;
			$scope.highlighted = 0;
		};
		$scope.highlight = function(stars) {
			$scope.highlighted = stars;
		};
		$scope.set = function(stars) {
			$scope.stars = stars;
		};
		$scope.get = function() {
			return $scope.highlighted || $scope.stars;
		};
		$scope.addField = function() {
			$scope.event.add($scope.field, $scope.stars * 20);
			$scope.reset();
		};

		$scope.init();
	}]);

	app.controller('CreatePercentageFieldController', ['$scope', function($scope) {

		$scope.init = function() {
			$scope.value = 0;
		};
		$scope.addField = function() {
			$scope.event.add($scope.field, $scope.value);
			$scope.reset();
		};
		$scope.valid = function() {
			return $.isNumeric($scope.value);
		};

		$scope.init();
	}]);

	app.controller('CreateMoonFieldController', ['$scope', function($scope) {

		$scope.init = function() {
			$scope.value = 0;
		};
		$scope.addField = function() {
			$scope.event.add($scope.field, $scope.value);
			$scope.reset();
		};
		$scope.valid = function() {
			return $.isNumeric($scope.value);
		};

		$scope.init();
	}]);

	app.controller('CreateCurrencyFieldController', ['$scope', function($scope) {

		$scope.init = function() {
			$scope.value = 0.00;
		};
		$scope.addField = function() {
			$scope.event.add($scope.field, $scope.value);
			$scope.reset();
		};
		$scope.valid = function() {
			return $.isNumeric($scope.value);
		};

		$scope.init();
	}]);

	app.controller('CreateNoteFieldController', ['$scope', function($scope) {

		$scope.init = function() {
			$scope.value = '';
		};
		$scope.addField = function() {
			$scope.event.add($scope.field, $scope.value);
			$scope.reset();
		};
		$scope.valid = function() {
			return $scope.value;
		};

		$scope.init();
	}]);

	app.factory('EventSpreadsheet', function() {

		/**
		 * input: timestamp, distance.@value, distance.unit, tag
		 * output: { 'timestamp' : 0, 'distance' : { '@value' : 1, 'unit' : 2 }, 'tag' : 3 }
		 */
		function buildMappings(headers) {
			var mappings = {};
			$.each(headers, function(i, header) {
				var path = header.split('.', 2);
				var mapping;
				if (path.length == 1) {
					mapping = i;
				} else {
					mapping = mappings[path[0]] || {};
					mapping[path[1]] = i;
				}
				mappings[path[0]] = mapping;
			});
			delete mappings['@id'];
			delete mappings['author'];
			delete mappings['version'];
			return mappings;
		}

		return {
			parse : function(s) {
				var events = [];
				var csv = Baby.parse(s, { skipEmptyLines : true });
				if (csv.errors.length) {
					throw new Error(csv.errors[0].message + ' in row ' + csv.errors[0].row);
				}
				var mappings = buildMappings(csv.data.shift());
				$.each(csv.data, function(i, row) {
					var event = {};
					$.each(mappings, function(field, mapping) {
						var value;
						if ($.isNumeric(mapping)) {
							value = row[mapping];
							if (angular.isDefined(value) && value !== '') {
								event[field] = value.split(';');
							}
						} else {
							var objects = 1;
							for (var i = 0; i < objects; ++i) {
								var object = {};
								for (var nested in mapping) {
									var offset = mapping[nested];
									value = row[offset];
									if (angular.isDefined(value) && value !== '') {
										var values = value.split(';');
										object[nested] = values[i];
										objects = values.length;
									}
								}
								if (!$.isEmptyObject(object)) {
									event[field] = event[field] || [];
									event[field].push(object);
								}
							}
						}
					});
					if (!$.isEmptyObject(event)) {
						events.push(event);
					}
				});
				return events;
			}
		};
	});

}());
