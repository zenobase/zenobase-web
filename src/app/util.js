(function() {

	'use strict';

	var app = angular.module('appModule');

	app.factory('delay', ['$timeout', function($timeout) {
		return function(callback) {
			$timeout(callback, 1000);
		};
	}]);

	app.factory('localStorage', ['$window', function($window) {
		var store = {};
		return $window.localStorage || {
			getItem : function(key) {
				return store[key];
			},
			setItem : function(key, value) {
				store[key] = value;
			},
			removeItem : function(key) {
				delete store[key];
			}
		};
	}]);

	app.factory('moment', function() {

		// See https://github.com/timrwood/moment/issues/537
		moment.fn.fromNowOrNow = function(alwaysRelative, a) {
			var diff = Math.abs(moment().diff(this));
			if (diff < 60000) { // less than a minute
				return 'just now';
			}
			if (!alwaysRelative && diff >= 79200000) { // 22 hours or more
				return this.format('MMM D, YYYY HH:mm');
			}
			return this.fromNow(a);
		};

		// See https://github.com/timrwood/moment/issues/463
		moment.duration.fn.countdown = function(precision) {
			var args = [];
			if (this.years()) {
				args.push(this.years() + 'y');
			}
			if (this.months()) {
				args.push(this.months() + 'm');
			}
			if (this.days()) {
				args.push(this.days() + 'd');
			}
			if (this.hours()) {
				args.push(this.hours() + 'h');
			}
			if (this.minutes()) {
				args.push(this.minutes() + 'min');
			}
			if (this.seconds()) {
				args.push(this.seconds() + 's');
			}
			if (precision > 0 && args.length > 1) {
				args = args.slice(0, precision);
			}
			return args.length ? args.join(' ') : this.milliseconds() + 'ms';
		};

		moment.duration.fn.countdownCompact = function() {
			var minutes = Math.floor(this.asMinutes());
			var seconds = this.seconds();
			if (seconds < 10) {
				seconds = '0' + seconds;
			}
			return minutes + '\'' + seconds + '"';
		};

		return moment;
	});

	app.factory('token', ['$http', 'localStorage', function($http, localStorage) {
		var key = 'access_token';
		var get = function() {
			return localStorage.getItem(key);
		};
		var set = function(token) {
			if (token) {
				localStorage.setItem(key, token);
			} else {
				localStorage.removeItem(key);
			}
			configure(token);
		};
		var configure = function(token) {
			$http.defaults.headers.common['Authorization'] = token ? 'Bearer ' + token : null;
		};
		configure(get());
		return {
			get : get,
			set : set
		};
	}]);

	app.factory('tracker', [function() {
		var noop = function() {};
		return {
			event : noop,
			timing : noop,
			pageview : noop,
			variable : noop
		};
	}]);

	app.factory('timezone', ['moment', function(moment) {
		return moment().format('Z');
	}]);

	app.factory('braintree', ['$window', function($window) {
		return $window.braintree;
	}]);

	app.factory('$exceptionHandler', ['$log', 'tracker', function($log, tracker) {
		return function(e) {
			$log.error.apply($log, arguments);
			tracker.event('error', e.toString());
		};
	}]);

	app.factory('Alert', function() {

		var Alert = function() {
			this.clear();
		};

		Alert.prototype.show = function(message, level, undo, onClick) {
			this.message = message;
			this.level = level;
			this.undo = undo;
			this.onClick = onClick;
		};

		Alert.prototype.clear = function() {
			this.message = '';
			this.level = 'hide';
			this.undo = '';
			this.onClick = null;
		};

		return Alert;
	});

	app.factory('User', [ '$http', '$cacheFactory', function($http, $cacheFactory) {

		var cache = $cacheFactory('User', { capacity : 100 });
		var apiBaseUrl = (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_API_BASE_URL) || '';

		var User = function(data) {
			$.extend(this, data);
			cache.put(this['@id'], this);
		};

		User.prototype.getName = function() {
			return this.name || 'guest';
		};

		User.prototype.isGuest = function() {
			return !this.name;
		};

		User.find = function(id) {
			console.assert(id, "Can't find a user without an id");
			var user = cache.get(id);
			if (!user) {
				$.ajax(apiBaseUrl + '/users/' + id, { async : false, xhrFields : { withCredentials : !!apiBaseUrl }, success : function(response) {
					user = new User(response);
					cache.put(user['@id'], user);
				}});
			}
			return user;
		};

		return User;
	}]);

	app.factory('Constraint', function() {

		var fieldSeparator = ':';
		var subfieldSeparator = '$';

		var Constraint = function(field, value, negated, subfield) {
			this.field = field;
			this.value = value.toString();
			this.negated = negated;
			this.subfield = subfield;
		};

		Constraint.prototype.invert = function() {
			return new Constraint(this.field, this.value, !this.negated, this.subfield);
		};

		Constraint.prototype.toString = function() {
			var field = this.field + (this.subfield ? subfieldSeparator + this.subfield : '');
			return (this.negated ? '-' : '') + field + fieldSeparator + this.value;
		};

		Constraint.prototype.shortValue = function() {
			var p = this.value.indexOf(' OR ');
			return p === -1 ? this.value : this.value.substring(0, p) + '...';
		};

		Constraint.parse = function(s) {
			var negated = false;
			if (s.length > 1 && s.charAt(0) == '-') {
				negated = true;
				s = s.substring(1);
			}
			var pos = s.indexOf(fieldSeparator);
			if (pos < 1 || pos > s.length - 1) {
				throw 'Can\'t parse constraint: ' + s;
			}
			var field = s.substring(0, pos);
			var subfield = null;
			var pos2 = field.indexOf(subfieldSeparator);
			if (pos2 > 0) {
				subfield = field.substring(pos2 + 1);
				field = field.substring(0, pos2);
			}
			var value = s.substring(pos + 1);
			return new Constraint(field, value, negated, subfield);
		};

		return Constraint;
	});

	app.factory('Spreadsheet', function() {

		var Spreadsheet = function(headers) {
			this.headers = headers;
			this.records = [];
		};

		Spreadsheet.prototype.addHeader = function(header) {
			this.headers.push(header);
		};

		Spreadsheet.prototype.addRecord = function(record) {
			this.records.push(record);
		};

		Spreadsheet.prototype.mergeRecord = function(record) {
			console.assert(record.length === 2);
			for (var i = 0; i < this.records.length; ++i) {
				if (this.records[i][0] === record[0]) {
					this.records[i].push(record.slice(1));
					return;
				} else if (this.records[i][0] > record[0]) {
					this.records.splice(i, 0, [ record[0], '', record[1] ]);
					return;
				}
			}
			this.records.push([ record[0], '', record[1] ]);
		};

		Spreadsheet.prototype.toBlob = function() {
			var data = this.headers.join('\t') + '\n';
			$.each(this.records, function(i, record) {
				data += record.join('\t') + '\n';
			});
			return new Blob([ data ], { type: 'text/plain' });
		};

		return Spreadsheet;
	});

	app.factory('random', function() {
		return {
			id : function id() {
				var len = 5;
				var chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
				var value = '';
				var pos;
				for (var i = 0; i < len; ++i) {
					pos = Math.floor(Math.random() * chars.length);
					value += chars.substring(pos, pos + 1);
				}
				return value;
			}
		};
	});

	app.factory('unauthorizedInterceptor', ['$q', '$rootScope', function($q, $rootScope) {
		return {
			response : function(response) {
				return response;
			},
			responseError : function(response) {
				if (response.status === 401) {
					$rootScope.$broadcast('event:unauthorized');
				}
				return $q.reject(response);
			}
		};
	}]);

	app.config(['$httpProvider', function($httpProvider) {
		$httpProvider.interceptors.push('apiBaseUrlInterceptor');
		$httpProvider.interceptors.push('unauthorizedInterceptor');
	}]);

	app.factory('apiBaseUrlInterceptor', function() {
		var baseUrl = (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_API_BASE_URL) || '';

		function hasFileExtension(url) {
			return /\.\w+$/.test(url.split('?')[0]);
		}

		function isApiRequest(url) {
			return url.charAt(0) === '/' && !hasFileExtension(url);
		}

		return {
			'request': function(config) {
				if (baseUrl && config.url && isApiRequest(config.url)) {
					config.url = baseUrl + config.url;
					config.withCredentials = true;
				}
				return config;
			}
		};
	});

}());
