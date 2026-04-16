<script setup lang="ts">
import '../../css/home.css';

import { inject, type Ref } from 'vue';
import { type AuthApi, authKey } from '../composables/useAuth';
import { FIELD_REGISTRY } from '../utils/eventFormatter';

const auth = inject<AuthApi>(authKey)!;
const drawer = inject<Ref<boolean>>('drawer')!;

const excludeFields = new Set(['source', 'author', 'moon', 'percentage']);

const sampleValues: Record<string, unknown> = {
	timestamp: '2015-10-21T12:00:00Z',
	tag: 'Experiment',
	resource: { title: 'Quantified Self', url: 'https://quantifiedself.com/' },
	note: 'Slept well',
	distance: { '@value': 22, unit: 'mi' },
	'distance/volume': { '@value': 32, unit: 'mpg' },
	height: { '@value': 6500, unit: 'ft' },
	weight: { '@value': 85.5, unit: 'kg' },
	percentage: 100,
	volume: { '@value': 500, unit: 'mL' },
	concentration: { '@value': 80, unit: 'mg/dL' },
	pressure: { '@value': 30.05, unit: 'inHg' },
	velocity: { '@value': 88, unit: 'mph' },
	pace: { '@value': 1259, unit: 's/km' },
	duration: 27000000,
	frequency: { '@value': 55, unit: 'bpm' },
	bits: { '@value': 1.5, unit: 'GB' },
	count: 42,
	energy: { '@value': 600, unit: 'kcal' },
	light: { '@value': 500, unit: 'lx' },
	temperature: { '@value': 36.7, unit: 'C' },
	rating: 80,
	currency: 1.0,
	humidity: 40,
	sound: { '@value': 110, unit: 'dB' },
	location: { lat: 47.62, lon: -122.349 },
};

const fieldExamples = FIELD_REGISTRY.filter((f) => !excludeFields.has(f.name)).map((f) => ({
	name: f.name,
	html: f.toHtml(sampleValues[f.name]),
}));

const widgets = [
	{ type: 'map', label: 'Visualize' },
	{ type: 'stats', label: 'Analyze' },
	{ type: 'comparison', label: 'Compare' },
];

const dataTypes = ['Activities', 'Sleep', 'Steps', 'Heart Rate', 'Weight', 'Food', 'Other'];

const integrations: Record<string, string[]> = {
	Fitbit: ['x', 'x', 'x', 'x', 'x', 'x', ''],
	Foursquare: ['', '', '', '', '', '', 'x'],
	Goodreads: ['', '', '', '', '', '', 'x'],
	'Google Fit': ['x', 'x', '', 'x', 'x', 'x', ''],
	Hexoskin: ['x', 'x', '', '', '', '', ''],
	'Last.fm': ['', '', '', '', '', '', 'x'],
	MapMyFitness: ['x', 'x', '', '', 'x', '', ''],
	Netatmo: ['', '', '', '', '', '', 'x'],
	Oura: ['', 'x', 'x', 'x', '', '', ''],
	RescueTime: ['', '', '', '', '', '', 'x'],
	SleepCloud: ['', 'x', '', '', '', '', ''],
	Strava: ['x', '', '', '', '', '', ''],
	'Trakt.tv': ['', '', '', '', '', '', 'x'],
	WakaTime: ['', '', '', '', '', '', 'x'],
	Withings: ['', 'x', 'x', 'x', 'x', '', ''],
};
</script>

<template>
	<div id="home-view">
		<!-- Hero -->
		<v-sheet class="hero-unit text-center">
			<div class="hero-overlay">
				<div class="hero-content">
					<img src="/img/logo_560x144.png" alt="Zenobase" width="280" height="72" class="hero-logo" />
					<h1 class="hero-title">Got data? Get answers.</h1>
					<p class="hero-subtitle">Collect and analyze your data.</p>
					<div class="hero-cta">
						<template v-if="auth.user.value">
							<v-btn size="large" variant="outlined" class="hero-btn" @click="drawer = true">
								My Data
								<v-icon end icon="mdi-arrow-right" />
							</v-btn>
						</template>
						<template v-else>
							<v-btn size="large" variant="outlined" class="hero-btn" @click="auth.signUp()">
								Get Started
								<v-icon end icon="mdi-arrow-right" />
							</v-btn>
							<div class="mt-3 text-body-2">
								or <a @click="auth.signIn()">sign in</a>
							</div>
						</template>
					</div>
				</div>
			</div>
		</v-sheet>

		<!-- Data Model -->
		<div class="landing-section">
			<div class="section-header">
				<h2>Flexible time series data model</h2>
				<p class="section-desc">Combine any number of unit-aware fields.</p>
			</div>
			<div class="field-cloud">
				<span v-for="field in fieldExamples" :key="field.name" :title="field.name" class="field-cloud-item" v-html="field.html" />
			</div>
		</div>

		<!-- Widgets -->
		<div class="landing-section landing-section--tinted">
			<div class="section-header">
				<h2>Customizable dashboard</h2>
				<p class="section-desc">Analyze your data in a customizable dashboard.</p>
			</div>
			<v-carousel hide-delimiters height="auto" show-arrows="hover" class="widget-carousel">
				<v-carousel-item v-for="widget in widgets" :key="widget.type">
					<div class="widget-slide">
						<img :src="`/img/home/${widget.type}.png`" :alt="widget.label" class="widget-thumbnail" />
						<div class="widget-label">{{ widget.label }}</div>
					</div>
				</v-carousel-item>
			</v-carousel>
		</div>

		<!-- Integrations -->
		<div class="landing-section">
			<div class="section-header">
				<h2>Connect your data sources</h2>
				<p class="section-desc">Pull data from supported services, or import your own data.</p>
			</div>
			<div class="integration-matrix">
				<v-table density="compact">
					<thead>
						<tr>
							<th></th>
							<th v-for="dt in dataTypes" :key="dt" class="text-center integration-header">
								<span>{{ dt }}</span>
							</th>
						</tr>
					</thead>
					<tbody>
						<tr v-for="(types, name) in integrations" :key="name">
							<td class="font-weight-medium text-no-wrap">{{ name }}</td>
							<td v-for="(value, i) in types" :key="i" class="text-center">
								<v-icon v-if="value === 'x'" icon="mdi-check" size="small" color="primary" />
							</td>
						</tr>
					</tbody>
				</v-table>
			</div>
		</div>
	</div>
</template>
