import moment from 'moment';
import 'moment-timezone';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const dateParser: any = {
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
