<script setup lang="ts">
const { tone = 'mist', selected = false } = defineProps<{
  tone?: 'mist' | 'orange' | 'ink' | 'outline' | 'count'
  /** Only shown by the `count` tone: an orange border for the viewer's own reaction. */
  selected?: boolean
}>()
</script>

<template>
  <span :class="['pill', `pill--${tone}`, { 'pill--selected': selected }]"><slot /></span>
</template>

<style scoped>
.pill {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 6px 12px;
  border-radius: var(--radius-pill);
  font: 600 11px var(--font-mono);
  letter-spacing: 0.04em;
  white-space: nowrap;
}

.pill--mist {
  background: var(--moss-mist);
  color: var(--ink);
}

.pill--orange {
  background: var(--orange);
  color: var(--ink);
}

.pill--ink {
  background: var(--ink);
  color: var(--paper);
}

.pill--outline {
  background: transparent;
  color: var(--ink);
  border: var(--border-input);
}

.pill--count {
  padding: 5px 10px;
  background: var(--paper-raised);
  color: var(--ink);
  border: 1.5px solid var(--rule);
  font: 600 12px var(--font-mono);
  letter-spacing: 0;
}

.pill--count {
  transition: border-color var(--dur-press);
}

.pill--count.pill--selected {
  border-color: var(--orange);
}
</style>
