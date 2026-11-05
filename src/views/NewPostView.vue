<script setup lang="ts">
import { onBeforeUnmount, ref } from 'vue'
import { useRouter } from 'vue-router'

import BaseButton from '@/components/BaseButton.vue'
import BaseIconButton from '@/components/BaseIconButton.vue'
import BasePhoto from '@/components/BasePhoto.vue'
import BaseTextField from '@/components/BaseTextField.vue'
import { errorMessage, type Me } from '@/lib/api'
import { resizeToJpeg } from '@/lib/image'

const router = useRouter()
const file = ref<File | null>(null)
const preview = ref<string>()
const description = ref('')
const error = ref('')
const sending = ref(false)

function pick(event: Event) {
  file.value = (event.target as HTMLInputElement).files?.[0] ?? null
  if (preview.value) URL.revokeObjectURL(preview.value)
  preview.value = file.value ? URL.createObjectURL(file.value) : undefined
}
onBeforeUnmount(() => {
  if (preview.value) URL.revokeObjectURL(preview.value)
})

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
  <form class="upload" @submit.prevent="send">
    <header class="head">
      <BaseIconButton label="Back" to="/">←</BaseIconButton>
      <h1 class="head__title">NEW NIKKI</h1>
      <span class="head__spacer"></span>
    </header>

    <main class="fields">
      <BasePhoto :src="preview" alt="Your photo" ratio="1/1" :radius="22" stripe="lg" class="photo">
        <label class="photo__pick">
          {{ file ? 'RETAKE' : 'ADD PHOTO' }}
          <input type="file" accept="image/*" required class="photo__input" @change="pick" />
        </label>
      </BasePhoto>
      <BaseTextField
        v-model="description"
        label="DESCRIPTION"
        multiline
        :maxlength="280"
        placeholder="How did practice go? How's the plant?"
      />
      <p v-if="error" class="error" role="alert">{{ error }}</p>
    </main>

    <div class="dock">
      <BaseButton type="submit" :disabled="sending || !file">
        {{ sending ? 'UPLOADING…' : 'UPLOAD & POST' }}
        <template #trailing>→</template>
      </BaseButton>
    </div>
  </form>
</template>

<style scoped>
.upload {
  display: flex;
  flex-direction: column;
  min-height: 100dvh;
}

.head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 16px;
}

.head__title {
  margin: 0;
  font: var(--type-sign-md);
}

.head__spacer {
  width: 44px;
}

.fields {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 0 20px;
}

.photo {
  align-items: center;
  justify-content: center;
}

.photo__pick {
  position: absolute;
  top: 12px;
  right: 12px;
  display: flex;
  align-items: center;
  height: 36px;
  padding: 0 14px;
  border-radius: var(--radius-pill);
  background: var(--ink);
  color: var(--paper);
  font: var(--type-mono-meta);
  letter-spacing: var(--tracking-label);
  cursor: pointer;
}

.photo__pick:focus-within {
  outline: 2px solid var(--orange);
  outline-offset: 2px;
}

/* Visually hidden but still focusable and announced. */
.photo__input {
  position: absolute;
  width: 1px;
  height: 1px;
  opacity: 0;
}

.error {
  margin: 0;
  font: var(--type-small);
  color: var(--orange-deep);
}

.dock {
  position: sticky;
  bottom: 0;
  margin-top: 8px;
  padding: 16px 20px 28px;
  background: var(--paper);
}
</style>
