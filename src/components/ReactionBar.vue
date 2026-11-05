<script setup lang="ts">
import { REACTIONS } from '@/lib/reactions'

const { options = REACTIONS, selected = null } = defineProps<{
  options?: string[]
  /** The viewer's current reaction. */
  selected?: string | null
}>()

/** Picking the selected emoji again emits `null` (remove the reaction). */
const emit = defineEmits<{ pick: [emoji: string | null] }>()
</script>

<template>
  <div class="bar" role="group" aria-label="React">
    <button
      v-for="emoji in options"
      :key="emoji"
      type="button"
      :class="['bar__btn', { 'bar__btn--on': emoji === selected }]"
      :aria-pressed="emoji === selected"
      @click="emit('pick', emoji === selected ? null : emoji)"
    >
      {{ emoji }}
    </button>
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

.bar__btn {
  width: 44px;
  height: 44px;
  border: none;
  border-radius: 50%;
  background: transparent;
  font: 22px sans-serif;
  cursor: pointer;
  transition: transform var(--dur-press);
}

.bar__btn--on {
  background: var(--moss-mist);
  transform: scale(1.15);
}

.bar__btn:active {
  transform: scale(0.9);
}
</style>
