<script setup lang="ts">
import '../../css/api.css';

import hljs from 'highlight.js/lib/core';
import bash from 'highlight.js/lib/languages/bash';
import json from 'highlight.js/lib/languages/json';
import { nextTick, onMounted, ref, watch } from 'vue';
import { useRoute } from 'vue-router';

hljs.registerLanguage('bash', bash);
hljs.registerLanguage('json', json);

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
	highlightCodeBlocks();
	scrollToSection();
}

function highlightCodeBlocks() {
	// Existing markup uses class="lang-bash" / "lang-json"; hljs expects "language-*".
	for (const el of document.querySelectorAll<HTMLElement>('#api [data-ui-highlight]')) {
		// Skip schema/template blocks that contain <em> placeholders — highlighting
		// them would strip the italics. Concrete request/response blocks have no child elements.
		if (el.children.length > 0) continue;
		const langClass = Array.from(el.classList).find((c) => c.startsWith('lang-'));
		if (!langClass) continue;
		const language = langClass.slice('lang-'.length);
		if (!hljs.getLanguage(language)) continue;
		el.classList.remove(langClass);
		el.classList.add(`language-${language}`);
		hljs.highlightElement(el);
	}
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
