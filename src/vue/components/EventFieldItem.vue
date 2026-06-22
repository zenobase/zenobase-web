<script setup lang="ts">
import type { FieldSegment } from '../utils/eventFormatter';

defineProps<{
	segment: FieldSegment;
	/** When true, location values render as a clickable filter link that emits `filter`. */
	locationFilter?: boolean;
}>();

const emit = defineEmits<{ filter: [field: string, value: string] }>();

const SPACE = ' ';
const NBSP = '\u00A0';
</script>

<template>
	<span v-if="segment.kind === 'rating'" class="text-no-wrap" :title="segment.title">
		<i v-for="n in 5" :key="n" class="mdi" :class="n <= (segment.filled ?? 0) ? 'mdi-star' : 'mdi-star-outline'"></i>
	</span>
	<span v-else :class="{ 'text-no-wrap': segment.nowrap }">
		<i v-if="segment.icon" class="mdi" :class="segment.icon" :title="segment.iconTitle"></i><template v-if="segment.icon">{{ segment.tightIcon ? NBSP : SPACE }}</template
		><template v-if="segment.kind === 'text'">{{ segment.text }}</template
		><abbr v-else-if="segment.kind === 'abbr'" :title="segment.title">{{ segment.text }}</abbr
		><a v-else-if="segment.kind === 'link'" :href="segment.href" target="_blank" rel="nofollow noopener">{{ segment.text }}</a
		><template v-else-if="segment.kind === 'location'"><a v-if="locationFilter" class="location-filter" @click="emit('filter', 'location', segment.filter ?? '')">{{ segment.text }}</a><template v-else>{{ segment.text }}</template></template>
	</span>
</template>
