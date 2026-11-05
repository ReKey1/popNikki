<script setup lang="ts">
const { tilt = 12, tone = 'orange' } = defineProps<{
  tilt?: number
  tone?: 'orange' | 'ink' | 'moss'
}>()
</script>

<template>
  <span :class="['sticker', `sticker--${tone}`]" :style="{ transform: `rotate(${tilt}deg)` }">
    <slot>日記</slot>
  </span>
</template>

<style scoped>
.sticker {
  display: inline-block;
  padding: 5px 9px;
  border-radius: var(--radius-pill);
  font: 600 12px var(--font-mono);
  white-space: nowrap;
}

.sticker--orange {
  background: var(--orange);
  color: var(--ink);
}

.sticker--ink {
  background: var(--ink);
  color: var(--paper);
}

.sticker--moss {
  background: var(--moss);
  color: var(--paper);
}
</style>
