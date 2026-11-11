<script setup lang="ts">
import { ref } from 'vue'

import { REACTIONS } from '@/lib/reactions'

const { options = REACTIONS, selected = null } = defineProps<{
  options?: string[]
  /** The viewer's current reaction. */
  selected?: string | null
}>()

/** Picking the selected emoji again emits `null` (remove the reaction). */
const emit = defineEmits<{ pick: [emoji: string | null] }>()

/** The emoji drifting up from the bar after a pick, each one until its animation ends. */
const floating = ref<{ id: number; emoji: string }[]>([])
let nextId = 0

function pick(emoji: string) {
  const adding = emoji !== selected
  if (adding) floating.value.push({ id: nextId++, emoji })
  emit('pick', adding ? emoji : null)
}
</script>

<template>
  <div class="bar" role="group" aria-label="React">
    <span v-for="emoji in options" :key="emoji" class="bar__slot">
      <button
        type="button"
        :class="['bar__btn', { 'bar__btn--on': emoji === selected }]"
        :aria-pressed="emoji === selected"
        @click="pick(emoji)"
      >
        {{ emoji }}
      </button>
      <span
        v-for="float in floating.filter((f) => f.emoji === emoji)"
        :key="float.id"
        class="bar__float"
        aria-hidden="true"
        @animationend="floating = floating.filter((f) => f.id !== float.id)"
        >{{ emoji }}</span
      >
    </span>
  </div>
</template>

<style scoped>
.bar {
  display: flex;
  justify-content: space-between;
  padding: 6px 8px;
  border-radius: var(--radius-pill);
  background: var(--paper-raised);
  box-shadow: var(--shadow-float);
}

.bar__slot {
  position: relative;
  display: flex;
}

.bar__btn {
  width: 44px;
  height: 44px;
  border: none;
  border-radius: 50%;
  background: transparent;
  font: 22px sans-serif;
  cursor: pointer;
  transition:
    transform var(--dur-press),
    background-color var(--dur-press);
}

.bar__btn--on {
  background: var(--moss-mist);
  transform: scale(1.15);
}

.bar__btn:active {
  transform: scale(0.9);
}

.bar__float {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font: 22px sans-serif;
  pointer-events: none;
  animation: pn-float 0.8s ease-out forwards;
}
</style>
