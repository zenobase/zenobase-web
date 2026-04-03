export interface IntervalDef {
	name: string;
	pattern: number;
	minTickInterval: number;
	symbol: string;
	zoomIn?: IntervalDef;
}

function createInterval(name: string, pattern: string, minTickInterval: number, symbol: string): IntervalDef {
	return { name, pattern: pattern.length, minTickInterval, symbol };
}

const VALUES: IntervalDef[] = [
	createInterval('year', 'yyyy', 366 * 24 * 60 * 60 * 1000, 'y'),
	createInterval('month', 'yyyy-MM', 28 * 24 * 60 * 60 * 1000, 'M'),
	createInterval('week', 'yyyy-Www', 7 * 24 * 60 * 60 * 1000, 'w'),
	createInterval('day', 'yyyy-MM-dd', 24 * 60 * 60 * 1000, 'd'),
	createInterval('hour', 'yyyy-MM-ddTHH', 60 * 60 * 1000, 'h'),
	createInterval('minute', 'yyyy-MM-ddTHH:mm', 60 * 1000, 'm'),
	createInterval('second', 'yyyy-MM-ddTHH:mm:ss', 1000, 's'),
];

VALUES[0].zoomIn = VALUES[1]; // year -> month
VALUES[1].zoomIn = VALUES[3]; // month -> day
VALUES[2].zoomIn = VALUES[3]; // week -> day
VALUES[3].zoomIn = VALUES[4]; // day -> hour
VALUES[4].zoomIn = VALUES[5]; // hour -> minute
VALUES[5].zoomIn = VALUES[6]; // minute -> second

function match(value: string): IntervalDef | undefined {
	if (value.match(/^[0-9]{4}/)) {
		if (!value.match(/Z|[+-]\d\d:\d\d/)) {
			for (let i = 1; i < VALUES.length; ++i) {
				if (value.length === VALUES[i].pattern) {
					return VALUES[i].zoomIn;
				}
			}
		}
	}
}

function getFirst(rangeExpression: string): string | undefined {
	if (rangeExpression.length >= 12 && rangeExpression.indexOf('..') !== -1) {
		const tokens = rangeExpression.substring(1, rangeExpression.length - 1).split('..');
		if (tokens[0] === '*') return tokens[1];
		if (tokens[1] === '*') return tokens[0];
		return tokens[0];
	}
}

function matchRange(value: string): IntervalDef | undefined {
	const first = getFirst(value);
	if (first?.match(/^[0-9]{4}/)) {
		if (!first.match(/Z|[+-]\d\d:\d\d/)) {
			for (let i = 0; i < VALUES.length; ++i) {
				if (first.length === VALUES[i].pattern) {
					return VALUES[i];
				}
			}
		}
	}
}

function matchSymbol(value: string): IntervalDef | undefined {
	if (value) {
		for (let i = 0; i < VALUES.length; ++i) {
			if (value.indexOf(VALUES[i].symbol) !== -1) {
				return VALUES[i];
			}
		}
	}
}

function findByName(name: string): IntervalDef | undefined {
	if (name) {
		for (let i = 0; i < VALUES.length; ++i) {
			if (VALUES[i].name === name) {
				return VALUES[i];
			}
		}
	}
}

export const Interval = { VALUES, match, matchRange, matchSymbol, findByName };
