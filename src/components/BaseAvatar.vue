<script setup lang="ts">
import { computed } from 'vue'

const {
  name,
  size = 40,
  tone = 'moss',
} = defineProps<{
  name: string
  size?: number
  tone?: 'moss' | 'orange' | 'ink'
}>()

// Array.from splits by code point, so a name starting with an emoji or kanji stays whole.
const initial = computed(() => (Array.from(name)[0] ?? '?').toUpperCase())
</script>

<template>
  <span
    :class="['avatar', `avatar--${tone}`]"
    :style="{ width: `${size}px`, height: `${size}px`, fontSize: `${Math.round(size * 0.42)}px` }"
    aria-hidden="true"
    >{{ initial }}</span
  >
</template>

<style scoped>
.avatar {
  flex: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  font-family: var(--font-sign);
}

.avatar--moss {
  background: var(--moss);
  color: var(--paper);
}

.avatar--orange {
  background: var(--orange);
  color: var(--ink);
}

.avatar--ink {
  background: var(--ink);
  color: var(--paper);
}
</style>
