<template>
	<div>
		<v-alert type="error" variant="tonal">
			<h4>Unhandled Error</h4>
			<p>An unhandled error has been thrown.</p>
		</v-alert>
	</div>
</template>

<script setup lang="ts">
import { onMounted } from 'vue';

onMounted(() => {
	throw new Error('Oops!');
});
</script>
