<script setup lang="ts">
import { computed } from 'vue'

const {
  remaining,
  total = 120,
  running = false,
  caption = 'UNTIL YOUR NIKKI DROPS',
  size = 260,
} = defineProps<{
  /** Seconds left. */
  remaining: number
  total?: number
  /** Shows the beat pulse around the ring. */
  running?: boolean
  caption?: string
  size?: number
}>()

const clock = computed(() => {
  const sec = Math.max(0, Math.ceil(remaining))
  return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`
})
const degrees = computed(() => Math.round(((total - remaining) / total) * 360))
</script>

<template>
  <!-- size is the largest it gets: it shrinks on narrow or short screens. -->
  <div class="ring" :style="{ width: `min(${size}px, 70vw, 42dvh)` }">
    <div v-if="running" class="ring__beat" aria-hidden="true"></div>
    <div
      class="ring__fill"
      :style="{ background: `conic-gradient(var(--orange) ${degrees}deg, var(--night-3) 0deg)` }"
    ></div>
    <div class="ring__face">
      <span class="ring__clock" role="timer">{{ clock }}</span>
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

.ring__beat {
  position: absolute;
  inset: -22px;
  border: 2px solid var(--orange);
  border-radius: 50%;
  animation: pn-beat 0.632s ease-out infinite;
}

.ring__fill {
  position: absolute;
  inset: 0;
  border-radius: 50%;
}

.ring__face {
  position: absolute;
  inset: 12px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6px;
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

.ring__caption {
  font: var(--type-mono-meta);
  letter-spacing: var(--tracking-wide);
  max-width: 80%;
  color: var(--on-night-3);
  text-align: center;
}
</style>
