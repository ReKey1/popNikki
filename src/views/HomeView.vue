<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'

import BaseAvatar from '@/components/BaseAvatar.vue'
import BaseFab from '@/components/BaseFab.vue'
import BasePill from '@/components/BasePill.vue'
import BaseWordmark from '@/components/BaseWordmark.vue'
import NikkiTile from '@/components/NikkiTile.vue'
import { usePolling } from '@/composables/usePolling'
import type { Me, Plant } from '@/lib/api'
import { dayNumber, timeAgo } from '@/lib/format'

const loading = ref(true)
const me = ref<Me | null>(null)
const plants = ref<Plant[]>([])

const fresh = computed(() => plants.value.filter((p) => p.unseen).length)

async function loadPlants() {
  const res = await fetch('/api/plants')
  // A failed refresh keeps the garden on screen.
  if (res.ok) plants.value = await res.json()
}

onMounted(async () => {
  const res = await fetch('/api/me')
  if (res.ok) {
    me.value = await res.json()
    await loadPlants()
  }
  loading.value = false
})
// New nikki and badges show up without a reload.
usePolling(() => me.value && loadPlants())
</script>

<template>
  <div v-if="loading" class="status mono-label" aria-live="polite">LOADING…</div>

  <main v-else-if="!me" class="gate">
    <h1 class="gate__mark"><BaseWordmark layout="stacked" sticker /></h1>
    <p class="gate__tagline">PRACTICE · WATER · POST</p>
    <p class="gate__note">No seed, no entry. Tap your plant's tag to log in.</p>
  </main>

  <template v-else>
    <header class="head">
      <h1 class="head__mark"><BaseWordmark animated /></h1>
      <RouterLink to="/me" aria-label="My profile" class="head__me">
        <BaseAvatar :name="me.username" tone="orange" :size="44" />
      </RouterLink>
    </header>

    <main>
      <div class="intro">
        <div>
          <div class="intro__kicker mono-label">THE GARDEN</div>
          <h2 class="intro__headline">
            {{ plants.length }} {{ plants.length === 1 ? 'plant' : 'plants' }},<br />growing on
            beat.
          </h2>
        </div>
        <BasePill v-if="fresh" tone="orange" class="intro__fresh">{{ fresh }} FRESH</BasePill>
      </div>

      <ul class="grid">
        <li v-for="plant in plants" :key="plant.id">
          <NikkiTile
            :to="`/plants/${plant.id}`"
            :name="plant.username"
            :src="plant.post_id ? `/api/posts/${plant.post_id}/thumb` : undefined"
            :ago="plant.published_at ? timeAgo(plant.published_at) : undefined"
            :day="plant.first_published_at ? dayNumber(plant.first_published_at) : undefined"
            :posts="plant.post_count"
            :sealed="plant.unseen"
          />
        </li>
      </ul>

      <div class="fab-dock"><BaseFab to="/new">NEW NIKKI</BaseFab></div>
    </main>
  </template>
</template>

<style scoped>
.status {
  padding: 40px 20px;
  color: var(--ink-4);
  text-align: center;
}

.gate {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 100dvh;
  padding: 28px;
  text-align: center;
}

.gate__mark {
  margin: 0;
  font-size: inherit;
}

.gate__tagline {
  margin: 40px 0 0;
  font: 500 12px var(--font-mono);
  letter-spacing: 0.14em;
  color: var(--ink-3);
}

.gate__note {
  margin: 16px 0 0;
  font: 13px var(--font-body);
  color: var(--ink-4);
}

.head {
  position: sticky;
  top: 0;
  z-index: 2;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 18px 20px 14px;
  border-bottom: var(--border-hair);
  background: var(--paper);
}

.head__mark {
  margin: 0;
  font-size: inherit;
}

.intro {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 12px;
  padding: 22px 20px 10px;
}

.intro__kicker {
  color: var(--moss);
}

.intro__headline {
  margin: 4px 0 0;
  font: var(--type-headline);
}

.intro__fresh {
  animation: pn-wobble 2.4s ease-in-out infinite;
}

.grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 14px;
  margin: 0;
  padding: 12px 20px 32px;
  list-style: none;
}

.fab-dock {
  position: sticky;
  bottom: 20px;
  display: flex;
  justify-content: center;
  margin-top: -8px;
  padding-bottom: 24px;
}

.head__me {
  display: flex;
  border-radius: 50%;
}
</style>
