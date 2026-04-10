<template>
	<v-empty-state
		icon="mdi-magnify"
		headline="Nothing here"
		action-text="Go home"
		@click:action="router.push('/')"
	/>
</template>

<script setup lang="ts">
import { useRouter } from "vue-router";

const router = useRouter();
</script>
