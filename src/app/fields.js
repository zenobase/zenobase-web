(() => {
	var app = angular.module('appModule');

	app.factory('Field', [
		'User',
		'moment',
		(User, moment) => {
			var fields = [];
			var fieldsByName = {};

			var Field = function (name, icon, type, units, readOnly, toText, toHtml, toNumber, formatAxis, minValue, maxValue, subfields) {
				this.name = name;
				this.icon = icon;
				this.type = type;
				this.units = units;
				this.readOnly = readOnly;
				this.toText = toText;
				this.toHtml = toHtml;
				this.toNumber = toNumber;
				this.formatAxis = formatAxis;
				this.minValue = minValue;
				this.maxValue = maxValue;
				this.subfields = subfields;
			};

			var toNumber = (value) => {
				if (value === null) {
					return null;
				}
				if (typeof value === 'number') {
					return value;
				}
				if (typeof value === 'string') {
					return Number(value);
				}
				if (typeof value === 'object' && Object.hasOwn(value, '@value')) {
					return value['@value'];
				}
				return Number.NaN;
			};

			Field.find = (name) => fieldsByName[name];

			Field.findAll = () => fields;

			Field.findEditable = () => $.grep(fields, (field) => !field.readOnly);

			Field.findByType = (type) => $.grep(fields, (field) => field.type === type).sort((a, b) => (a.name > b.name ? 1 : -1));

			function encode(value) {
				return $('<div />').text(value).html();
			}

			function register(fieldOptions) {
				console.assert(fieldOptions.name, 'missing <name>');
				var field = new Field(
					fieldOptions.name,
					fieldOptions.icon || '',
					fieldOptions.type || 'numeric',
					fieldOptions.units || [],
					fieldOptions.readOnly === true,
					fieldOptions.toText || ((value) => value),
					fieldOptions.toHtml || ((value) => value),
					fieldOptions.toNumber || toNumber,
					fieldOptions.formatAxis || (() => {}),
					fieldOptions.minValue,
					fieldOptions.maxValue,
					fieldOptions.subfields,
				);
				fields.push(field);
				fieldsByName[field.name] = field;
			}

			register({
				name: 'tag',
				icon: 'fa-tag',
				type: 'text',
				toHtml: function (value) {
					return '<span class="nowrap">' + '<i class="fa ' + this.icon + '" title="Tag"></i> ' + encode(value) + '</span>';
				},
			});

			register({
				name: 'resource',
				icon: 'fa-bookmark',
				type: 'object',
				toHtml: function (value) {
					return (
						'<span>' +
						'<i class="fa ' +
						this.icon +
						'" title="Resource"></i>&nbsp;' +
						'<a href="/to?url=' +
						encode(value.url) +
						'" target="_blank" rel="nofollow noopener noreferrer">' +
						encode(value.title) +
						'</a>' +
						'</span>'
					);
				},
			});

			register({
				name: 'distance',
				icon: 'fa-arrows-h',
				type: 'numeric',
				units: ['mi', 'yd', 'ft', 'in', 'km', 'm', 'cm', 'mm'],
				toText: (value) => (typeof value === 'object' ? value['@value'] + ' ' + value.unit : value),
				toHtml: function (value) {
					return '<span class="nowrap">' + '<i class="fa ' + this.icon + '" title="Distance"></i> ' + this.toText(value) + '</span>';
				},
			});

			register({
				name: 'height',
				icon: 'fa-arrows-v',
				type: 'numeric',
				units: ['mi', 'ft', 'in', 'km', 'm', 'cm', 'mm'],
				toText: (value) => (typeof value === 'object' ? value['@value'] + ' ' + value.unit : value),
				toHtml: function (value) {
					return '<span class="nowrap">' + '<i class="fa ' + this.icon + '" title="Height"></i> ' + this.toText(value) + '</span>';
				},
			});

			register({
				name: 'weight',
				icon: 'fa-caret-square-o-down',
				type: 'numeric',
				units: ['lb', 'oz', 'kg', 'g', 'mg', 'ug', 'ng', 'st'],
				toText: (value) => (typeof value === 'object' ? value['@value'] + ' ' + value.unit : value),
				toHtml: function (value) {
					return '<span class="nowrap">' + '<i class="fa ' + this.icon + '" title="Weight"></i> ' + this.toText(value) + '</span>';
				},
			});

			register({
				name: 'percentage',
				icon: 'fa-th',
				type: 'numeric',
				toText: (value) => value + '%',
				toHtml: function (value) {
					return '<span class="nowrap">' + '<i class="fa ' + this.icon + '" title="Percentage"></i> <abbr title="' + value + '%">' + Math.round(value) + '%</abbr>' + '</span>';
				},
				minValue: 0,
				maxValue: 100,
			});

			register({
				name: 'moon',
				icon: 'fa-moon-o',
				type: 'numeric',
				toHtml: function (value) {
					return '<span class="nowrap">' + '<i class="fa ' + this.icon + '" title="Moon"></i> ' + value + '%' + '</span>';
				},
				minValue: 0,
				maxValue: 100,
			});

			register({
				name: 'volume',
				icon: 'fa-flask',
				type: 'numeric',
				units: ['L', 'dL', 'cL', 'mL', 'gal', 'qt', 'pt', 'cups', 'fl_oz'],
				toText: (value) => (typeof value === 'object' ? value['@value'] + ' ' + value.unit : value),
				toHtml: function (value) {
					return '<span class="nowrap">' + '<i class="fa ' + this.icon + '" title="Volume"></i> ' + this.toText(value) + '</span>';
				},
			});

			register({
				name: 'concentration',
				icon: 'fa-tint',
				type: 'numeric',
				units: ['g/L', 'mg/L', 'ug/L', 'ng/L', 'pg/L', 'g/dL', 'mg/dL', 'ug/dL', 'ng/dL', 'pg/dL', 'g/mL', 'mg/mL', 'ug/mL', 'ng/mL', 'pg/mL'],
				toText: (value) => (typeof value === 'object' ? value['@value'] + ' ' + value.unit : value),
				toHtml: function (value) {
					return '<span class="nowrap">' + '<i class="fa ' + this.icon + '" title="Volume"></i> ' + this.toText(value) + '</span>';
				},
			});

			register({
				name: 'distance/volume',
				icon: 'fa-flask',
				type: 'numeric',
				units: ['mpg', 'kpl'],
				toText: (value) => (typeof value === 'object' ? value['@value'] + ' ' + value.unit : value),
				toHtml: function (value) {
					return '<span class="nowrap">' + '<i class="fa ' + this.icon + '" title="Distance/Volume"></i> ' + this.toText(value) + '</span>';
				},
			});

			register({
				name: 'humidity',
				icon: 'fa-tint',
				type: 'numeric',
				toHtml: function (value) {
					return '<span class="nowrap">' + '<i class="fa ' + this.icon + '" title="Humidity"></i> ' + value + '%' + '</span>';
				},
			});

			register({
				name: 'pressure',
				icon: 'fa-arrows-alt',
				type: 'numeric',
				units: ['Pa', 'hPa', 'kPa', 'mbar', 'bar', 'mmHg', 'inHg', 'psi', 'cm_wg'],
				toText: (value) => (typeof value === 'object' ? value['@value'] + ' ' + value.unit : value),
				toHtml: function (value) {
					return '<span class="nowrap">' + '<i class="fa ' + this.icon + '" title="Pressure"></i> ' + this.toText(value) + '</span>';
				},
			});

			register({
				name: 'sound',
				icon: 'fa-volume-up',
				type: 'numeric',
				units: ['dB'],
				toText: (value) => (typeof value === 'object' ? value['@value'] + ' ' + value.unit : value),
				toHtml: function (value) {
					return '<span class="nowrap">' + '<i class="fa ' + this.icon + '" title="Sound Level"></i> ' + this.toText(value) + '</span>';
				},
			});

			register({
				name: 'location',
				icon: 'fa-map-marker',
				type: 'object',
				toText: (value) => (typeof value === 'object' ? encode(Math.round(value.lat * 1000) / 1000 + ', ' + Math.round(value.lon * 1000) / 1000) : ''),
				toHtml: function (value, interactive) {
					if (interactive) {
						var ngClick = "addConstraint('location', '" + this.toText(value).replace(' ', '') + '~100 m' + "', false)";
						return '<span class="nowrap">' + '<i class="fa ' + this.icon + '" title="Location"></i> ' + '<a data-ng-click="' + ngClick + '">' + this.toText(value) + '</a>' + '</span>';
					} else {
						return '<span class="nowrap">' + '<i class="fa ' + this.icon + '" title="Location"></i> ' + this.toText(value) + '</span>';
					}
				},
			});

			register({
				name: 'timestamp',
				icon: 'fa-calendar-o',
				type: 'object',
				toHtml: function (value) {
					return (
						'<span class="nowrap">' +
						'<i class="fa ' +
						this.icon +
						'" title="Timestamp"></i> ' +
						'<abbr title="' +
						value +
						'">' +
						moment(value).utcOffset(value).fromNowOrNow(false) +
						'</abbr>' +
						'</span>'
					);
				},
				subfields: ['', 'min', 'max'],
			});

			register({
				name: 'velocity',
				icon: 'fa-tachometer',
				type: 'numeric',
				units: ['m/s', 'mph', 'kmh', 'kn', 'Mach'],
				toText: (value) => (typeof value === 'object' ? value['@value'] + ' ' + value.unit : value),
				toHtml: function (value) {
					return '<span class="nowrap">' + '<i class="fa ' + this.icon + '" title="Velocity"></i> ' + this.toText(value) + '</span>';
				},
			});

			register({
				name: 'pace',
				icon: 'fa-clock-o',
				type: 'numeric',
				units: ['s/km', 's/mi'],
				toText: (value) => (typeof value === 'object' ? moment.duration(value['@value'], 'seconds').countdownCompact() + '/' + value.unit.substring(2) : value),
				toHtml: function (value) {
					return '<span class="nowrap">' + '<i class="fa ' + this.icon + '" title="Pace"></i> ' + this.toText(value) + '</span>';
				},
				formatAxis: (options) => {
					options.type = 'datetime';
					options.labels = {
						autoRotation: false,
						formatter: function () {
							return this.value !== 0 ? moment.duration(this.value, 'seconds').countdownCompact() : '0';
						},
					};
				},
				minValue: 0,
			});

			register({
				name: 'duration',
				icon: 'fa-clock-o',
				type: 'numeric',
				toText: (value) => (value ? moment.duration(toNumber(value)).countdown(2) : 0),
				toHtml: function (value) {
					return (
						'<span class="nowrap">' +
						'<i class="fa ' +
						this.icon +
						'" title="Duration"></i> ' +
						'<abbr title="' +
						moment.duration(value).toISOString() +
						'">' +
						this.toText(value) +
						'</abbr>' +
						'</span>'
					);
				},
				toNumber: (value) => {
					var n = toNumber(value);
					if (value && Number.isNaN(n)) {
						$.each(value.split(' '), (i, token) => {
							var m = /^(-?\d+)(d|h|min|s)?$/.exec(token);
							if (m) {
								var ms = Number(m[1]);
								switch (m[2]) {
									case 'd':
										ms *= 24;
									/* falls through */
									case 'h':
										ms *= 60;
									/* falls through */
									case 'min':
										ms *= 60;
									/* falls through */
									case 's':
										ms *= 1000;
									/* falls through */
								}
								n = Number.isNaN(n) ? ms : n + ms;
							} else {
								n = Number.NaN;
								return false;
							}
						});
					}
					return n;
				},
				formatAxis: (options) => {
					options.type = 'datetime';
					options.labels = {
						autoRotation: false,
						formatter: function () {
							return this.value !== 0 ? moment.duration(this.value).countdown(2) : '0';
						},
					};
				},
				minValue: 0,
			});

			register({
				name: 'frequency',
				icon: 'fa-heart',
				type: 'numeric',
				units: ['bpm', 'rpm', 'Hz'],
				toText: (value) => (typeof value === 'object' ? value['@value'] + ' ' + value.unit : value),
				toHtml: function (value) {
					return '<span class="nowrap">' + '<i class="fa ' + this.icon + '" title="Frequency"></i> ' + this.toText(value) + '</span>';
				},
			});

			register({
				name: 'bits',
				icon: 'fa-hdd-o',
				type: 'numeric',
				units: ['bit', 'B', 'KB', 'MB', 'GB', 'TB', 'PB', 'KiB', 'MiB', 'GiB', 'TiB', 'PiB'],
				toText: (value) => (typeof value === 'object' ? value['@value'] + ' ' + value.unit : value),
				toHtml: function (value) {
					return '<span class="nowrap">' + '<i class="fa ' + this.icon + '" title="Bits"></i> ' + this.toText(value) + '</span>';
				},
			});

			register({
				name: 'count',
				icon: 'fa-th',
				type: 'numeric',
				toHtml: function (value) {
					return '<span class="nowrap">' + '<i class="fa ' + this.icon + '" title="Count"></i> ' + value.toLocaleString() + '</span>';
				},
				minValue: 0,
			});

			register({
				name: 'energy',
				icon: 'fa-fire',
				type: 'numeric',
				units: ['J', 'kJ', 'cal', 'kcal', 'kWh'],
				toText: (value) => (typeof value === 'object' ? value['@value'] + ' ' + value.unit : value),
				toHtml: function (value) {
					return '<span class="nowrap">' + '<i class="fa ' + this.icon + '" title="Energy"></i> ' + this.toText(value) + '</span>';
				},
			});

			register({
				name: 'light',
				icon: 'fa-sun-o',
				type: 'numeric',
				units: ['lx'],
				toText: (value) => (typeof value === 'object' ? value['@value'] + ' ' + value.unit : value),
				toHtml: function (value) {
					return '<span class="nowrap">' + '<i class="fa ' + this.icon + '" title="Light"></i> ' + this.toText(value) + '</span>';
				},
			});

			register({
				name: 'temperature',
				icon: 'fa-fire',
				type: 'numeric',
				units: ['C', 'F', 'K'],
				toText: (value) => (typeof value === 'object' ? value['@value'] + ' ' + value.unit : value),
				toHtml: function (value) {
					return '<span class="nowrap">' + '<i class="fa ' + this.icon + '" title="Temperature"></i> ' + this.toText(value) + '</span>';
				},
			});

			register({
				name: 'rating',
				icon: 'fa-star',
				type: 'numeric',
				toText: (value) => value + '%',
				toHtml: function (value) {
					var stars = Math.round((value || 0) / 20);
					var html = '<span class="nowrap" title="' + this.toText(value) + '">';
					for (var i = 0; i < 5; ++i) {
						html += '<i class="fa ' + (stars > i ? 'fa-star' : 'fa-star-o') + '"></i>';
					}
					html += '</span>';
					return html;
				},
				minValue: 0,
				maxValue: 100,
			});

			register({
				name: 'currency',
				icon: 'fa-money',
				type: 'numeric',
				toText: (value) => value.toFixed(2),
				toHtml: function (value) {
					return '<span class="nowrap">' + '<i class="fa ' + this.icon + '" title="Currency"></i> ' + this.toText(value) + '</span>';
				},
			});

			register({
				name: 'note',
				icon: 'fa-comment-o',
				type: 'object',
				toHtml: function (value) {
					return '<span>' + '<i class="fa ' + this.icon + '" title="Note"></i>&nbsp;' + encode(value) + '</span>';
				},
			});

			register({
				name: 'author',
				icon: 'fa-user',
				type: 'text',
				readOnly: true,
				toText: (value) => User.find(value).getName(),
				toHtml: function (value) {
					return '<span class="nowrap">' + '<i class="fa ' + this.icon + '" title="User"></i> ' + this.toText(value) + '</span>';
				},
			});

			register({
				name: 'source',
				icon: 'fa-external-link',
				type: 'object',
				readOnly: true,
				toText: (value) => value.title,
				toHtml: function (value) {
					return (
						'<span class="nowrap">' +
						'<i class="fa ' +
						this.icon +
						'" title="Source"></i> <a href="/to?url=' +
						encode(value.url) +
						'" target="_blank" rel="nofollow">' +
						encode(value.title) +
						'</a>' +
						'</span>'
					);
				},
			});

			return Field;
		},
	]);
})();
