<script setup lang="ts">
import { inject, onMounted, ref } from 'vue';
import type { UnitValue } from '../../types';
import type { SearchResult, TimeEntry } from '../../types/search';
import { type DashboardApi, dashboardKey, type WidgetRegistration } from '../composables/useDashboard';

const PITCHES: Record<string, number> = {
	C4: 261.6,
	'C#4': 277.2,
	D4: 293.7,
	Eb4: 311.1,
	E4: 329.6,
	F4: 349.2,
	'F#4': 370.0,
	G4: 392.0,
	'G#4': 415.3,
	A4: 440.0,
	Bb4: 466.2,
	B4: 493.9,
	C5: 523.3,
};

const SCALES: Record<string, number[]> = {
	chromatic: [
		PITCHES['C4'],
		PITCHES['C#4'],
		PITCHES['D4'],
		PITCHES['Eb4'],
		PITCHES['E4'],
		PITCHES['F4'],
		PITCHES['F#4'],
		PITCHES['G4'],
		PITCHES['G#4'],
		PITCHES['A4'],
		PITCHES['Bb4'],
		PITCHES['B4'],
		PITCHES['C5'],
	],
	octatonic: [PITCHES['C4'], PITCHES['C#4'], PITCHES['Eb4'], PITCHES['E4'], PITCHES['F#4'], PITCHES['G4'], PITCHES['A4'], PITCHES['Bb4'], PITCHES['C5']],
	pentatonic: [PITCHES['C4'], PITCHES['D4'], PITCHES['E4'], PITCHES['G4'], PITCHES['A4'], PITCHES['C5']],
};

const props = defineProps<{
	settings: {
		id: string;
		scale: string;
		tempo: number;
	};
}>();

const dashboard = inject<DashboardApi>(dashboardKey)!;
const tracks = ref<number[][]>([]);
const playing = ref(0);
let audioCtx: AudioContext | null = null;

function normalize(values: number[]): number[] {
	const nonZero = values.filter((v) => v !== 0);
	const min = nonZero.length ? Math.min(...nonZero) : 0;
	const shifted = values.map((v) => Math.max(v - min, 0));
	const max = Math.max(...shifted) || 1;
	return shifted.map((v) => v / max);
}

function playTrack(notes: number[], scale: number[], tempo: number, volume: number) {
	if (!audioCtx) return;
	for (let i = 0; i < notes.length; ++i) {
		const freq = notes[i] > 0 ? scale[Math.ceil(notes[i] * scale.length) - 1] : 0;
		const d = 60 / tempo;
		const t = audioCtx.currentTime + i * d;
		const gain = audioCtx.createGain();
		gain.connect(audioCtx.destination);
		gain.gain.setValueAtTime(0.0, t);
		gain.gain.linearRampToValueAtTime(volume, t + d / 5);
		gain.gain.linearRampToValueAtTime(0.0, t + d);
		const osc = audioCtx.createOscillator();
		osc.frequency.value = freq;
		osc.connect(gain);
		osc.start(t);
		osc.stop(t + d + d / 5);
		osc.onended = () => {
			if (--playing.value === 0) {
				audioCtx?.suspend();
			}
		};
		++playing.value;
	}
}

function play() {
	if (!audioCtx) return;
	audioCtx.resume();
	if (playing.value === 0) {
		const scale = SCALES[props.settings.scale] || SCALES['pentatonic'];
		for (const track of tracks.value) {
			playTrack(track, scale, props.settings.tempo, 1.0 / tracks.value.length);
		}
	}
}

function stop() {
	if (audioCtx) {
		audioCtx.suspend();
		audioCtx.close();
	}
	audioCtx = new AudioContext();
	audioCtx.suspend();
	playing.value = 0;
}

function isRunning(): boolean {
	return audioCtx?.state === 'running';
}

function params() {
	return null; // sonification uses other widgets' data
}

function update(result: SearchResult) {
	for (const [_id, data] of Object.entries(result)) {
		if (Array.isArray(data) && data.length && data[0].time) {
			let useCounts = true;
			const values = data.map((item: TimeEntry) => {
				if (Object.hasOwn(item, 'avg')) {
					if (typeof item.avg === 'object' && item.avg !== null) {
						return (item.avg as UnitValue)['@value'];
					}
					useCounts = false;
					return item.avg as number;
				}
				return useCounts ? (item.count as number) : 0;
			});
			tracks.value.push(normalize(values));
		}
	}
}

function init() {
	stop();
	tracks.value = [];
}

const registration: WidgetRegistration = { params, update, init };
onMounted(() => {
	stop(); // initialize audio context
	dashboard.register(registration);
});
</script>

<template>
	<div>
		<button class="btn" title="Play" :disabled="!tracks.length || isRunning()" @click="play()"><i class="fa fa-play" /></button>
		<button class="btn" title="Stop" :disabled="!isRunning()" @click="stop()"><i class="fa fa-stop" /></button>
	</div>
</template>
