const FIELD_SEPARATOR = ':';
const SUBFIELD_SEPARATOR = '$';

export class Constraint {
	field: string;
	value: string;
	negated: boolean;
	subfield: string | null;

	constructor(field: string, value: string, negated = false, subfield: string | null = null) {
		this.field = field;
		this.value = String(value);
		this.negated = negated;
		this.subfield = subfield;
	}

	invert(): Constraint {
		return new Constraint(this.field, this.value, !this.negated, this.subfield);
	}

	toString(): string {
		const field = this.field + (this.subfield ? SUBFIELD_SEPARATOR + this.subfield : '');
		return (this.negated ? '-' : '') + field + FIELD_SEPARATOR + this.value;
	}

	shortValue(): string {
		const p = this.value.indexOf(' OR ');
		return p === -1 ? this.value : `${this.value.substring(0, p)}...`;
	}

	static parse(s: string): Constraint {
		let negated = false;
		let input = s;
		if (input.length > 1 && input.charAt(0) === '-') {
			negated = true;
			input = input.substring(1);
		}
		const pos = input.indexOf(FIELD_SEPARATOR);
		if (pos < 1 || pos > input.length - 1) {
			throw new Error(`Can't parse constraint: ${s}`);
		}
		let field = input.substring(0, pos);
		let subfield: string | null = null;
		const pos2 = field.indexOf(SUBFIELD_SEPARATOR);
		if (pos2 > 0) {
			subfield = field.substring(pos2 + 1);
			field = field.substring(0, pos2);
		}
		const value = input.substring(pos + 1);
		return new Constraint(field, value, negated, subfield);
	}
}
