<script setup lang="ts">
import { computed } from 'vue';
import type { ZenoEvent } from '../../types';
import { formatEvent } from '../utils/eventFormatter';
import EventFieldItem from './EventFieldItem.vue';

const props = defineProps<{
	event: ZenoEvent;
	excludeFields?: Set<string>;
	/** Render location values as clickable filter links (emits `filter`). */
	locationFilter?: boolean;
}>();

const emit = defineEmits<{ filter: [field: string, value: string] }>();

const segments = computed(() => formatEvent(props.event, props.excludeFields));

// Matches the legacy " &nbsp; " separator between fields.
const SEP = ' \u00A0 ';
</script>

<template>
	<span class="event-fields"
		><template v-for="(seg, i) in segments" :key="seg.name + '-' + i"
			><template v-if="i">{{ SEP }}</template
			><EventFieldItem :segment="seg" :location-filter="locationFilter" @filter="(f, v) => emit('filter', f, v)"
		/></template
	></span>
</template>
