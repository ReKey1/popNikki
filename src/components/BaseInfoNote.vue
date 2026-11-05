<script setup lang="ts">
const { icon = '♪' } = defineProps<{ icon?: string }>()
</script>

<template>
  <div class="note">
    <span class="note__icon" aria-hidden="true">{{ icon }}</span>
    <span class="note__text"><slot /></span>
  </div>
</template>

<style scoped>
.note {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px;
  border-radius: var(--radius-lg);
  background: var(--moss-mist);
}

.note__icon {
  flex: none;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: var(--moss);
  color: var(--paper);
  font: 16px sans-serif;
}

.note__text {
  font: 400 14px/1.4 var(--font-body);
  color: var(--ink-2);
  text-wrap: pretty;
}
</style>
