<script setup lang="ts">
import { inject } from 'vue';
import { useRouter } from 'vue-router';
import api from '../api';
import { type AlertApi, alertKey } from '../composables/useAlert';
import { type AuthApi, authKey } from '../composables/useAuth';

const router = useRouter();
const auth = inject<AuthApi>(authKey)!;
const alertApi = inject<AlertApi>(alertKey)!;

async function start() {
	alertApi.clear();
	try {
		const response = await api.postForm<{ access_token: string }>('/oauth/token', 'grant_type=client_credentials');
		api.setToken(response.data.access_token);
		await auth.whoami();
		const name = auth.user.value?.name || 'guest';
		router.push({ path: `/users/${name}`, query: { openCreateBucket: '1' } });
	} catch (e: unknown) {
		const status = (e as { status?: number }).status;
		if (status && status < 500) {
			alertApi.show("Can't create a guest account.", 'error');
		} else {
			alertApi.show("Couldn't create a guest account. Try again later or contact support.", 'error');
		}
	}
}

const examples = [
	{
		image: '/img/home/histogram_200x200.png',
		question: "What's the ideal room temperature for sleeping?",
		description: 'Combine data from an indoor weather station (Netatmo) with sleep data (Fitbit, Withings or SleepCloud).',
		align: 'left',
	},
	{
		image: '/img/home/scatterplot_200x200.png',
		question: 'Does the phase of the moon affect my sleep?',
		description: '<a href="https://blog.zenobase.com/post/81497604762">Correlate</a> sleep data (Fitbit, Withings or SleepCloud) with environmental data.',
		link: 'https://youtu.be/b2q8CLRAPrM',
		linkText: 'Watch screencast',
		align: 'right',
	},
	{
		image: '/img/home/polar_200x200.png',
		question: 'What days of the week do I spend more time working at home than at work?',
		description: 'Combine time-tracking (RescueTime) and location data (Foursquare).',
		align: 'left',
	},
	{
		image: '/img/home/map_200x200.png',
		question: 'Where do I go hiking this time of the year?',
		description: 'Explore activities from services like MapMyFitness, RunKeeper, Strava, or add your own data.',
		link: '/#/buckets/u07qih0a27/',
		linkText: 'Live dashboard',
		align: 'right',
	},
	{
		image: '/img/home/timeline_200x100.png',
		imageWidth: 200,
		imageHeight: 100,
		question: 'What affects my resting heart rate more, swimming or working out?',
		description: 'A/B test your resting heart rate (Withings) using location data (Foursquare).',
		link: 'https://youtu.be/X_X-9oyBLE8',
		linkText: 'Watch screencast',
		align: 'left',
	},
];
</script>

<template>
	<div id="home-view" class="container-fluid">
		<div class="hero-unit">
			<h1>Got data? Get answers.</h1>
			<p class="lead">Store, aggregate and visualize your data.</p>
			<p v-if="!auth.user.value">
				<a class="btn btn-large btn-primary" @click="start()">Get Started &raquo;</a>
			</p>
			<p v-else>
				<router-link class="btn btn-large btn-primary" :to="`/users/${auth.user.value.name || 'guest'}`">My Data &raquo;</router-link>
			</p>
			<p class="social">
				<a href="https://www.linkedin.com/company/2676455" title="LinkedIn"><i class="fa fa-white fa-linkedin-square" /></a>
				{{ ' ' }}
				<a href="https://blog.zenobase.com/" title="Blog"><i class="fa fa-white fa-tumblr-square" /></a>
				{{ ' ' }}
				<a href="https://github.com/zenobase" title="GitHub"><i class="fa fa-white fa-github-square" /></a>
			</p>
		</div>

		<div id="home-examples">
			<ul class="media-list">
				<template v-for="(example, i) in examples" :key="i">
					<li class="media" />
					<li class="media">
						<a v-if="example.link" :class="example.align === 'right' ? 'pull-right' : 'pull-left'" :href="example.link" :title="example.linkText">
							<img class="media-object" :width="example.imageWidth || 200" :height="example.imageHeight || 200" :src="example.image" alt="" />
						</a>
						<a v-else :class="example.align === 'right' ? 'pull-right' : 'pull-left'" style="cursor: default;">
							<img class="media-object" :width="example.imageWidth || 200" :height="example.imageHeight || 200" :src="example.image" alt="" />
						</a>
						<div class="media-body lead">
							<p><strong>{{ example.question }}</strong></p>
							<p v-html="example.description" />
							<p v-if="example.link"><a :href="example.link">{{ example.linkText }} &raquo;</a></p>
						</div>
					</li>
				</template>
			</ul>
		</div>
	</div>
</template>
