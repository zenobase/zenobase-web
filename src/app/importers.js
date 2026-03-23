(function() {

	'use strict';

	var app = angular.module('appModule');

	app.factory('HealthKit', [ 'moment', function(moment) {

		return {
			parse : function(s) {
				var events = [];
				var csv = Baby.parse(s, { header : true, skipEmptyLines : true });
				if (csv.errors.length) {
					throw new Error(csv.errors[0].message + ' in row ' + csv.errors[0].row);
				}
				$.each(csv.data, function(rowNum, row) {
					var f = 'DD/MMM/YYYY H:mm:ss';
					var t0 = moment(row['Start'], f);
					var t1 = moment(row['Finish'], f);
					var duration = t1.valueOf() - t0.valueOf();
					var timestamp = t0.format('YYYY-MM-DDTHH:mm:ss.SSSZ');
					var eventsByTag = {};
					function push(tag, field, value) {
						var event = eventsByTag[tag];
						if (!event) {
							event = {
								'timestamp' : timestamp,
								'duration' : duration,
								'tag' : [ tag ]
							};
							events.push(eventsByTag[tag] = event);
						}
						(event[field] = event[field] || []).push(value);
					}
					for (var field in row) {
						var value = Number(row[field]);
						var m = field.match(/(.+) \((.+?)\)/);
						if (m && !isNaN(value) && value !== 0) {
							var tag = m[1].replace(/ \(.+\)/, ''); // "Blood Pressure (Diastolic)" -> "Blood Pressure"
							var unit = m[2];
							switch (unit) {
								case 'count':
									push(tag, 'count', Math.round(value));
									break;
								case '%':
									push(tag, 'percentage', Math.round(100.0 * value));
									break;
								case 'mcg':
									unit = 'ug';
									/* falls through */
								case 'mg':
								case 'g':
								case 'kg':
								case 'lb':
									push(tag, 'weight', {
										'@value' : value,
										'unit' : unit
									});
									break;
								case 'L':
									push(tag, 'volume', {
										'@value' : value,
										'unit' : unit
									});
									break;
								case 'mg/dL':
									push(tag, 'concentration', {
										'@value' : value,
										'unit' : unit
									});
									break;
								case 'mmHg':
									push(tag, 'pressure', {
										'@value' : value,
										'unit' : unit
									});
									break;
								case 'degC':
									push(tag, 'temperature', {
										'@value' : value,
										'unit' : 'C'
									});
									break;
								case 'cal':
								case 'kcal':
									push(tag, 'energy', {
										'@value' : value,
										'unit' : unit
									});
									break;
								case 'count/min':
									push(tag, 'frequency', {
										'@value' : value,
										'unit' : 'bpm'
									});
									break;
							}
						}
					}
				});
				return events;
			}
		};
	}]);

	app.factory('SleepCycle', ['moment', function(moment) {

		function formatMoment(t) {
			return t.format('YYYY-MM-DDTHH:mm:ss.SSSZ');
		}

		function parseStart(value) {
			var t = moment(value);
			if (!t) {
				throw new Error(value + ' is not a valid time');
			}
			return t;
		}

		function parseSleepQuality(value) {
			var m = /(\d+)%/.exec(value);
			if (m) {
				return parseInt(m[1]);
			}
			throw new Error(value + ' is not a valid sleep quality');
		}

		function parseTimeInBed(value) {
			var m = /(\d+):(\d+)/.exec(value);
			if (m) {
				return parseInt(m[1]) * 60 * 60 * 1000 + parseInt(m[2]) * 60 * 1000;
			}
			throw new Error(value + ' is not a valid duration');
		}

		function parseWakeUp(value) {
			if (!value) {
				return undefined;
			}
			if (value === ':)') {
				return 100;
			}
			if (value === ':|') {
				return 50;
			}
			if (value === ':(') {
				return 0;
			}
			throw new Error(value + ' is not a valid emoticon');
		}

		function parseSleepNotes(values) {
			var tags = [ 'sleep' ];
			if (values) {
				$.each(values.split(':'), function(i, value) {
					tags.push(value.toLowerCase());
				});
			}
			return tags;
		}

		return {
			parse : function(data) {
				var events = [];
				var lines = data.split(/[\r\n]+/g);
				var expected = [ 'Start', 'End', 'Sleep quality', 'Time in bed', 'Wake up', 'Sleep Notes' ];
				var headers = lines.shift().split(';').slice(0, 6);
				if (!angular.equals(headers, expected)) {
					throw new Error('Expected headers: ' + expected.join(', '));
				}
				$.each(lines, function(i, line) {
					var fields = line.split(';');
					if (line.trim()) {
						if (fields.length < expected.length) {
							throw new Error('Wrong number of fields in line ' + i);
						}
						var begin = parseStart(fields[0]);
						var duration = parseTimeInBed(fields[3]);
						var event = {
							'tag' : parseSleepNotes(fields[5]),
							'timestamp' : [ formatMoment(begin), formatMoment(begin.add(duration, 'ms')) ],
							'duration' : duration,
							'percentage' : parseSleepQuality(fields[2]),
							'rating' : parseWakeUp(fields[4]),
							'source' : {
								'title' : 'SleepCycle',
								'url' : 'https://www.sleepcycle.com/'
							}
						};
						events.push(event);
					}
				});
				return events;
			}
		};
	}]);

	app.factory('TapLog', function() {

		return {
			parse : function(s, settings) {
				var events = [];
				var csv = Baby.parse(s, { header : true, skipEmptyLines : true });
				if (csv.errors.length) {
					throw new Error(csv.errors[0].message + ' in row ' + csv.errors[0].row);
				}
				$.each(csv.data, function(rowNum, row) {
					var event = {
						'timestamp' : row['timestamp'],
						'tag' : [],
					};
					for (var i = 1; i < 10; ++i) {
						var category = row['cat' + i];
						if (category) {
							event['tag'].push(category);
						}
					}
					if (settings.field && row['number']) {
						var value = Number(row['number']);
						if (settings.field === 'rating') {
							value *= 20;
						}
						event[settings.field] = settings.unit ? {
							'@value' : value,
							'unit' : settings.unit
						} : value;
					}
					if (row['note']) {
						event['note'] = row['note'];
					}
					if (row['latitude']) {
						var lat = Number(row['latitude']);
						var lon = Number(row['longitude']);
						if (lat !== 0 || lon !== 0) {
							event['location'] = { 'lat' : lat, 'lon' : lon };
						}
					}
					events.push(event);
				});
				return events;
			}
		};
	});

	app.factory('Nomie', [ 'moment', function(moment) {

		function parseJSON(s, settings) {
			var events = [];
			var data = JSON.parse(s);
			var tags = {};
			var add = function(i, item) {
				var event = {
					'timestamp' : moment(item.time).utcOffset(-item.offset).format('YYYY-MM-DDTHH:mm:ss.SSSZ'),
					'tag' : tags[item.parent],
					'rating' : (Number(item.charge) + 3) * 20
				};
				if (item.geo.length === 2) {
					event['location'] = { 'lat' : Number(item.geo[0]), 'lon' : Number(item.geo[1]) };
				}
				if (typeof item.value === 'string') {
					event['note'] = item.value;
				} else if (typeof item.value === 'number' && settings.field) {
					event[settings.field] = settings.unit ? {
						'@value' : item.value,
						'unit' : settings.unit
					} : item.value;
				}
				events.push(event);
			};
			$.each(data.trackers, function(i, tracker) {
				tags[tracker._id] = [ tracker.label ];
				if (tracker.groups) {
					$.each(tracker.groups, function(i, group) {
						if (group) {
							tags[tracker._id].push(group);
						}
					});
				}
			});
			$.each(data.ticks, add);
			$.each(data.notes, add);
			return events;
		}

		function parseCSV(s, settings) {
			var events = [];
			var csv = Baby.parse(s, { header : true, skipEmptyLines : true });
			if (csv.errors.length) {
				throw new Error(csv.errors[0].message + ' in row ' + csv.errors[0].row);
			}
			$.each(csv.data, function(rowNum, row) {
				var t = moment(row['iso_date']);
				var offset = Number(row['offset']);
				if (isFinite(offset)) {
					t.utcOffset(-offset);
				}
				var timestamp = t.format('YYYY-MM-DDTHH:mm:ss.SSSZ');
				var event = {
					'timestamp' : timestamp,
					'tag' : [],
				};
				if (row['tracker'] === '') {
					return;
				} else if (row['tracker'] !== 'Unknown') {
					event['tag'].push(row['tracker']);
				}
				if (row['charge'] !== undefined) {
					event['rating'] = (Number(row['charge']) + 3) * 20;
				}
				var value = Number(row['value']);
				if (value && settings.field) {
					event[settings.field] = settings.unit ? {
						'@value' : value,
						'unit' : settings.unit
					} : value;
				}
				if (row['lat']) {
					var lat = Number(row['lat']);
					var lon = Number(row['long']);
					if (lat !== 0 || lon !== 0) {
						event['location'] = { 'lat' : lat, 'lon' : lon };
					}
				}
				events.push(event);
			});
			return events;
		}

		return {
			parse : function(s, settings) {
				return s.charAt(0) === '{' ? parseJSON(s, settings) : parseCSV(s, settings);
			}
		};
	}]);

	app.factory('Nomie5', [ 'moment', function(moment) {

		function parseCSV(s, settings) {
			var events = [];
			var csv = Baby.parse(s, { header : true, skipEmptyLines : true });
			if (csv.errors.length) {
				throw new Error(csv.errors[0].message + ' in row ' + csv.errors[0].row);
			}
			$.each(csv.data, function(rowNum, row) {
				var t0 = moment(row['start']);
				var t1 = moment(row['end']);
				var offset = Number(row['offset']);
				if (isFinite(offset)) {
					t0.utcOffset(-offset);
					t1.utcOffset(-offset);
				}
				var event = {
					'timestamp' : [
						t0.format('YYYY-MM-DDTHH:mm:ss.SSSZ'),
						t1.format('YYYY-MM-DDTHH:mm:ss.SSSZ')
					],
					'tag' : [],
				};
				if (row['tracker'] === '') {
					return;
				} else if (row['tracker'] !== 'Unknown') {
					event['tag'].push(row['tracker']);
				}
				var value = Number(row['value']);
				if (value && settings.field) {
					event[settings.field] = settings.unit ? {
						'@value' : value,
						'unit' : settings.unit
					} : value;
				}
				if (row['lat']) {
					var lat = Number(row['lat']);
					var lon = Number(row['lng']);
					if (lat !== 0 || lon !== 0) {
						event['location'] = { 'lat' : lat, 'lon' : lon };
					}
				}
				events.push(event);
			});
			return events;
		}

		return {
			parse : function(s, settings) {
				return parseCSV(s, settings);
			}
		};
	}]);

	app.factory('Basis', [ 'moment', function(moment) {

		function meanOfNonZeroValues(values) {
			var sum = 0;
			var count = 0;
			for (var i = 0; i < values.length; ++i) {
				if (values[i]) {
					++count;
					sum += values[i];
				}
			}
			return sum / count;
		}

		return {
			parse : function(s, settings) {
				var events = [];
				var csv = Baby.parse(s, { header : true, skipEmptyLines : true });
				if (csv.errors.length) {
					throw new Error(csv.errors[0].message + ' in row ' + csv.errors[0].row);
				}
				var hour = null;
				var rows = 0;
				var count = 0;
				var energy = 0.0;
				var frequencies = [];
				var temperatures = [];
				function push() {
					var event = {
						'timestamp' : hour,
						'duration' : 3600000,
						'tag' : [ settings.tag ],
						'energy' : {
							'@value' : Math.round(10 * energy) / 10,
							'unit' : 'kcal'
						},
						'count' : count,
						'source' : {
							'title' : 'Basis',
							'url' : 'https://www.mybasis.com/'
						}
					};
					var frequency = meanOfNonZeroValues(frequencies);
					if (isFinite(frequency)) {
						event['frequency'] = {
							'@value' : Math.round(frequency),
							'unit' : 'bpm'
						};
					}
					var temperature = meanOfNonZeroValues(temperatures);
					if (isFinite(temperature)) {
						event['temperature'] = {
							'@value' : Math.round(10 * temperature) / 10,
							'unit' : 'F'
						};
					}
					events.push(event);
					hour = null;
					rows = 0;
					count = 0;
					energy = 0.0;
					frequencies = [];
					temperatures = [];
				}
				$.each(csv.data, function(rowNum, row) {
					var t = moment(row['date']);
					var h = t.format('YYYY-MM-DDTHH:00:00.000Z');
					if (hour && hour !== h) {
						push();
					}
					++rows;
					hour = h;
					count += Number(row['steps'] || 0);
					energy += Number(row['calories'] || 0);
					if (row['heart-rate']) {
						frequencies.push(Number(row['heart-rate']));
					}
					if (row['skin-temp']) {
						temperatures.push(Number(row['skin-temp']));
					}
				});
				if (hour && rows) {
					push();
				}
				return events;
			}
		};
	}]);

	app.factory('SunSprite', [ 'moment', function(moment) {

		function mean(values) {
			var sum = 0;
			for (var i = 0; i < values.length; ++i) {
					if (values[i] >= 0) {
						sum += values[i];
					}
			}
			return sum / values.length;
		}

		return {
			parse : function(s, settings) {
				var events = [];
				var csv = Baby.parse(s, { header : true, skipEmptyLines : true });
				if (csv.errors.length) {
					throw new Error(csv.errors[0].message + ' in row ' + csv.errors[0].row);
				}
				var hour = null;
				var rows = 0;
				var luxes = [];
				var uvs = [];
				function push() {
					var event = {
						'timestamp' : hour,
						'duration' : 3600000,
						'tag' : [ settings.tag ],
						'source' : {
							'title' : 'SunSprite',
							'url' : 'https://www.sunsprite.com/'
						}
					};
					var lux = mean(luxes);
					if (isFinite(lux)) {
						event['light'] = {
							'@value' : Math.round(lux),
							'unit' : 'lx'
						};
					}
					var uv = mean(uvs);
					if (isFinite(uv)) {
						event['rating'] = Math.max(0, 100 - Math.round(10 * uv));
					}
					events.push(event);
					hour = null;
					rows = 0;
					luxes = [];
					uvs = [];
				}
				$.each(csv.data, function(rowNum, row) {
					var t = moment.tz(row['date'], settings.timezone);
					var h = t.format('YYYY-MM-DDTHH:00:00.000Z');
					if (hour && hour !== h) {
						push();
					}
					++rows;
					hour = h;
					luxes.push(Number(row['lux']));
					uvs.push(Number(row['uv index']));
				});
				if (hour && rows) {
					push();
				}
				return events;
			}
		};
	}]);

	app.factory('HabitBull', [ 'moment', function(moment) {

		return {
			parse : function(s) {
				var events = [];
				var csv = Baby.parse(s, { header : true, skipEmptyLines : true });
				if (csv.errors.length) {
					throw new Error(csv.errors[0].message + ' in row ' + csv.errors[0].row);
				}
				$.each(csv.data, function(rowNum, row) {
					var event = {
						'timestamp' : moment(row['CalendarDate']).format('YYYY-MM-DDTHH:mm:ss.SSSZ'),
						'tag' : [ row['HabitName'] ],
						'count' : Math.round(Number(row['Value']))
					};
					if (row['CommentText']) {
						event['note'] = row['CommentText'];
					}
					events.push(event);
				});
				return events;
			}
		};
	}]);

	app.factory('SleepyHead', [ 'moment', function(moment) {

		return {
			parse : function(s, settings) {
				var events = [];
				var csv = Baby.parse(s, { header : true, skipEmptyLines : true });
				if (csv.errors.length) {
					throw new Error(csv.errors[0].message + ' in row ' + csv.errors[0].row);
				}
				$.each(csv.data, function(rowNum, row) {
					var t0 = moment.tz(row['Start'], settings.timezone);
					var t1 = moment.tz(row['End'], settings.timezone);
					var event = {
						'timestamp' : [
							t0.format('YYYY-MM-DDTHH:mm:ss.SSSZ'),
							t1.format('YYYY-MM-DDTHH:mm:ss.SSSZ'),
						],
						'duration' : t1.valueOf() - t0.valueOf(),
						'tag' : settings.tag,
						'rating' : Math.round(100 * Math.exp(-Number(row['AHI']) / 32)),
						'pressure' : {
							'@value' : Number(row['Pressure  Avg']),
							'unit' : 'cm_wg'
						}
					};
					events.push(event);
				});
				return events;
			}
		};
	}]);

	app.factory('MoodPanda', [ 'moment', function(moment) {

		return {
			parse : function(s, settings) {
				var events = [];
				var csv = Baby.parse(s, { header : true, skipEmptyLines : true });
				if (csv.errors.length) {
					throw new Error(csv.errors[0].message + ' in row ' + csv.errors[0].row);
				}
				$.each(csv.data, function(rowNum, row) {
					var event = {
						'timestamp' : moment.tz(row['Date'], 'DD/MM/YYYY HH:mm:ss', settings.timezone).format('YYYY-MM-DDTHH:mm:ss.SSSZ'),
						'tag' : [ settings.tag ],
						'rating' : Number(row['Rating']) * 10
					};
					if (row['Reason']) {
						event['note'] = row['Reason'];
					}
					events.push(event);
				});
				return events;
			}
		};
	}]);

	app.factory('LibreView', [ 'moment', function(moment) {

		return {
			parse : function(s, settings) {
				var lines = s.split("\n");
				if (lines.length > 0 && lines[0].startsWith('Export')) {
					lines.shift();
				}
				if (lines.length > 0 && lines[0].startsWith('Meter')) {
					lines.shift();
				}
				s = lines.join("\n");
				var events = [];
				var csv = Baby.parse(s, { header : false, skipEmptyLines : true });
				if (csv.errors.length) {
					throw new Error(csv.errors[0].message + ' in row ' + csv.errors[0].row);
				}
				$.each(csv.data, function(rowNum, row) {
					var t = moment.tz(row[2], 'MM-DD-YYYY LT', settings.timezone);
					var event = {
						'timestamp' : t.format('YYYY-MM-DDTHH:mm:00.000Z'),
						'tag' : [ settings.tag ],
						'source' : {
							'title' : row[0],
							'url' : 'https://www.libreview.com/'
						}
					};
					switch (row[3]) {
						case "0":
							event['tag'] = [ 'Glucose', 'Historic' ];
							event['concentration'] = {
								'@value' : Number(row[4]),
								'unit' : 'mg/dL'
							};
							break;
						case "1":
							event['tag'] = [ 'Glucose', 'Scan' ];
							event['concentration'] = {
								'@value' : Number(row[5]),
								'unit' : 'mg/dL'
							};
							break;
						case "2":
							event['tag'] = [ 'Glucose', 'Strip' ];
							event['concentration'] = {
								'@value' : Number(row[14]),
								'unit' : 'mg/dL'
							};
							break;
						case "6":
							event['tag'] = [ "Note" ];
							event['note'] = row[13];
							break;
						default:
							return;
					}
					events.push(event);
				});
				return events;
			}
		};
	}]);

	app.controller('ImportDialogController', ['$scope', '$http', '$routeParams', 'EventSpreadsheet', 'HealthKit', 'SleepCycle', 'SleepyHead', 'SunSprite', 'TapLog', 'MoodPanda', 'Nomie', 'Nomie5', 'Basis', 'HabitBull', 'LibreView', 'tracker', 'delay', function($scope, $http, $routeParams, EventSpreadsheet, HealthKit, SleepCycle, SleepyHead, SunSprite, TapLog, MoodPanda, Nomie, Nomie5, Basis, HabitBull, LibreView, tracker, delay) {

		$scope.bucketId = $routeParams.bucketId;
		$scope.formats = [
			{
				id : 'zenobase',
				label : 'Zenobase',
				description : 'Import a <b>.json</b> or <b>.csv</b> file exported from another bucket.<br/>The fields are described in the <a href="/#/api/events" target="_blank">API docs</a>.',
				parse : function(data) {
					if (data.charAt(0) === '{' || data.charAt(0) === '[') {
						var events = JSON.parse(data);
						if (events && events.events) {
							events = events.events;
						}
						return $.isArray(events) ? events : [];
					} else {
						return EventSpreadsheet.parse(data);
					}
				}
			},
			{
				id : 'basis',
				label : 'Basis',
				description : 'Import a <b>.csv</b> file from <a href="https://www.mybasis.com/" target="_blank">Basis</a>.',
				parse : function(data) {
					return Basis.parse(data, { tag : 'Basis' });
				}
			},
			{
				id : 'habitbull',
				label : 'HabitBull',
				description : 'Import a <b>.csv</b> file from <a href="http://www.habitbull.com/" target="_blank">HabitBull</a>.',
				parse : function(data) {
					return HabitBull.parse(data);
				}
			},
			{
				id : 'healthkit',
				label : 'HealthKit',
				description : 'Import HealthKit data from a <b>.csv</b> file exported with the <a href="http://quantifiedself.com/access-app/app" target="_blank">QS Access</a> app.',
				parse : function(data, settings) {
					return HealthKit.parse(data, settings);
				}
			},
			{
				id : 'libreview',
				label : 'LibreView',
				description : 'Import a <b>.csv</b> file containing blood sugar readings and notes from <a href="https://www.libreview.com/" target="_blank">LibreView</a>.',
				settings : '/import-libreview.html',
				parse : function(data, settings) {
					return LibreView.parse(data, settings);
				}
			},
			{
				id : 'nomie',
				label : 'Nomie',
				description : 'Import a <b>.json</b> or <b>.csv</b> file from <a href="https://nomie.io/" target="_blank">Nomie</a>.',
				settings : '/import-nomie.html',
				parse : function(data, settings) {
					return Nomie.parse(data, settings);
				}
			},
			{
				id : 'nomie5',
				label : 'Nomie 5',
				description : 'Import a <b>.csv</b> file from <a href="https://nomie.io/" target="_blank">Nomie</a>.',
				settings : '/import-nomie.html',
				parse : function(data, settings) {
					return Nomie5.parse(data, settings);
				}
			},
			{
				id : 'moodpanda',
				label : 'MoodPanda',
				description : 'Import a <b>.csv</b> file from <a href="https://moodpanda.com/" target="_blank">MoodPanda</a>.',
				settings : '/import-moodpanda.html',
				parse : function(data, settings) {
					return MoodPanda.parse(data, settings);
				}
			},
			{
				id : 'sleepcycle',
				label : 'SleepCycle',
				description : 'Import a <b>.csv</b> file from <a href="https://www.sleepcycle.com/" target="_blank">SleepCycle</a>.',
				parse : function(data) {
					return SleepCycle.parse(data);
				}
			},
			{
				id : 'sleepyhead',
				label : 'SleepyHead',
				description : 'Import a <b>.csv</b> file from <a href="https://sleepyhead.jedimark.net/" target="_blank">SleepyHead</a>.',
				settings : '/import-sleepyhead.html',
				parse : function(data, settings) {
					return SleepyHead.parse(data, settings);
				}
			},
			{
				id : 'sunsprite',
				label : 'SunSprite',
				description : 'Import a <b>.csv</b> file from <a href="https://www.sunsprite.com/" target="_blank">SunSprite</a>.',
				settings : '/import-sunsprite.html',
				parse : function(data, settings) {
					return SunSprite.parse(data, settings);
				}
			},
			{
				id : 'taplog',
				label : 'TapLog',
				description : 'Import a <b>.csv</b> file from <a href="https://welcome.taplog.info/" target="_blank">TapLog</a>.',
				settings : '/import-taplog.html',
				parse : function(data, settings) {
					return TapLog.parse(data, settings);
				}
			}
		];

		$scope.init = function(formatId) {
			$scope.importing = false;
			$scope.settings = {};
			$scope.message = '';
			$scope.events = [];
			$scope.offset = 0;
			$scope.clearFiles();
			$scope.format = $scope.formats[0];
			if (formatId) {
				$.each($scope.formats, function(i, format) {
					if (format.id === formatId) {
						$scope.format = format;
						return false;
					}
				});
			}
			tracker.event('dialog', 'import events');
		};
		$scope.isEmpty = function() {
			return !$scope.events || $scope.events.length === 0;
		};
		$scope.prev = function() {
			--$scope.offset;
		};
		$scope.next = function() {
			++$scope.offset;
		};
		$scope.setFiles = function(files) {
			$scope.message = '';
			$scope.events = [];
			$scope.offset = 0;
			$scope.$apply(function(scope) {
				var reader = new FileReader();
				reader.onload = function(e) {
					scope.$apply(function(scope) {
						try {
							scope.events = $scope.format.parse(e.target.result, $scope.settings);
						} catch(error) {
							scope.message = error.message;
							$scope.settings = {};
							$scope.clearFiles();
							throw error;
						}
					});
				};
				if (files.length) {
					reader.readAsText(files[0], $scope.settings.encoding);
				}
			});
		};
		$scope.submit = function() {
			$scope.alert.clear();
			$scope.importing = true;
			$http.post('/buckets/' + $scope.bucketId + '/', { 'events' : $scope.events })
				.success(function(response, status, headers) {
					$scope.alert.show('Imported events.', 'alert-success', headers('X-Command-ID'));
					$scope.settings = {};
					$scope.events = [];
					$scope.offset = 0;
					delay($scope.refresh);
					$scope.closeDialog();
					$scope.importing = false;
				})
				.error(function(response) {
					$scope.message = response.message || 'Couldn\'t import the file. Try again later, or contact support.';
					$scope.settings = {};
					$scope.events = [];
					$scope.offset = 0;
					$scope.clearFiles();
					$scope.importing = false;
				});
			tracker.event('action', 'import events');
		};
		$scope.clearFiles = function() {
			$('#select-import-file').fileupload('reset');
		};

		$scope.$watch('format', function(format) {
			if (format) {
				$scope.settings = {};
				$scope.message = '';
				$scope.events = [];
				$scope.offset = 0;
				$scope.clearFiles();
			}
		});
	}]);

	app.controller('ImportTapLogController', ['$scope', 'Field', function($scope, Field) {

		$scope.fields = Field.findByType('numeric');
		$scope.units = [];

		$scope.$watch('settings.field', function() {
			$scope.units = $scope.settings.field && Field.find($scope.settings.field).units || [];
			$scope.settings.unit = $scope.units.length ? $scope.units[0] : null;
		});
		$scope.settings = $scope.$parent.settings;
	}]);

	app.controller('ImportSunSpriteController', ['$scope', function($scope) {

		$scope.settings.tag = 'Sunlight';
		$scope.settings.timezone = 'UTC';

		$scope.settings = $scope.$parent.settings;
	}]);

	app.controller('ImportLibreViewController', ['$scope', function($scope) {

		$scope.settings.timezone = 'UTC';
		$scope.settings.encoding = 'UTF-16LE';

		$scope.settings = $scope.$parent.settings;
	}]);

	app.controller('ImportNomieController', ['$scope', 'Field', function($scope, Field) {

		$scope.fields = Field.findByType('numeric');
		$scope.units = [];

		$scope.$watch('settings.field', function() {
			$scope.units = $scope.settings.field && Field.find($scope.settings.field).units || [];
			$scope.settings.unit = $scope.units.length ? $scope.units[0] : null;
		});
		$scope.settings = $scope.$parent.settings;
	}]);

	app.controller('ImportSleepyHeadController', ['$scope', function($scope) {

		$scope.settings.tag = 'sleep';
		$scope.settings.timezone = 'UTC';

		$scope.settings = $scope.$parent.settings;
	}]);

	app.controller('ImportMoodPandaController', ['$scope', function($scope) {

		$scope.settings.tag = 'Mood';
		$scope.settings.timezone = 'UTC';

		$scope.settings = $scope.$parent.settings;
	}]);


	app.controller('ExportDialogController', ['$scope', '$routeParams', '$window', 'token', 'tracker', function($scope, $routeParams, $window, token, tracker) {

		$scope.csvLimit = 16000;
		$scope.bucketId = $routeParams.bucketId;

		$scope.init = function() {
			if ($scope.total > $scope.csvLimit) {
				$scope.message = '<b>csv</b> export is limited to ' + $scope.csvLimit + ' events; add one or more constraints to enable.';
			} else if ($scope.constraints.length > 0) {
				$scope.message = 'Only events matching the current constraints will be exported.';
			} else {
				$scope.message = '';
			}
			$scope.media = 'json';
			tracker.event('dialog', 'export events');
		};
		$scope.url = function() {
			var url = '/buckets/' + $scope.bucketId + '/';
			var params = {};
			if ($scope.constraints.length > 0) {
				params.q = $scope.constraints;
			}
			if (token.get()) {
				params.code = token.get();
			}
			if ($scope.media === 'csv') {
				params.accept = 'text/plain';
			}
			if (!$.isEmptyObject(params)) {
				url += '?' + $.param(params, true);
			}
			return url;
		};
		$scope.file = function() {
			return $scope.bucketId + '.' + $scope.media;
		};
		$scope.submit = function() {
			$scope.alert.clear();
			$scope.closeDialog();
			tracker.event('action', 'export events', $scope.format);
		};
	}]);

}());
