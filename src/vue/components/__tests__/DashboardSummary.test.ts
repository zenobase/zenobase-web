import { mount, type VueWrapper } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import type { ComponentPublicInstance } from 'vue';
import { createVuetify } from 'vuetify';
import { Constraint } from '../../../utils/constraint';
import { type DashboardApi, dashboardKey } from '../../composables/useDashboard';
import { createMockDashboard } from '../../widgets/__tests__/helpers';
import DashboardSummary from '../DashboardSummary.vue';

const vuetify = createVuetify();

function mountSummary(setup: (d: DashboardApi) => void): {
	wrapper: VueWrapper<ComponentPublicInstance>;
	dashboard: DashboardApi;
} {
	const dashboard = createMockDashboard();
	setup(dashboard);
	const wrapper = mount(DashboardSummary, {
		global: {
			plugins: [vuetify],
			provide: { [dashboardKey as symbol]: dashboard },
		},
	});
	return { wrapper, dashboard };
}

function text(wrapper: VueWrapper<ComponentPublicInstance>): string {
	// `&nbsp;` between count and unit renders as U+00A0 — normalize for assertions.
	return wrapper.text().replace(/ /g, ' ');
}

describe('DashboardSummary', () => {
	describe('state 1 — no constraints', () => {
		it('hides the strip when total is unknown (-1)', () => {
			const { wrapper } = mountSummary((d) => {
				d.total.value = -1;
			});
			expect(wrapper.find('.series-swatch').exists()).toBe(false);
		});

		it('renders "0 events" with A swatch and no chips', () => {
			const { wrapper } = mountSummary((d) => {
				d.total.value = 0;
			});
			expect(wrapper.find('.series-swatch--a').exists()).toBe(true);
			expect(wrapper.find('.series-swatch--b').exists()).toBe(false);
			expect(text(wrapper)).toContain('0 events');
			expect(wrapper.findAll('.v-chip')).toHaveLength(0);
		});

		it('renders "1 event" (singular)', () => {
			const { wrapper } = mountSummary((d) => {
				d.total.value = 1;
			});
			expect(text(wrapper)).toContain('1 event');
			expect(text(wrapper)).not.toContain('1 events');
		});

		it('formats large counts with locale separators', () => {
			const { wrapper } = mountSummary((d) => {
				d.total.value = 1234567;
			});
			expect(text(wrapper)).toContain('1,234,567 events');
		});

		it('does not render the swap button', () => {
			const { wrapper } = mountSummary((d) => {
				d.total.value = 42;
			});
			expect(wrapper.find('button[title="Compare A/B"]').exists()).toBe(false);
		});
	});

	describe('state 2 — A constraints only', () => {
		it('renders A count, A swatch, A constraint chips, swap button, no B group', () => {
			const { wrapper } = mountSummary((d) => {
				d.total.value = 5;
				d.constraints.value = [new Constraint('tag', 'sleep'), new Constraint('tag', 'wake')];
			});
			expect(wrapper.find('.series-swatch--a').exists()).toBe(true);
			expect(wrapper.find('.series-swatch--b').exists()).toBe(false);
			expect(text(wrapper)).toContain('5 events');
			expect(wrapper.findAll('.v-chip')).toHaveLength(2);
			expect(wrapper.find('button[title="Compare A/B"]').exists()).toBe(true);
		});

		it('renders the minus icon for negated constraints', () => {
			const { wrapper } = mountSummary((d) => {
				d.total.value = 3;
				d.constraints.value = [new Constraint('tag', 'sleep', true)];
			});
			expect(wrapper.find('.v-chip .mdi-minus').exists()).toBe(true);
		});

		it('removes a constraint when ✕ is clicked', async () => {
			const constraint = new Constraint('tag', 'sleep');
			const { wrapper, dashboard } = mountSummary((d) => {
				d.total.value = 5;
				d.constraints.value = [constraint];
			});
			await wrapper.find('.v-chip .mdi-close').trigger('click');
			expect(dashboard.removeConstraint).toHaveBeenCalledTimes(1);
			expect(dashboard.removeConstraint).toHaveBeenCalledWith(constraint);
		});

		it('inverts a constraint when the field icon is clicked', async () => {
			const constraint = new Constraint('tag', 'sleep');
			const { wrapper, dashboard } = mountSummary((d) => {
				d.total.value = 5;
				d.constraints.value = [constraint];
			});
			// First icon inside the chip is the field icon (no negation prefix when not negated).
			await wrapper.find('.v-chip .v-icon').trigger('click');
			expect(dashboard.invertConstraint).toHaveBeenCalledTimes(1);
			expect(dashboard.invertConstraint).toHaveBeenCalledWith(constraint);
		});

		it('uses A title attribute on the count', () => {
			const { wrapper } = mountSummary((d) => {
				d.total.value = 5;
				d.constraints.value = [new Constraint('tag', 'sleep')];
			});
			expect(wrapper.find('[title="Events (A)"]').exists()).toBe(true);
		});

		it('inserts a "with" connector when constraints are present', () => {
			const { wrapper } = mountSummary((d) => {
				d.total.value = 5;
				d.constraints.value = [new Constraint('tag', 'sleep')];
			});
			const withSpans = wrapper.findAll('span').filter((s) => s.text() === 'with');
			expect(withSpans).toHaveLength(1);
		});
	});

	describe('state 3 — A + B', () => {
		it('renders both swatches, both counts, both chip groups, swap between', () => {
			const { wrapper } = mountSummary((d) => {
				d.total.value = 100;
				d.totalB.value = 50;
				d.constraints.value = [new Constraint('tag', 'a')];
				d.constraintsB.value = [new Constraint('tag', 'b')];
			});
			expect(wrapper.find('.series-swatch--a').exists()).toBe(true);
			expect(wrapper.find('.series-swatch--b').exists()).toBe(true);
			expect(text(wrapper)).toContain('100 events');
			expect(text(wrapper)).toContain('50 events');
			expect(wrapper.findAll('.v-chip')).toHaveLength(2);
			expect(wrapper.find('button[title="Compare A/B"]').exists()).toBe(true);
		});

		it('A unfiltered + B filtered: A still shows "events" label and is the baseline', () => {
			const { wrapper } = mountSummary((d) => {
				d.total.value = 1252;
				d.totalB.value = 405;
				d.constraints.value = [];
				d.constraintsB.value = [new Constraint('author', 'carol')];
			});
			expect(text(wrapper)).toContain('1,252 events');
			expect(text(wrapper)).toContain('405 events');
			expect(wrapper.find('.series-swatch--a').exists()).toBe(true);
			expect(wrapper.find('.series-swatch--b').exists()).toBe(true);
			// "with" appears once — only on the side that has constraints (B)
			const withSpans = wrapper.findAll('span').filter((s) => s.text() === 'with');
			expect(withSpans).toHaveLength(1);
		});

		it('A filtered + B unfiltered (constraintsB empty but totalB defined): renders B baseline', () => {
			const { wrapper } = mountSummary((d) => {
				d.total.value = 847;
				d.totalB.value = 1252;
				d.constraints.value = [new Constraint('author', 'alice')];
				d.constraintsB.value = [];
			});
			expect(text(wrapper)).toContain('847 events');
			expect(text(wrapper)).toContain('1,252 events');
			expect(wrapper.find('.series-swatch--b').exists()).toBe(true);
		});

		it('hides B group entirely when totalB is null', () => {
			const { wrapper } = mountSummary((d) => {
				d.total.value = 100;
				d.totalB.value = null;
				d.constraints.value = [new Constraint('tag', 'a')];
				d.constraintsB.value = [];
			});
			expect(wrapper.find('.series-swatch--b').exists()).toBe(false);
			expect(wrapper.find('[title="Events (B)"]').exists()).toBe(false);
		});

		it('pluralizes A and B independently', () => {
			const { wrapper } = mountSummary((d) => {
				d.total.value = 1;
				d.totalB.value = 2;
				d.constraints.value = [new Constraint('tag', 'a')];
				d.constraintsB.value = [new Constraint('tag', 'b')];
			});
			const t = text(wrapper);
			expect(t).toContain('1 event');
			expect(t).not.toMatch(/\b1 events\b/);
			expect(t).toContain('2 events');
		});

		it('swap button calls swapAB', async () => {
			const { wrapper, dashboard } = mountSummary((d) => {
				d.total.value = 100;
				d.totalB.value = 50;
				d.constraints.value = [new Constraint('tag', 'a')];
				d.constraintsB.value = [new Constraint('tag', 'b')];
			});
			await wrapper.find('button[title="Compare A/B"]').trigger('click');
			expect(dashboard.swapAB).toHaveBeenCalledTimes(1);
		});
	});
});
