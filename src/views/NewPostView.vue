<script setup lang="ts">
import { onBeforeUnmount, ref, watch } from 'vue'
import { useRouter } from 'vue-router'

import BaseButton from '@/components/BaseButton.vue'
import BaseIconButton from '@/components/BaseIconButton.vue'
import BaseInfoNote from '@/components/BaseInfoNote.vue'
import BasePhoto from '@/components/BasePhoto.vue'
import BaseTextField from '@/components/BaseTextField.vue'
import CameraCapture from '@/components/CameraCapture.vue'
import { createPost } from '@/lib/api'
import { formatStamp } from '@/lib/format'
import { leaveStep } from '@/lib/navigation'
import { usePendingPostStore } from '@/stores/pendingPost'

const router = useRouter()
const pending = usePendingPostStore()
const photo = ref<Blob | null>(null)
const takenAt = ref(0)
const description = ref('')
const error = ref('')
const sending = ref(false)

const preview = ref<string>()

watch(photo, (blob) => {
  if (preview.value) URL.revokeObjectURL(preview.value)
  preview.value = blob ? URL.createObjectURL(blob) : undefined
})
onBeforeUnmount(() => {
  if (preview.value) URL.revokeObjectURL(preview.value)
})

function picked(blob: Blob) {
  photo.value = blob
  takenAt.value = Date.now()
}

/**
 * Opens the practice at once and uploads in the background, so the song can load meanwhile.
 * The upload page is a step, not a page: Back from what comes next skips it.
 */
async function practice() {
  if (!photo.value) return
  void pending.start(photo.value, description.value).catch(() => {})
  await router.replace('/practice')
}

/** Uploads the draft, then opens your drafts. */
async function saveDraft() {
  if (!photo.value) return
  sending.value = true
  error.value = ''
  try {
    await createPost(photo.value, description.value)
    await leaveStep(router, '/me')
  } catch (err) {
    error.value = err instanceof Error ? err.message : String(err)
  } finally {
    sending.value = false
  }
}
</script>

<template>
  <CameraCapture v-if="!photo" @picked="picked" />

  <form v-else class="upload" @submit.prevent="practice">
    <header class="head">
      <BaseIconButton label="Back to camera" @click="photo = null">←</BaseIconButton>
      <h1 class="head__title">NEW NIKKI</h1>
      <span class="head__spacer"></span>
    </header>

    <main class="fields">
      <BasePhoto :src="preview" alt="Your photo" ratio="1/1" :radius="22" stripe="lg" class="photo">
        <button type="button" class="photo__retake" @click="photo = null">RETAKE</button>
        <span class="photo__stamp">{{ formatStamp(takenAt) }}</span>
      </BasePhoto>
      <BaseTextField
        v-model="description"
        label="DESCRIPTION"
        multiline
        :maxlength="280"
        placeholder="How did practice go? How's the plant?"
      />
      <BaseInfoNote
        >Uploading starts a <b>2:00 practice</b>. Your nikki is shared when the timer runs
        out.</BaseInfoNote
      >
      <p v-if="error" class="error" role="alert">{{ error }}</p>
    </main>

    <div class="dock">
      <BaseButton type="submit" :disabled="sending">
        UPLOAD & PRACTICE
        <template #trailing>→</template>
      </BaseButton>
      <BaseButton variant="secondary" size="sm" :disabled="sending" @click="saveDraft"
        >Save to drafts</BaseButton
      >
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

.photo__retake {
  position: absolute;
  top: 12px;
  right: 12px;
  height: 36px;
  padding: 0 14px;
  border: none;
  border-radius: var(--radius-pill);
  background: var(--ink);
  color: var(--paper);
  font: var(--type-mono-meta);
  letter-spacing: var(--tracking-label);
  cursor: pointer;
}

.photo__stamp {
  position: absolute;
  left: 14px;
  bottom: 12px;
  padding: 2px 6px;
  border-radius: 6px;
  background: var(--paper);
  font: var(--type-mono-meta);
  color: var(--ink-3);
}

.error {
  margin: 0;
  font: var(--type-small);
  color: var(--orange-deep);
}

.dock {
  position: sticky;
  bottom: 0;
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-top: 8px;
  padding: 16px 20px 28px;
  background: var(--paper);
}
</style>
