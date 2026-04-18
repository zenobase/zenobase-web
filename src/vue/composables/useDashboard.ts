import { type InjectionKey, type MaybeRefOrGetter, type Ref, ref, toValue } from 'vue';
import type { BaseWidgetParams, SearchResult } from '../../types/search';
import { Constraint } from '../../utils/constraint';
import { param } from '../../utils/helpers';

export interface DashboardApi {
	constraints: Ref<Constraint[]>;
	constraintsB: Ref<Constraint[]>;
	total: Ref<number>;
	totalB: Ref<number | null>;
	generation: Ref<number>;
	search: (params: BaseWidgetParams[]) => Promise<SearchResult>;
	searchB: (params: BaseWidgetParams[]) => Promise<SearchResult>;
	refresh: () => void;
	addConstraint: (field: string, value: string, replace?: boolean, negated?: boolean) => void;
	addConstraintB: (field: string, value: string, replace?: boolean, negated?: boolean) => void;
	addConstraints: (constraints: Constraint[]) => void;
	swapAB: () => void;
	removeConstraint: (constraint: Constraint) => void;
	removeConstraintB: (constraint: Constraint) => void;
	invertConstraint: (constraint: Constraint) => void;
	invertConstraintB: (constraint: Constraint) => void;
	getConstraints: (field: string) => Constraint[];
	getConstraintsB: (field: string) => Constraint[];
}

export const dashboardKey: InjectionKey<DashboardApi> = Symbol('dashboard');

function escapeCommas(s: unknown): unknown {
	return typeof s === 'string' ? s.replace(/,/g, '\\,') : s;
}

