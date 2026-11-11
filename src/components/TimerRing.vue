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
   * `spinning` races, and `landed` pops the result into place.
   */
  roulette?: 'idle' | 'spinning' | 'landed'
}>()

const clock = computed(() => display ?? formatClock(remaining))
const degrees = computed(() => (total > 0 ? Math.round(((total - remaining) / total) * 360) : 0))
const circling = computed(() => roulette === 'idle' || roulette === 'spinning')
</script>

<template>
  <!-- size is the largest it gets: it shrinks on narrow or short screens. -->
  <div
    :class="['ring', roulette && `ring--${roulette}`]"
    :style="{ width: `min(${size}px, 70vw, 42dvh)` }"
  >
    <div v-if="running" class="ring__beat" aria-hidden="true"></div>
    <div v-if="roulette === 'landed'" class="ring__burst" aria-hidden="true"></div>
    <div
      class="ring__fill"
      :style="
        circling
          ? undefined
          : { background: `conic-gradient(var(--orange) ${degrees}deg, var(--night-3) 0deg)` }
      "
    ></div>
    <div class="ring__face">
      <!-- While it spins, every new value is a new element, so each one drops in. -->
      <span :key="roulette === 'spinning' ? clock : 'clock'" class="ring__clock" role="timer">{{
        clock
      }}</span>
      <span class="ring__caption">{{ caption }}</span>
    </div>
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
  animation: pn-beat 0.7s ease-out both;
}

.ring__fill {
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

.ring--landed .ring__clock {
  animation: pn-in 0.5s var(--ease-spring) both;
}

.ring__caption {
  font: var(--type-mono-meta);
  letter-spacing: var(--tracking-wide);
  max-width: 80%;
  color: var(--on-night-3);
  text-align: center;
}
</style>
