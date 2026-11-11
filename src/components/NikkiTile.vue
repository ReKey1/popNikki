<script setup lang="ts">
import { ref, watch } from 'vue'
import { RouterLink, type RouteLocationRaw } from 'vue-router'

import BasePhoto from './BasePhoto.vue'
import BaseSeal from './BaseSeal.vue'

/** As long as the seal takes to break (see BaseSeal). */
const BREAK_MS = 400

const { sealed = false } = defineProps<{
  to: RouteLocationRaw
  name: string
  /** Thumbnail URL of the newest nikki. */
  src?: string
  /** Time since the newest nikki, such as "2h". */
  ago?: string
  day?: number
  posts: number
  /** Covers the photo with the UNSEEN tape until tapped. */
  sealed?: boolean
}>()

const state = ref<'sealed' | 'breaking' | 'open'>(sealed ? 'sealed' : 'open')
watch(
  () => sealed,
  (value) => (state.value = value ? 'sealed' : 'open'),
)

// A sealed tile plays the break animation first, then follows the link.
function tap(event: MouseEvent, navigate: (event?: MouseEvent) => unknown) {
  if (state.value === 'open') return navigate(event)
  event.preventDefault()
  if (state.value === 'breaking') return
  state.value = 'breaking'
  setTimeout(() => {
    state.value = 'open'
    navigate()
  }, BREAK_MS)
}
</script>

<template>
  <RouterLink v-slot="{ href, navigate }" :to custom>
    <a
      :href
      class="tile"
      :aria-label="state === 'open' ? undefined : `${name}, new nikki`"
      @click="tap($event, navigate)"
    >
      <BasePhoto :src :alt="`${name}'s plant`" :label="src ? undefined : 'no nikki yet'">
        <BaseSeal v-if="state !== 'open'" :breaking="state === 'breaking'" />
      </BasePhoto>
      <span class="tile__head">
        <span class="tile__name">{{ name }}</span>
        <span v-if="ago" class="tile__ago">{{ ago }}</span>
      </span>
      <span class="tile__meta">
        <template v-if="day">DAY {{ day }} · </template>{{ posts }} NIKKI
      </span>
    </a>
  </RouterLink>
</template>

<style scoped>
.tile,
.tile:hover {
  display: flex;
  flex-direction: column;
  gap: 8px;
  color: var(--ink);
  text-decoration: none;
  transition: transform var(--dur-press);
}

.tile:active {
  transform: scale(0.97);
}

.tile__head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 6px;
  padding: 0 2px;
}

.tile__name {
  overflow: hidden;
  font: 600 15px var(--font-body);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.tile__ago {
  flex: none;
  font: var(--type-mono-note);
  color: var(--ink-4);
}

.tile__meta {
  margin-top: -4px;
  padding: 0 2px;
  font: var(--type-mono-note);
  color: var(--moss);
}
</style>
