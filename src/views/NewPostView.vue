<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'

import { errorMessage, type Me } from '@/lib/api'
import { resizeToJpeg } from '@/lib/image'

const router = useRouter()
const file = ref<File | null>(null)
const description = ref('')
const error = ref('')
const sending = ref(false)

function pick(event: Event) {
  file.value = (event.target as HTMLInputElement).files?.[0] ?? null
}

async function send() {
  if (!file.value) return
  sending.value = true
  error.value = ''
  try {
    const form = new FormData()
    form.append('photo', await resizeToJpeg(file.value, 1600), 'photo.jpg')
    form.append('thumb', await resizeToJpeg(file.value, 400), 'thumb.jpg')
    form.append('description', description.value)
    const res = await fetch('/api/posts', { method: 'POST', body: form })
    if (!res.ok) {
      error.value = await errorMessage(res)
      return
    }
    const me: Me = await (await fetch('/api/me')).json()
    await router.push(`/plants/${me.id}`)
  } catch (err) {
    error.value = err instanceof Error ? err.message : String(err)
  } finally {
    sending.value = false
  }
}
</script>

<template>
  <h1>New post</h1>
  <form @submit.prevent="send">
    <p>
      <label>
        Photo
        <input type="file" accept="image/*" required @change="pick" />
      </label>
    </p>
    <p>
      <label>
        Description<br />
        <textarea v-model="description" maxlength="1000" rows="4" cols="30"></textarea>
      </label>
    </p>
    <button type="submit" :disabled="sending || !file">
      {{ sending ? 'Sending…' : 'Send' }}
    </button>
  </form>
  <p v-if="error" role="alert">{{ error }}</p>
</template>
