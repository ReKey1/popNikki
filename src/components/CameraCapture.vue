<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, shallowRef, useTemplateRef, watch } from 'vue'

import BaseIconButton from './BaseIconButton.vue'
import BasePhoto from './BasePhoto.vue'

const emit = defineEmits<{ picked: [photo: Blob] }>()

const video = useTemplateRef<HTMLVideoElement>('video')
const facing = ref<'environment' | 'user'>('environment')
const stream = shallowRef<MediaStream | null>(null)
const unavailable = ref(false)
let unmounted = false

function stop() {
  stream.value?.getTracks().forEach((track) => track.stop())
  stream.value = null
}

async function start() {
  stop()
  try {
    const media = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: facing.value },
      audio: false,
    })
    // The page may have closed while the permission prompt was open.
    if (unmounted) {
      media.getTracks().forEach((track) => track.stop())
      return
    }
    stream.value = media
    unavailable.value = false
    if (video.value) video.value.srcObject = media
  } catch {
    // No camera, permission denied, or not a secure context: the library picker still works.
    unavailable.value = true
  }
}

onMounted(start)
watch(facing, start)
onBeforeUnmount(() => {
  unmounted = true
  stop()
})

function capture() {
  const el = video.value
  if (!el || !el.videoWidth) return
  const canvas = document.createElement('canvas')
  canvas.width = el.videoWidth
  canvas.height = el.videoHeight
  canvas.getContext('2d')!.drawImage(el, 0, 0)
  canvas.toBlob((blob) => blob && emit('picked', blob), 'image/jpeg', 0.92)
}

function pick(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (file) emit('picked', file)
}
</script>

<template>
  <div class="camera">
    <header class="head">
      <BaseIconButton tone="night" label="Close" to="/">✕</BaseIconButton>
      <h1 class="head__title mono-label">NEW NIKKI</h1>
      <span class="head__spacer"></span>
    </header>

    <div class="finder">
      <video
        v-show="stream"
        ref="video"
        :class="['finder__video', { 'finder__video--mirror': facing === 'user' }]"
        autoplay
        playsinline
        muted
      ></video>
      <p v-if="unavailable" class="finder__note">
        No camera here. Pick a photo from your library instead.
      </p>
      <template v-else>
        <span class="finder__hint">CENTER YOUR PLANT</span>
        <span class="finder__circle" aria-hidden="true"></span>
        <span class="corner corner--tl" aria-hidden="true"></span>
        <span class="corner corner--tr" aria-hidden="true"></span>
        <span class="corner corner--bl" aria-hidden="true"></span>
        <span class="corner corner--br" aria-hidden="true"></span>
      </template>
    </div>

    <div class="mode mono-label"><span class="mode__dot" aria-hidden="true"></span>PHOTO</div>

    <div class="controls">
      <label class="library">
        <BasePhoto ratio="1/1" :radius="12" stripe="sm" night />
        <span class="visually-hidden">Choose from library</span>
        <input type="file" accept="image/*" class="visually-hidden" @change="pick" />
      </label>
      <button
        type="button"
        class="shutter"
        aria-label="Capture"
        :disabled="!stream"
        @click="capture"
      >
        <span class="shutter__inner"></span>
      </button>
      <BaseIconButton
        tone="night"
        :size="52"
        label="Flip camera"
        @click="facing = facing === 'user' ? 'environment' : 'user'"
        >⟲</BaseIconButton
      >
    </div>
  </div>
</template>

<style scoped>
.camera {
  display: flex;
  flex-direction: column;
  min-height: 100dvh;
  background: var(--night);
  color: var(--on-night);
}

.head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px;
}

.head__title {
  margin: 0;
}

.head__spacer {
  width: 44px;
}

.finder {
  position: relative;
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 320px;
  margin: 4px 16px 0;
  border-radius: 28px;
  overflow: hidden;
  background: var(--stripes-night);
}

.finder__video {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.finder__video--mirror {
  transform: scaleX(-1);
}

.finder__note {
  max-width: 240px;
  margin: 0;
  font: var(--type-small);
  color: var(--on-night-2);
  text-align: center;
}

.finder__hint {
  position: absolute;
  top: 18px;
  left: 50%;
  transform: translateX(-50%);
  padding: 6px 12px;
  border-radius: var(--radius-pill);
  background: rgb(22 21 18 / 70%);
  font: var(--type-mono-meta);
  letter-spacing: var(--tracking-label);
  white-space: nowrap;
}

.finder__circle {
  position: relative;
  width: 230px;
  height: 230px;
  border: 1.5px dashed rgb(244 241 234 / 40%);
  border-radius: 50%;
}

.corner {
  position: absolute;
  width: 30px;
  height: 30px;
  border: 0 solid var(--on-night);
}

.corner--tl {
  top: 22px;
  left: 22px;
  border-width: 3px 0 0 3px;
  border-radius: 12px 0 0 0;
}

.corner--tr {
  top: 22px;
  right: 22px;
  border-width: 3px 3px 0 0;
  border-radius: 0 12px 0 0;
}

.corner--bl {
  bottom: 22px;
  left: 22px;
  border-width: 0 0 3px 3px;
  border-radius: 0 0 0 12px;
}

.corner--br {
  bottom: 22px;
  right: 22px;
  border-width: 0 3px 3px 0;
  border-radius: 0 0 12px 0;
}

.mode {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 18px 0 4px;
  letter-spacing: var(--tracking-wide);
}

.mode__dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--orange);
}

.controls {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 36px 40px;
}

.library {
  width: 52px;
  cursor: pointer;
}

.library:focus-within {
  outline: 2px solid var(--orange);
  outline-offset: 2px;
  border-radius: 12px;
}

.shutter {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 84px;
  height: 84px;
  padding: 0;
  border: 4px solid var(--on-night);
  border-radius: 50%;
  background: transparent;
  cursor: pointer;
}

.shutter:disabled {
  opacity: 0.4;
  cursor: default;
}

.shutter:active:not(:disabled) {
  transform: scale(0.94);
}

.shutter__inner {
  width: 62px;
  height: 62px;
  border-radius: 50%;
  background: var(--orange);
}

/* Hidden but still focusable and announced. */
.visually-hidden {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
}
</style>
