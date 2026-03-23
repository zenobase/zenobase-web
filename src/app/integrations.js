(function() {

	'use strict';

	var app = angular.module('appModule');

	app.controller('FitBarkSettingsController', ['$scope', 'moment', function($scope, moment) {

		$scope.init = function() {
			$scope.settings = $scope.$parent.$parent.settings = {
					tag : '',
					hourly : false,
					marker : new Date(moment().utc().subtract(3, 'months').startOf('month').valueOf())
			};
		};

		$scope.init();
	}]);

	app.controller('FitbitActivitiesSettingsController', ['$scope', 'moment', function($scope, moment) {

		$scope.init = function() {
			$scope.settings = $scope.$parent.$parent.settings = {
					marker : new Date(moment().utc().subtract(3, 'months').startOf('month').valueOf())
			};
		};

		$scope.init();
	}]);

	app.controller('FitbitBurnSettingsController', ['$scope', 'moment', function($scope, moment) {

		$scope.init = function() {
			$scope.settings = $scope.$parent.$parent.settings = {
					tag : 'burn',
					hourly : false,
					marker : new Date(moment().utc().subtract(3, 'months').startOf('month').valueOf())
			};
		};

		$scope.init();
	}]);

	app.controller('FitbitCardioSettingsController', ['$scope', 'moment', function($scope, moment) {

		$scope.init = function() {
			$scope.settings = $scope.$parent.$parent.settings = {
					tag : 'heart rate',
					hourly : false,
					marker : new Date(moment().utc().subtract(3, 'months').startOf('month').valueOf())
			};
		};

		$scope.init();
	}]);

	app.controller('FitbitFoodSettingsController', ['$scope', 'moment', function($scope, moment) {

		$scope.init = function() {
			$scope.settings = $scope.$parent.$parent.settings = {
					tag : 'food',
					marker : new Date(moment().utc().subtract(1, 'years').startOf('month').valueOf())
			};
		};

		$scope.init();
	}]);

	app.controller('FitbitSleepSettingsController', ['$scope', 'moment', function($scope, moment) {

		$scope.init = function() {
			$scope.settings = $scope.$parent.$parent.settings = {
					tag : 'sleep',
					marker : new Date(moment().utc().subtract(3, 'months').startOf('month').valueOf())
			};
		};

		$scope.init();
	}]);

	app.controller('FitbitStepsSettingsController', ['$scope', 'moment', function($scope, moment) {

		$scope.init = function() {
			$scope.settings = $scope.$parent.$parent.settings = {
					tag : 'steps',
					hourly : false,
					marker : new Date(moment().utc().subtract(3, 'months').startOf('month').valueOf())
			};
		};

		$scope.init();
	}]);

	app.controller('FitbitWeightSettingsController', ['$scope', 'moment', function($scope, moment) {

		$scope.init = function() {
			$scope.settings = $scope.$parent.$parent.settings = {
					tag : 'body',
					marker : new Date(moment().utc().subtract(3, 'months').startOf('month').valueOf())
			};
		};

		$scope.init();
	}]);

	app.controller('FoursquareSettingsController', ['$scope', 'moment', function($scope, moment) {

		$scope.init = function() {
			$scope.settings = $scope.$parent.$parent.settings = {
					marker : new Date(moment().utc().subtract(12, 'months').startOf('month').valueOf())
			};
		};

		$scope.init();
	}]);

	app.controller('NetatmoSettingsController', ['$scope', 'moment', function($scope, moment) {

		$scope.init = function() {
			$scope.settings = $scope.$parent.$parent.settings = {
					modules : true,
					hourly : true,
					marker : new Date(moment().utc().subtract(3, 'months').startOf('month').valueOf())
			};
		};

		$scope.init();
	}]);

	app.controller('RunkeeperActivitiesSettingsController', ['$scope', '$http', 'Field', 'moment', function($scope, $http, Field, moment) {

		$scope.init = function() {
			$scope.settings = $scope.$parent.$parent.settings = {
					unit : 'km',
					marker : new Date(moment().utc().subtract(12, 'months').startOf('month').valueOf()),
					timezone : 'UTC'
			};
		};
		$scope.getUnits = function() {
			return Field.find('distance').units;
		};

		$scope.init();
	}]);

	app.controller('RunkeeperWeightSettingsController', ['$scope', '$http', 'Field', 'moment', function($scope, $http, Field, moment) {

		$scope.init = function() {
			$scope.settings = $scope.$parent.$parent.settings = {
					tag : 'Body',
					unit : 'lb',
					marker : new Date(moment().utc().subtract(12, 'months').startOf('month').valueOf()),
					timezone : 'UTC'
			};
		};
		$scope.getUnits = function() {
			return Field.find('weight').units;
		};

		$scope.init();
	}]);

	app.controller('StravaSettingsController', ['$scope', 'moment', function($scope, moment) {

		$scope.init = function() {
			$scope.settings = $scope.$parent.$parent.settings = {
					metric : false,
					marker : new Date(moment().utc().subtract(12, 'months').startOf('month').valueOf())
			};
		};

		$scope.init();
	}]);

	app.controller('BeeminderSettingsController', ['$scope', 'moment', 'Field', function($scope, moment, Field) {

		$scope.keyField = 'timestamp';

		$scope.init = function() {
			$scope.settings = $scope.$parent.$parent.settings = {
					goal : null,
					filter : null,
					key_field : $scope.keyField,
					field : null,
					unit : null,
					marker : new Date(moment().utc().startOf('month').valueOf())
			};
		};
		function isUnitValid() {
			var units = $scope.getUnits();
			return units.length === 0 ?
					$scope.settings.unit === null :
					$.inArray($scope.settings.unit, units) != -1;
		}
		function updateUnitValidity() {
			$scope.$parent.$parent.form.unit.$setValidity('unit', isUnitValid());
		}
		$scope.getFields = function() {
			return Field.findByType('numeric');
		};
		$scope.getUnits = function() {
			var f = Field.find($scope.settings.field);
			return f ? f.units : [];
		};
		$scope.subfields = $.map(Field.find($scope.keyField).subfields, function(subfield) {
			return { label : subfield, value : (subfield ? $scope.keyField + '$' + subfield : $scope.keyField) };
		});

		$scope.$watch('settings.field', function() {
			if (!isUnitValid()) {
				$scope.settings.unit = null;
			}
			updateUnitValidity();
		});
		$scope.$watch('settings.unit', function() {
			updateUnitValidity();
		});
		$scope.init();
	}]);

	app.controller('HexoskinActivitiesSettingsController', ['$scope', 'moment', function($scope, moment) {

		$scope.init = function() {
			$scope.settings = $scope.$parent.$parent.settings = {
					tag : 'Training',
					marker : new Date(moment().utc().subtract(12, 'months').startOf('month').valueOf()),
					timezone : 'UTC'
			};
		};

		$scope.init();
	}]);

	app.controller('HexoskinSleepSettingsController', ['$scope', 'moment', function($scope, moment) {

		$scope.init = function() {
			$scope.settings = $scope.$parent.$parent.settings = {
					tag : 'Sleep',
					marker : new Date(moment().utc().subtract(12, 'months').startOf('month').valueOf()),
					timezone : 'UTC'
			};
		};

		$scope.init();
	}]);

	app.controller('MapMyFitnessActivitiesSettingsController', ['$scope', 'moment', function($scope, moment) {

		$scope.init = function() {
			$scope.settings = $scope.$parent.$parent.settings = {
					marker : new Date(moment().utc().subtract(12, 'months').startOf('month').valueOf())
			};
		};

		$scope.init();
	}]);

	app.controller('MapMyFitnessSleepSettingsController', ['$scope', 'moment', function($scope, moment) {

		$scope.init = function() {
			$scope.settings = $scope.$parent.$parent.settings = {
					tag : 'Sleep',
					marker : new Date(moment().utc().subtract(12, 'months').startOf('month').valueOf())
			};
		};

		$scope.init();
	}]);

	app.controller('MapMyFitnessWeightSettingsController', ['$scope', 'moment', function($scope, moment) {

		$scope.init = function() {
			$scope.settings = $scope.$parent.$parent.settings = {
					tag : 'Body',
					marker : new Date(moment().utc().subtract(12, 'months').startOf('month').valueOf())
			};
		};

		$scope.init();
	}]);

	app.controller('ReporterSettingsController', ['$scope', function($scope) {

		$scope.init = function() {
			$scope.settings = $scope.$parent.$parent.settings = {
					folder : 'Apps/Reporter-App'
			};
		};

		$scope.init();
	}]);

	app.controller('RescueTimeProductivitySettingsController', ['$scope', '$http', 'moment', function($scope, $http, moment) {
		$scope.kinds = [
			{ 'id' : 'efficiency', 'label' : 'None' },
			{ 'id' : 'overview', 'label' : 'Category' },
			{ 'id' : 'category', 'label' : 'Sub-Category' }
		];
		$scope.sources = [
			{ 'id' : '', 'label' : 'All' },
			{ 'id' : 'computers', 'label' : 'Computers' },
			{ 'id' : 'mobile', 'label' : 'Mobile' },
			{ 'id' : 'offline', 'label' : 'Offline' }
		];
		$scope.init = function() {
			$scope.settings = $scope.$parent.$parent.settings = {
					tag : '',
					kind : 'efficiency',
					source : '',
					marker : new Date(moment().utc().subtract(3, 'months').startOf('month').valueOf()),
					timezone : 'UTC'
			};
		};

		$scope.init();
	}]);

	app.controller('LastFmTracksSettingsController', ['$scope', '$http', 'moment', function($scope, $http, moment) {

		$scope.init = function() {
			$scope.settings = $scope.$parent.$parent.settings = {
					tag : 'track',
					marker : new Date(moment().utc().subtract(3, 'months').startOf('month').valueOf()),
					timezone : 'UTC'
			};
		};

		$scope.init();
	}]);

	app.controller('WithingsWeightSettingsController', ['$scope', '$http', 'Field', 'moment', function($scope, $http, Field, moment) {

		$scope.init = function() {
			$scope.settings = $scope.$parent.$parent.settings = {
					tag : 'body',
					unit : 'lb',
					marker : new Date(moment().utc().subtract(12, 'months').startOf('month').valueOf()),
					timezone : 'UTC'
			};
		};
		$scope.getUnits = function() {
			return Field.find('weight').units;
		};

		$scope.init();
	}]);

	app.controller('WithingsSleepSettingsController', ['$scope', '$http', 'moment', function($scope, $http, moment) {

		$scope.init = function() {
			$scope.settings = $scope.$parent.$parent.settings = {
					tag : 'sleep',
					marker : new Date(moment().utc().subtract(3, 'months').startOf('month').valueOf()),
					timezone : 'UTC'
			};
		};

		$scope.init();
	}]);

	app.controller('WithingsCardioSettingsController', ['$scope', '$http', 'Field', 'moment', function($scope, $http, Field, moment) {

		$scope.init = function() {
			$scope.settings = $scope.$parent.$parent.settings = {
					tag : 'heart rate',
					marker : new Date(moment().utc().subtract(12, 'months').startOf('month').valueOf()),
					timezone : 'UTC'
			};
		};

		$scope.init();
	}]);

	app.controller('WithingsStepsSettingsController', ['$scope', '$http', 'Field', 'moment', function($scope, $http, Field, moment) {

		$scope.init = function() {
			$scope.settings = $scope.$parent.$parent.settings = {
					tag : 'steps',
					unit : 'mi',
					marker : new Date(moment().utc().subtract(12, 'months').startOf('month').valueOf()),
					timezone : 'UTC'
			};
		};
		$scope.getUnits = function() {
			return Field.find('distance').units;
		};

		$scope.init();
	}]);

	app.controller('WithingsTemperatureSettingsController', ['$scope', '$http', 'Field', 'moment', function($scope, $http, Field, moment) {

		$scope.init = function() {
			$scope.settings = $scope.$parent.$parent.settings = {
				tag : 'body',
				unit : 'C',
				marker : new Date(moment().utc().subtract(12, 'months').startOf('month').valueOf()),
				timezone : 'UTC'
			};
		};
		$scope.getUnits = function() {
			return Field.find('temperature').units;
		};

		$scope.init();
	}]);

	app.controller('SleepCloudSettingsController', ['$scope', function($scope) {

		$scope.init = function() {
			$scope.settings = $scope.$parent.$parent.settings = {
					tag : 'sleep'
			};
		};

		$scope.init();
	}]);

	app.controller('IHealthActivitiesSettingsController', ['$scope', '$http', 'moment', function($scope, $http, moment) {

		$scope.init = function() {
			$scope.settings = $scope.$parent.$parent.settings = {
					tag : 'Activity',
					marker : new Date(moment().utc().subtract(12, 'months').startOf('month').valueOf()),
					timezone : 'UTC'
			};
		};

		$scope.init();
	}]);

	app.controller('IHealthCardioSettingsController', ['$scope', '$http', 'moment', function($scope, $http, moment) {

		$scope.init = function() {
			$scope.settings = $scope.$parent.$parent.settings = {
					tag : 'Heart',
					marker : new Date(moment().utc().subtract(12, 'months').startOf('month').valueOf()),
					timezone : 'UTC'
			};
		};

		$scope.init();
	}]);

	app.controller('IHealthFoodSettingsController', ['$scope', '$http', 'moment', function($scope, $http, moment) {

		$scope.init = function() {
			$scope.settings = $scope.$parent.$parent.settings = {
					tag : 'Meal',
					marker : new Date(moment().utc().subtract(12, 'months').startOf('month').valueOf()),
					timezone : 'UTC'
			};
		};

		$scope.init();
	}]);

	app.controller('IHealthGlucoseSettingsController', ['$scope', '$http', 'moment', function($scope, $http, moment) {

		$scope.init = function() {
			$scope.settings = $scope.$parent.$parent.settings = {
					tag : 'Glucose',
					marker : new Date(moment().utc().subtract(12, 'months').startOf('month').valueOf()),
					timezone : 'UTC'
			};
		};

		$scope.init();
	}]);

	app.controller('IHealthSleepSettingsController', ['$scope', '$http', 'moment', function($scope, $http, moment) {

		$scope.init = function() {
			$scope.settings = $scope.$parent.$parent.settings = {
					tag : 'Sleep',
					marker : new Date(moment().utc().subtract(12, 'months').startOf('month').valueOf()),
					timezone : 'UTC'
			};
		};

		$scope.init();
	}]);

	app.controller('IHealthStepsSettingsController', ['$scope', '$http', 'moment', function($scope, $http, moment) {

		$scope.init = function() {
			$scope.settings = $scope.$parent.$parent.settings = {
					tag : 'Steps',
					marker : new Date(moment().utc().subtract(12, 'months').startOf('month').valueOf()),
					timezone : 'UTC'
			};
		};

		$scope.init();
	}]);

	app.controller('IHealthWeightSettingsController', ['$scope', '$http', 'moment', function($scope, $http, moment) {

		$scope.init = function() {
			$scope.settings = $scope.$parent.$parent.settings = {
					tag : 'Body',
					marker : new Date(moment().utc().subtract(12, 'months').startOf('month').valueOf()),
					timezone : 'UTC'
			};
		};

		$scope.init();
	}]);

	app.controller('OuraStepsSettingsController', ['$scope', '$http', 'moment', function($scope, $http, moment) {

		$scope.init = function() {
			$scope.settings = $scope.$parent.$parent.settings = {
				tag : 'Steps',
				marker : new Date(moment().utc().subtract(6, 'months').startOf('month').valueOf()),
				timezone : 'UTC'
			};
		};

		$scope.init();
	}]);

	app.controller('OuraSleepSettingsController', ['$scope', '$http', 'moment', function($scope, $http, moment) {

		$scope.init = function() {
			$scope.settings = $scope.$parent.$parent.settings = {
				tag : 'Sleep',
				marker : new Date(moment().utc().subtract(6, 'months').startOf('month').valueOf())
			};
		};

		$scope.init();
	}]);

	app.controller('OuraReadinessSettingsController', ['$scope', '$http', 'moment', function($scope, $http, moment) {

		$scope.init = function() {
			$scope.settings = $scope.$parent.$parent.settings = {
				tag : 'Readiness',
				marker : new Date(moment().utc().subtract(6, 'months').startOf('month').valueOf()),
				timezone : 'UTC'
			};
		};

		$scope.init();
	}]);

	app.controller('GoodreadsSettingsController', ['$scope', '$http', 'moment', function($scope, $http, moment) {

		$scope.init = function() {
			$scope.settings = $scope.$parent.$parent.settings = {
				tag : 'Book',
				shelf : 'read',
				marker : new Date(moment('2007-01-01').valueOf())
			};
		};

		$scope.init();
	}]);

	app.controller('GoogleFitActivitiesSettingsController', ['$scope', '$http', 'moment', function($scope, $http, moment) {

		$scope.init = function() {
			$scope.settings = $scope.$parent.$parent.settings = {
					derived : false,
					metric : true,
					marker : new Date(moment().utc().subtract(12, 'months').startOf('month').valueOf()),
					timezone : 'UTC'
			};
		};

		$scope.init();
	}]);

	app.controller('GoogleFitCardioSettingsController', ['$scope', '$http', 'moment', function($scope, $http, moment) {

		$scope.init = function() {
			$scope.settings = $scope.$parent.$parent.settings = {
					tag : 'Heart Rate',
					marker : new Date(moment().utc().subtract(12, 'months').startOf('month').valueOf()),
					timezone : 'UTC'
			};
		};

		$scope.init();
	}]);

	app.controller('GoogleFitFoodSettingsController', ['$scope', '$http', 'moment', function($scope, $http, moment) {

		$scope.init = function() {
			$scope.settings = $scope.$parent.$parent.settings = {
					tag : 'Food',
					marker : new Date(moment().utc().subtract(12, 'months').startOf('month').valueOf()),
					timezone : 'UTC'
			};
		};

		$scope.init();
	}]);

	app.controller('GoogleFitWeightSettingsController', ['$scope', '$http', 'moment', function($scope, $http, moment) {

		$scope.init = function() {
			$scope.settings = $scope.$parent.$parent.settings = {
					tag : 'Weight',
					metric : false,
					marker : new Date(moment().utc().subtract(12, 'months').startOf('month').valueOf()),
					timezone : 'UTC'
			};
		};

		$scope.init();
	}]);

	app.controller('TraktSettingsController', ['$scope', 'moment', function($scope, moment) {

		$scope.init = function() {
			$scope.settings = $scope.$parent.$parent.settings = {
					marker : new Date(moment().utc().subtract(12, 'months').startOf('month').valueOf()),
			};
		};

		$scope.init();
	}]);

	app.controller('WakaTimeSettingsController', ['$scope', 'moment', function($scope, moment) {

		$scope.init = function() {
			$scope.settings = $scope.$parent.$parent.settings = {
					tag : 'project',
					marker : new Date(moment().utc().subtract(2, 'weeks').valueOf())
			};
		};

		$scope.init();
	}]);

	app.controller('DemoSettingsController', ['$scope', function($scope) {

		$scope.init = function() {
			$scope.settings = $scope.$parent.$parent.settings = {
					tag : 'demo'
			};
		};

		$scope.init();
	}]);

}());
