<script setup lang="ts">
import { computed, onMounted, ref, useTemplateRef } from 'vue'

const {
  ratio = '4/5',
  radius = 16,
  stripe = 'md',
  night = false,
  loading = 'lazy',
  placeholder,
} = defineProps<{
  /** Image URL. Without it, the striped placeholder shows. */
  src?: string
  /** A small version of the image that is already downloaded, shown while `src` loads. */
  placeholder?: string
  alt?: string
  /** Caption on the placeholder. */
  label?: string
  ratio?: string
  radius?: number
  stripe?: 'sm' | 'md' | 'lg'
  night?: boolean
  /** `eager` for the photo a page is about, so it doesn't wait for layout. */
  loading?: 'lazy' | 'eager'
}>()

const img = useTemplateRef<HTMLImageElement>('img')
/** An image the browser already has shows at once. One that has to load fades in. */
const shown = ref(false)
onMounted(() => {
  if (img.value?.complete) shown.value = true
})

const background = computed(() => {
  const stripes = night ? 'var(--stripes-night)' : `var(--stripes-${stripe})`
  return placeholder ? `center / cover no-repeat url("${placeholder}"), ${stripes}` : stripes
})
</script>

<template>
  <div class="photo" :style="{ aspectRatio: ratio, borderRadius: `${radius}px`, background }">
    <img
      v-if="src"
      ref="img"
      :src
      :alt="alt ?? ''"
      :class="['photo__img', { 'photo__img--shown': shown }]"
      :loading
      decoding="async"
      @load="shown = true"
    />
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
  opacity: 0;
  transition: opacity var(--dur-move);
}

.photo__img--shown {
  opacity: 1;
}

.photo__label {
  font: var(--type-mono-note);
  color: var(--stripe-ink);
}

.photo__label--night {
  color: var(--on-night-3);
}
</style>
