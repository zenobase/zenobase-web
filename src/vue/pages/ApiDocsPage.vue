<script setup lang="ts">
import { nextTick, onMounted, ref, watch } from 'vue';
import { useRoute } from 'vue-router';

const route = useRoute();
const html = ref('');

async function loadContent() {
	try {
		const response = await fetch('/partials/api.html');
		html.value = await response.text();
	} catch {
		html.value = '<p>Failed to load API documentation.</p>';
	}
	await nextTick();
	scrollToSection();
}

function scrollToSection() {
	const section = route.params.section as string | undefined;
	if (section) {
		const id = `api-${section}`;
		nextTick(() => {
			const element = document.getElementById(id);
			if (element) {
				element.scrollIntoView(true);
			}
		});
	}
}

onMounted(loadContent);
watch(() => route.params.section, scrollToSection);
</script>

<template>
	<!-- eslint-disable-next-line vue/no-v-html -->
	<div v-html="html"></div>
</template>