export function useDashboard(
	bucketId: MaybeRefOrGetter<string>,
	httpGet: (url: string) => Promise<{ data: SearchResult }>,
	onLocationChange: (params: Record<string, string[] | null>) => void,
	getLocationParams: () => Record<string, string | string[] | undefined>,
) {
	const constraints = ref<Constraint[]>([]);
	const constraintsB = ref<Constraint[]>([]);
	const total = ref(0);
	const totalB = ref<number | null>(null);
	const generation = ref(0);
	let pendingRefresh = 0;

	function parseConstraints(value: string | string[] | undefined): Constraint[] {
		if (!value) return [];
		const values = Array.isArray(value) ? value : value.split('|');
		return values.map((s) => Constraint.parse(s));
	}

	function updateConstraints() {
		const params = getLocationParams();
		constraints.value = parseConstraints(params['q']);
		constraintsB.value = parseConstraints(params['r']);
	}

	function mapToString(values: Constraint[]): string[] | null {
		return values.length > 0 ? values.map((v) => v.toString()) : null;
	}

	function locationParams(): Record<string, string[] | null> {
		const value: Record<string, string[] | null> = {};
		if (constraints.value.length > 0) {
			value['q'] = mapToString(constraints.value);
		} else {
			value['q'] = null;
		}
		if (constraintsB.value.length > 0) {
			value['r'] = mapToString(constraintsB.value);
		} else {
			value['r'] = null;
		}
		return value;
	}

	function containsConstraint(constraint: Constraint): boolean {
		return constraints.value.some((c) => c.field === constraint.field && c.value === constraint.value && c.negated === constraint.negated && c.subfield === constraint.subfield);
	}

	async function doSearch(q: Constraint[], facets: string[]): Promise<SearchResult> {
		const url = `/buckets/${toValue(bucketId)}/?${param({ q: q.map((c) => c.toString()), facet: facets }, true)}`;
		const response = await httpGet(url);
		return response.data;
	}

	function buildFacets(params: BaseWidgetParams[]): string[] {
		return params
			.filter((p) => p != null)
			.map((p) =>
				Object.entries(p)
					.map(([key, value]) => (value !== undefined && value !== null && value !== '' ? `${key}:${escapeCommas(value)}` : null))
					.filter((v) => v != null)
					.join(','),
			);
	}

	async function search(params: BaseWidgetParams[]): Promise<SearchResult> {
		return doSearch(constraints.value, buildFacets(params));
	}

	async function searchB(params: BaseWidgetParams[]): Promise<SearchResult> {
		return doSearch(constraintsB.value, buildFacets(params));
	}

	function refresh() {
		updateConstraints();
		pendingRefresh++;
		const current = pendingRefresh;
		const countFacet = ['id:_count,type:list,offset:0,limit:0'];
		const requests: Promise<SearchResult>[] = [doSearch(constraints.value, countFacet)];
		if (constraintsB.value.length > 0) {
			requests.push(doSearch(constraintsB.value, countFacet));
		}
		Promise.all(requests).then(
			(responses) => {
				if (current !== pendingRefresh) return;
				if (typeof responses[0]['total'] === 'number') {
					total.value = responses[0]['total'];
				}
				if (responses.length > 1 && typeof responses[1]['total'] === 'number') {
					totalB.value = responses[1]['total'];
				} else {
					totalB.value = null;
				}
				generation.value++;
			},
			() => {
				if (current !== pendingRefresh) return;
				total.value = -1;
				totalB.value = null;
			},
		);
	}

	function reset() {
		pendingRefresh++;
		generation.value = 0;
		constraints.value = [];
		constraintsB.value = [];
		total.value = 0;
		totalB.value = null;
	}

	function addConstraint(field: string, value: string, replace = false, negated = false) {
		let subfield: string | null = null;
		const p = field.indexOf('$');
		if (p > 0) {
			subfield = field.substring(p + 1);
			field = field.substring(0, p);
		}
		const constraint = new Constraint(field, value, negated, subfield);
		if (containsConstraint(constraint)) return;
		if (replace) {
			constraints.value = constraints.value.filter((c) => c.field !== constraint.field);
		}
		constraints.value = [...constraints.value, constraint];
		onLocationChange(locationParams());
	}

	function addConstraintB(field: string, value: string, replace = false, negated = false) {
		let subfield: string | null = null;
		const p = field.indexOf('$');
		if (p > 0) {
			subfield = field.substring(p + 1);
			field = field.substring(0, p);
		}
		const constraint = new Constraint(field, value, negated, subfield);
		if (constraintsB.value.some((c) => c.field === constraint.field && c.value === constraint.value && c.negated === constraint.negated && c.subfield === constraint.subfield)) return;
		if (replace) {
			constraintsB.value = constraintsB.value.filter((c) => c.field !== constraint.field);
		}
		constraintsB.value = [...constraintsB.value, constraint];
		onLocationChange(locationParams());
	}

	function swapAB() {
		const tmp = constraints.value;
		constraints.value = constraintsB.value.length ? constraintsB.value : [...constraints.value];
		constraintsB.value = tmp;
		onLocationChange(locationParams());
	}

	function addConstraints(newConstraints: Constraint[]) {
		constraints.value = [...constraints.value, ...newConstraints];
		onLocationChange(locationParams());
	}

	function removeConstraint(constraint: Constraint) {
		constraints.value = constraints.value.filter((c) => !(c.field === constraint.field && c.value === constraint.value && c.negated === constraint.negated && c.subfield === constraint.subfield));
		onLocationChange(locationParams());
	}

	function removeConstraintB(constraint: Constraint) {
		constraintsB.value = constraintsB.value.filter(
			(c) => !(c.field === constraint.field && c.value === constraint.value && c.negated === constraint.negated && c.subfield === constraint.subfield),
		);
		onLocationChange(locationParams());
	}

	function invertConstraint(constraint: Constraint) {
		constraints.value = constraints.value.map((c) =>
			c.field === constraint.field && c.value === constraint.value && c.negated === constraint.negated && c.subfield === constraint.subfield ? c.invert() : c,
		);
		onLocationChange(locationParams());
	}

	function invertConstraintB(constraint: Constraint) {
		constraintsB.value = constraintsB.value.map((c) =>
			c.field === constraint.field && c.value === constraint.value && c.negated === constraint.negated && c.subfield === constraint.subfield ? c.invert() : c,
		);
		onLocationChange(locationParams());
	}

	function getConstraints(field: string): Constraint[] {
		return constraints.value.filter((c) => c.field === field);
	}

	function getConstraintsB(field: string): Constraint[] {
		return constraintsB.value.filter((c) => c.field === field);
	}

	const api: DashboardApi = {
		constraints,
		constraintsB,
		total,
		totalB,
		generation,
		search,
		searchB,
		refresh,
		addConstraint,
		addConstraintB,
		addConstraints,
		swapAB,
		removeConstraint,
		removeConstraintB,
		invertConstraint,
		invertConstraintB,
		getConstraints,
		getConstraintsB,
	};

	return { ...api, reset };
}
