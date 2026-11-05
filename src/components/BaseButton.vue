<script setup lang="ts">
import { RouterLink, type RouteLocationRaw } from 'vue-router'

const {
  variant = 'primary',
  size = 'lg',
  to,
  fullWidth = true,
  disabled = false,
  type = 'button',
} = defineProps<{
  variant?: 'primary' | 'dark' | 'secondary' | 'accent' | 'quiet'
  size?: 'sm' | 'md' | 'lg'
  /** Renders a RouterLink instead of a button. */
  to?: RouteLocationRaw
  fullWidth?: boolean
  disabled?: boolean
  type?: 'button' | 'submit'
}>()

const slots = defineSlots<{ default(): unknown; leading?(): unknown; trailing?(): unknown }>()
</script>

<template>
  <component
    :is="to ? RouterLink : 'button'"
    v-bind="to ? { to } : { type, disabled }"
    :class="[
      'btn',
      `btn--${variant}`,
      `btn--${size}`,
      { 'btn--full': fullWidth, 'btn--split': slots.trailing },
    ]"
  >
    <slot name="leading" />
    <span><slot /></span>
    <span v-if="slots.trailing" aria-hidden="true"><slot name="trailing" /></span>
  </component>
</template>

<style scoped>
.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  padding: 0 18px;
  border: none;
  border-radius: var(--radius-md);
  font: 600 15px var(--font-body);
  text-decoration: none;
  cursor: pointer;
  transition:
    transform 0.08s,
    box-shadow 0.08s;
}

.btn:disabled {
  opacity: 0.4;
  cursor: default;
}

.btn--full {
  display: flex;
  width: 100%;
}

.btn--split {
  justify-content: space-between;
  padding: 0 22px;
}

.btn--sm {
  height: var(--control-sm);
}

.btn--md {
  height: var(--control-md);
}

.btn--lg {
  height: var(--control-lg);
}

/* Signage variants use Bungee. */
.btn--primary,
.btn--dark,
.btn--accent {
  letter-spacing: 0.02em;
}

.btn--primary.btn--lg,
.btn--dark.btn--lg,
.btn--accent.btn--lg {
  font: 400 18px var(--font-sign);
}

.btn--primary.btn--md,
.btn--dark.btn--md,
.btn--accent.btn--md {
  font: 400 14px var(--font-sign);
}

.btn--primary.btn--sm,
.btn--dark.btn--sm,
.btn--accent.btn--sm {
  font: 400 12px var(--font-sign);
}

.btn--primary,
.btn--primary:hover {
  background: var(--ink);
  color: var(--paper);
  box-shadow: var(--shadow-hard);
}

.btn--primary:active:not(:disabled) {
  box-shadow: 0 0 0 var(--moss);
  transform: translate(4px, 4px);
}

.btn--dark,
.btn--dark:hover {
  background: var(--ink);
  color: var(--paper);
}

.btn--secondary,
.btn--secondary:hover {
  background: transparent;
  color: var(--ink);
  border: var(--border-input);
}

.btn--dark:active:not(:disabled),
.btn--secondary:active:not(:disabled) {
  transform: scale(0.97);
}

.btn--accent,
.btn--accent:hover {
  background: var(--orange);
  color: var(--ink);
  border-radius: var(--radius-pill);
}

.btn--accent:active:not(:disabled) {
  transform: scale(0.94);
}

.btn--quiet,
.btn--quiet:hover {
  background: transparent;
  color: var(--ink-3);
  border: 1.5px solid var(--rule);
  border-radius: var(--radius-pill);
}
</style>
