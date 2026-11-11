<script setup lang="ts">
import { computed } from 'vue'

import { formatClock } from '@/lib/format'

const {
  remaining,
  total = 120,
  running = false,
  caption = 'UNTIL YOUR NIKKI DROPS',
  size = 260,
  display,
  roulette,
} = defineProps<{
  /** Seconds left. */
  remaining: number
  total?: number
  /** Shows the beat pulse around the ring. */
  running?: boolean
  caption?: string
  size?: number
  /** Shown in place of the time left, such as the roulette's flickering digits. */
  display?: string
  /**
   * Turns the ring into the roulette: `idle` circles slowly while it waits for a spin,
   * `spinning` races, and `landed` announces the result it stopped on.
   */
  roulette?: 'idle' | 'spinning' | 'landed'
}>()

const clock = computed(() => display ?? formatClock(remaining))
/** No time to count down at all: the ring is complete from the start. */
const zero = computed(() => total <= 0)
const degrees = computed(() => (zero.value ? 360 : Math.round(((total - remaining) / total) * 360)))
const circling = computed(() => roulette === 'idle' || roulette === 'spinning')
/** Ripples sent out by a landing. Zero gets a third, and sprouts with them. */
const ripples = computed(() => (roulette === 'landed' ? (zero.value ? 3 : 2) : 0))
const SPROUTS = 6
</script>

<template>
  <!-- size is the largest it gets: it shrinks on narrow or short screens. -->
  <div
    :class="['ring', roulette && `ring--${roulette}`, { 'ring--zero': zero }]"
    :style="{ width: `min(${size}px, 70vw, 42dvh)` }"
  >
    <div v-if="running" class="ring__beat" aria-hidden="true"></div>
    <div
      v-for="n in ripples"
      :key="n"
      class="ring__burst"
      :style="{ animationDelay: `${(n - 1) * 0.16}s` }"
      aria-hidden="true"
    ></div>
    <div
      class="ring__fill"
      :style="
        circling
          ? undefined
          : { background: `conic-gradient(var(--orange) ${degrees}deg, var(--night-3) 0deg)` }
      "
    ></div>
    <!-- The whole ring lights up as the result lands, then gives way to the empty track. -->
    <div v-if="roulette === 'landed' && !zero" class="ring__flash" aria-hidden="true"></div>
    <div class="ring__face">
      <!-- While it spins, every new value is a new element, so each one drops in. -->
      <span :key="roulette === 'spinning' ? clock : 'clock'" class="ring__clock" role="timer">{{
        clock
      }}</span>
      <span class="ring__caption">{{ caption }}</span>
    </div>
    <template v-if="roulette === 'landed' && zero">
      <span
        v-for="n in SPROUTS"
        :key="n"
        class="ring__sprout"
        :style="{
          left: `${(n - 0.5) * (100 / SPROUTS)}%`,
          animationDelay: `${((n * 3) % SPROUTS) * 0.09}s`,
        }"
        aria-hidden="true"
        >🌱</span
      >
    </template>
  </div>
</template>

<style scoped>
.ring {
  position: relative;
  container-type: inline-size;
  aspect-ratio: 1;
}

.ring__beat,
.ring__burst {
  position: absolute;
  inset: -22px;
  border: 2px solid var(--orange);
  border-radius: 50%;
}

.ring__beat {
  animation: pn-beat 0.632s ease-out infinite;
}

.ring__burst {
  animation: pn-beat 0.8s ease-out both;
}

.ring__fill,
.ring__flash {
  position: absolute;
  inset: 0;
  border-radius: 50%;
}

/* A comet chasing its tail around the ring. */
.ring--idle .ring__fill,
.ring--spinning .ring__fill {
  background: conic-gradient(var(--night-3) 40%, var(--orange));
  animation: pn-spin 2.8s linear infinite;
}

.ring--spinning .ring__fill {
  animation-duration: 0.5s;
}

.ring__flash {
  background: var(--orange);
  animation: pn-flash 1.1s ease-in both;
}

.ring__face {
  position: absolute;
  inset: 12px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6px;
  overflow: hidden;
  border-radius: 50%;
  background: var(--night);
}

.ring__clock {
  /* Scales with the ring's width. */
  font-size: 24.6cqi;
  font-family: var(--font-sign);
  line-height: 1;
  color: var(--on-night);
}

.ring--idle .ring__clock {
  color: var(--on-night-4);
}

.ring--spinning .ring__clock {
  color: var(--orange);
  animation: pn-tick 0.14s ease-out both;
}

/* The result: it stamps down in orange and holds there a moment before settling. */
.ring--landed .ring__clock {
  animation: pn-land 1.3s var(--ease-out) both;
}

/* Zero is its own result, not an unset timer: it stays lit and bounces in. */
.ring--zero .ring__clock {
  color: var(--orange);
}

.ring--landed.ring--zero .ring__clock {
  animation: pn-zero 0.9s var(--ease-out) both;
}

.ring__sprout {
  position: absolute;
  /* They come up from under the time and drift out through the top of the ring. */
  bottom: 18%;
  margin-left: -0.5em;
  font: 26px sans-serif;
  pointer-events: none;
  animation: pn-float 1.2s ease-out both;
}

.ring__caption {
  font: var(--type-mono-meta);
  letter-spacing: var(--tracking-wide);
  max-width: 80%;
  color: var(--on-night-3);
  text-align: center;
}
</style>
