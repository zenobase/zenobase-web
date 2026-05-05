<script setup lang="ts">
import { inject } from 'vue';
import { type DashboardApi, dashboardKey } from '../composables/useDashboard';
import { BRAND_ORANGE } from '../plugins/vuetify';
import { getFieldIcon } from '../utils/eventFormatter';
import { getUserName } from '../utils/userNames';

const dashboard = inject<DashboardApi>(dashboardKey)!;
</script>

<template>
	<div class="dashboard-summary d-flex flex-column flex-md-row align-md-center flex-md-wrap ga-1 mb-2" v-if="dashboard.total.value >= 0">
		<template v-if="!dashboard.constraints.value.length && !dashboard.constraintsB.value.length">
			<div class="dashboard-summary__group d-flex align-center flex-wrap ga-1">
				<span class="series-swatch series-swatch--a" aria-hidden="true" />
				<span class="series-count series-count--a font-weight-bold" :aria-label="`${dashboard.total.value.toLocaleString()} ${dashboard.total.value === 1 ? 'event' : 'events'}`">{{ dashboard.total.value.toLocaleString() }}&nbsp;<span class="font-weight-regular">{{ dashboard.total.value === 1 ? 'event' : 'events' }}</span></span>
			</div>
		</template>
		<template v-else>
			<div class="dashboard-summary__group d-flex align-center flex-wrap ga-1">
				<span class="series-swatch series-swatch--a" aria-hidden="true" />
				<span class="series-count series-count--a font-weight-bold" :aria-label="`Events (A): ${dashboard.total.value.toLocaleString()}`" title="Events (A)">{{ dashboard.total.value.toLocaleString() }}&nbsp;<span class="font-weight-regular">{{ dashboard.total.value === 1 ? 'event' : 'events' }}</span></span>
				<span v-if="dashboard.constraints.value.length" class="series-count series-count--a font-weight-regular">with</span>
				<v-chip v-for="constraint in dashboard.constraints.value" :key="constraint.toString()" color="primary" variant="text" size="default" class="font-weight-bold" :title="constraint.toString()">
					<v-icon v-if="constraint.negated" icon="mdi-minus" start />
					<v-icon :icon="getFieldIcon(constraint.field)" start @click="dashboard.invertConstraint(constraint)" />
					{{ constraint.field === 'author' ? getUserName(constraint.shortValue()) : constraint.shortValue() }}
					<v-icon icon="mdi-close" end size="x-small" @click="dashboard.removeConstraint(constraint)" />
				</v-chip>
				<v-btn icon size="small" variant="text" title="Compare A/B" @click="dashboard.swapAB()">
					<v-icon icon="mdi-swap-horizontal" />
				</v-btn>
			</div>
			<div v-if="(dashboard.totalB.value !== null && dashboard.totalB.value >= 0) || dashboard.constraintsB.value.length" class="dashboard-summary__group d-flex align-center flex-wrap ga-1">
				<template v-if="dashboard.totalB.value !== null && dashboard.totalB.value >= 0">
					<span class="series-swatch series-swatch--b" aria-hidden="true" />
					<span class="series-count series-count--b font-weight-bold" :aria-label="`Events (B): ${dashboard.totalB.value.toLocaleString()}`" title="Events (B)">{{ dashboard.totalB.value.toLocaleString() }}&nbsp;<span class="font-weight-regular">{{ dashboard.totalB.value === 1 ? 'event' : 'events' }}</span></span>
				</template>
				<span v-if="dashboard.constraintsB.value.length" class="series-count series-count--b font-weight-regular">with</span>
				<v-chip v-for="constraint in dashboard.constraintsB.value" :key="'b-' + constraint.toString()" :color="BRAND_ORANGE" variant="text" size="default" class="font-weight-bold" :title="constraint.toString()">
					<v-icon v-if="constraint.negated" icon="mdi-minus" start />
					<v-icon :icon="getFieldIcon(constraint.field)" start @click="dashboard.invertConstraintB(constraint)" />
					{{ constraint.field === 'author' ? getUserName(constraint.shortValue()) : constraint.shortValue() }}
					<v-icon icon="mdi-close" end size="x-small" @click="dashboard.removeConstraintB(constraint)" />
				</v-chip>
			</div>
		</template>
	</div>
</template>
