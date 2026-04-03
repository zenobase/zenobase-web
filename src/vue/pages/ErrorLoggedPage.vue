<template>
	<div>
		<v-alert type="error" variant="tonal">
			<h4>Logged Error</h4>
			<p>An error has been logged to the console.</p>
		</v-alert>
	</div>
</template>

<script setup lang="ts">
import { onMounted } from 'vue';

onMounted(() => {
	console.error('Oops!');
});
</script>
