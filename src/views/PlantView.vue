<script setup lang="ts">
import { ref, watchEffect } from 'vue'

import { errorMessage, formatDate, type Post } from '@/lib/api'

const props = defineProps<{ id: string }>()

const owner = ref('')
const posts = ref<Post[]>([])
const error = ref('')

watchEffect(async () => {
  const res = await fetch(`/api/users/${props.id}/posts`)
  if (!res.ok) {
    error.value = await errorMessage(res)
    return
  }
  const data: { owner: { username: string }; posts: Post[] } = await res.json()
  owner.value = data.owner.username
  posts.value = data.posts
})
</script>

<template>
  <p v-if="error" role="alert">{{ error }}</p>
  <template v-else>
    <h1>{{ owner }}'s plant</h1>
    <p v-if="!posts.length">No posts yet.</p>
    <article v-for="post in posts" :key="post.id">
      <img :src="`/api/posts/${post.id}/photo`" :alt="post.description || 'Plant photo'" />
      <p>{{ post.description }}</p>
      <p>
        <small>{{ formatDate(post.published_at) }}</small>
      </p>
    </article>
  </template>
</template>
