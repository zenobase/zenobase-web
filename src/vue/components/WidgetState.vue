<script setup lang="ts">
defineProps<{
	state: 'loading' | 'failed' | 'empty';
}>();

const config = {
	loading: { icon: 'mdi-dots-horizontal', text: 'Loading' },
	failed: { icon: 'mdi-alert-circle-outline', text: 'Failed to load' },
	empty: { icon: 'mdi-tray-remove', text: 'No data' },
};
</script>

<template>
	<div class="widget-state" :class="'widget-state--' + state">
		<v-icon :icon="config[state].icon" size="20" />
		<span>{{ config[state].text }}</span>
	</div>
</template>

<style scoped>
.widget-state {
	display: flex;
	align-items: center;
	justify-content: center;
	gap: 6px;
	padding: 24px 16px;
	color: rgba(0, 0, 0, 0.38);
	font-size: 0.8125rem;
}

.widget-state--loading .v-icon {
	animation: pulse 1.5s ease-in-out infinite;
}

.widget-state--failed {
	color: rgba(211, 47, 47, 0.6);
}

@keyframes pulse {
	0%, 100% { opacity: 0.3; }
	50% { opacity: 1; }
}
</style>
