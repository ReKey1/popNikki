<script setup lang="ts">
import { RouterLink, type RouteLocationRaw } from 'vue-router'

const {
  tone = 'soft',
  size = 44,
  to,
} = defineProps<{
  /** Accessible name; the glyph inside is decorative. */
  label: string
  tone?: 'soft' | 'outline' | 'night'
  size?: number
  /** Renders a RouterLink instead of a button. */
  to?: RouteLocationRaw
}>()
</script>

<template>
  <component
    :is="to ? RouterLink : 'button'"
    v-bind="to ? { to } : { type: 'button' }"
    :aria-label="label"
    :class="['icon-btn', `icon-btn--${tone}`]"
    :style="{ width: `${size}px`, height: `${size}px` }"
  >
    <span aria-hidden="true"><slot /></span>
  </component>
</template>

<style scoped>
.icon-btn {
  flex: none;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  border: none;
  border-radius: 50%;
  font: 16px sans-serif;
  text-decoration: none;
  cursor: pointer;
}

.icon-btn--soft,
.icon-btn--soft:hover {
  background: var(--moss-mist);
  color: var(--ink);
}

.icon-btn--outline,
.icon-btn--outline:hover {
  background: transparent;
  color: var(--ink);
  border: var(--border-input);
}

.icon-btn--night,
.icon-btn--night:hover {
  background: var(--on-night-soft);
  color: var(--on-night);
}

.icon-btn:active {
  transform: scale(0.92);
}
</style>
