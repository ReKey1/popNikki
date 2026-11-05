<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'

import { formatDate, type Me, type Plant } from '@/lib/api'

const loading = ref(true)
const me = ref<Me | null>(null)
const plants = ref<Plant[]>([])

onMounted(async () => {
  const res = await fetch('/api/me')
  if (res.ok) {
    me.value = await res.json()
    plants.value = await (await fetch('/api/plants')).json()
  }
  loading.value = false
})

async function logOut() {
  await fetch('/api/logout', { method: 'POST' })
  me.value = null
  plants.value = []
}
</script>

<template>
  <p v-if="loading">Loading…</p>
  <p v-else-if="!me">Tap your plant's tag to log in.</p>
  <template v-else>
    <p>
      Hi {{ me.username }}! <RouterLink to="/new">New post</RouterLink>
      <button type="button" @click="logOut">Log out</button>
    </p>
    <h1>Plants</h1>
    <ul>
      <li v-for="plant in plants" :key="plant.id">
        <RouterLink :to="`/plants/${plant.id}`">
          <img
            v-if="plant.post_id"
            :src="`/api/posts/${plant.post_id}/thumb`"
            :alt="`${plant.username}'s plant`"
            width="200"
          />
          <br />
          {{ plant.username }}
        </RouterLink>
        <span v-if="plant.published_at"> · updated {{ formatDate(plant.published_at) }}</span>
        <span v-else> · no posts yet</span>
      </li>
    </ul>
  </template>
</template>
