<script setup lang="ts">
import { RouterLink, type RouteLocationRaw } from 'vue-router'

const { icon = '+', to } = defineProps<{
  icon?: string
  /** Renders a RouterLink instead of a button. */
  to?: RouteLocationRaw
}>()
</script>

<template>
  <component :is="to ? RouterLink : 'button'" v-bind="to ? { to } : { type: 'button' }" class="fab">
    <span class="fab__icon" aria-hidden="true">{{ icon }}</span>
    <slot>NEW NIKKI</slot>
  </component>
</template>

<style scoped>
.fab,
.fab:hover {
  display: inline-flex;
  align-items: center;
  gap: 12px;
  height: 56px;
  padding: 0 22px 0 8px;
  border: none;
  border-radius: var(--radius-pill);
  background: var(--ink);
  color: var(--paper);
  font: 400 16px var(--font-sign);
  text-decoration: none;
  cursor: pointer;
  box-shadow: var(--shadow-hard);
  transition:
    transform 0.08s,
    box-shadow 0.08s;
}

.fab:active {
  box-shadow: 0 0 0 var(--moss);
  transform: translate(4px, 4px);
}

.fab__icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: var(--orange);
  color: var(--ink);
  font: 400 22px var(--font-sign);
}
</style>
