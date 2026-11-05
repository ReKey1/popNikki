<script setup lang="ts">
const {
  ratio = '4/5',
  radius = 16,
  stripe = 'md',
  night = false,
} = defineProps<{
  /** Image URL. Without it, the striped placeholder shows. */
  src?: string
  alt?: string
  /** Caption on the placeholder. */
  label?: string
  ratio?: string
  radius?: number
  stripe?: 'sm' | 'md' | 'lg'
  night?: boolean
}>()
</script>

<template>
  <div
    class="photo"
    :style="{
      aspectRatio: ratio,
      borderRadius: `${radius}px`,
      background: night ? 'var(--stripes-night)' : `var(--stripes-${stripe})`,
    }"
  >
    <img v-if="src" :src :alt="alt ?? ''" class="photo__img" loading="lazy" />
    <span v-else-if="label" :class="['photo__label', { 'photo__label--night': night }]">{{
      label
    }}</span>
    <slot />
  </div>
</template>

<style scoped>
.photo {
  position: relative;
  display: flex;
  align-items: flex-end;
  padding: 10px;
  overflow: hidden;
}

.photo__img {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  border-radius: inherit;
}

.photo__label {
  font: var(--type-mono-note);
  color: var(--stripe-ink);
}

.photo__label--night {
  color: var(--on-night-3);
}
</style>
