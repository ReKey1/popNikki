<script setup lang="ts">
import { RouterLink, type RouteLocationRaw } from 'vue-router'

import BasePhoto from './BasePhoto.vue'

const {
  card = false,
  current = false,
  to,
} = defineProps<{
  day: number
  /** Short date or "SAVED …" stamp. */
  date: string
  text: string
  /** Thumbnail URL. Without it, the striped placeholder shows. */
  src?: string
  /** Secondary line, such as reaction counts. */
  meta?: string
  /** Raised card style used for drafts, with the text clamped to two lines. */
  card?: boolean
  /** Makes the whole row a link, such as to the post's own page. */
  to?: RouteLocationRaw
  /** Marks the row of the post shown on the page right now. */
  current?: boolean
}>()

const slots = defineSlots<{ actions?(): unknown }>()
</script>

<template>
  <component
    :is="to ? RouterLink : 'article'"
    v-bind="to ? { to } : {}"
    :class="['row', { 'row--card': card, 'row--link': to, 'row--current': current }]"
    :aria-current="current ? 'true' : undefined"
  >
    <BasePhoto :src :radius="12" stripe="sm" />
    <div class="row__body">
      <div class="row__date">DAY {{ day }} · {{ date }}</div>
      <p class="row__text">{{ text }}</p>
      <div v-if="meta" class="row__meta">{{ meta }}</div>
      <div v-if="slots.actions" class="row__actions"><slot name="actions" /></div>
    </div>
  </component>
</template>

<style scoped>
.row--link,
.row--link:hover {
  color: inherit;
  text-decoration: none;
}

.row--link:active {
  opacity: 0.6;
}

.row {
  display: grid;
  grid-template-columns: 96px minmax(0, 1fr);
  gap: 14px;
  padding: 14px 0;
  border-bottom: var(--border-hair);
  transition:
    background-color var(--dur-move),
    opacity var(--dur-press);
}

.row--current {
  margin: 0 -10px;
  padding: 14px 10px;
  border-bottom-color: transparent;
  border-radius: var(--radius-lg);
  background: var(--moss-mist);
  box-shadow: inset 3px 0 0 var(--moss);
}

.row--card {
  padding: 12px;
  border-bottom: none;
  border-radius: var(--radius-xl);
  background: var(--paper-raised);
}

.row__body {
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
  padding-top: 2px;
}

.row__date {
  font: var(--type-mono-meta);
  letter-spacing: 0.08em;
  color: var(--moss);
}

.row__text {
  margin: 0;
  font: 400 15px/1.4 var(--font-body);
  color: var(--ink-2);
  text-wrap: pretty;
}

.row--card .row__text {
  display: -webkit-box;
  overflow: hidden;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}

.row__meta {
  font: 12px sans-serif;
  color: var(--ink-4);
}

.row__actions {
  display: flex;
  gap: 6px;
  margin-top: auto;
}
</style>
