<script setup lang="ts">
import { onErrorCaptured, ref } from 'vue';

const emit = defineEmits<{ error: [err: unknown] }>();

const hasError = ref(false);

onErrorCaptured((err) => {
	console.error(err);
	hasError.value = true;
	emit('error', err);
	return false;
});
</script>

<template>
	<span v-if="hasError">Oops</span>
	<slot v-else />
</template>
