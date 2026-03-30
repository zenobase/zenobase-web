import moment from 'moment';
import 'moment-timezone';

export const dateParser = {
	parse(value: string, format?: string) {
		return format ? moment(value, format) : moment(value);
	},
	parseTz(value: string, formatOrTimezone: string, timezone?: string) {
		if (timezone) {
			return moment.tz(value, formatOrTimezone, timezone);
		}
		return moment.tz(value, formatOrTimezone);
	},
};
