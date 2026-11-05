<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'

import { errorMessage } from '@/lib/api'

const router = useRouter()
const username = ref('')
const error = ref('')
const sending = ref(false)

async function claim() {
  sending.value = true
  error.value = ''
  const res = await fetch('/api/claim', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: username.value }),
  })
  sending.value = false
  if (res.ok) await router.push('/')
  else error.value = await errorMessage(res)
}
</script>

<template>
  <h1>Welcome!</h1>
  <form @submit.prevent="claim">
    <label>
      Pick a username
      <input v-model="username" required maxlength="20" autocomplete="nickname" />
    </label>
    <button type="submit" :disabled="sending">Start</button>
  </form>
  <p v-if="error" role="alert">{{ error }}</p>
</template>
