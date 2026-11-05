<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, useTemplateRef } from 'vue'

import BaseButton from '@/components/BaseButton.vue'
import BaseIconButton from '@/components/BaseIconButton.vue'
import TimerRing from '@/components/TimerRing.vue'
import { errorMessage, type StartResult } from '@/lib/api'

const props = defineProps<{ id: string }>()

/** The client clock only drives the display. The server checks the real two minutes. */
const TOTAL = 120

const phase = ref<'ready' | 'starting' | 'running' | 'paused' | 'publishing' | 'done'>('ready')
const remaining = ref(TOTAL)
const track = ref<{ id: number; title: string } | null>(null)
const error = ref('')
const audio = useTemplateRef<HTMLAudioElement>('audio')

let timer: ReturnType<typeof setInterval> | undefined
let lastTick = 0
let wakeLock: WakeLockSentinel | null = null
let retried = false

function tick() {
  const now = Date.now()
  remaining.value = Math.max(0, remaining.value - (now - lastTick) / 1000)
  lastTick = now
  if (remaining.value === 0) void finish()
}

async function run() {
  phase.value = 'running'
  lastTick = Date.now()
  clearInterval(timer)
  timer = setInterval(tick, 250)
  // Without a user gesture the browser may refuse to play; RESUME is a fresh gesture.
  const playing = audio.value?.play().catch(() => pause())
  // Keep the screen on where the browser supports it.
  wakeLock = (await navigator.wakeLock?.request('screen').catch(() => null)) ?? null
  await playing
}

function pause() {
  if (phase.value !== 'running') return
  phase.value = 'paused'
  clearInterval(timer)
  audio.value?.pause()
  void wakeLock?.release()
  wakeLock = null
}

async function start() {
  phase.value = 'starting'
  error.value = ''
  const res = await fetch(`/api/posts/${props.id}/start`, { method: 'POST' })
  if (!res.ok) {
    error.value = await errorMessage(res)
    phase.value = 'ready'
    return
  }
  const result: StartResult = await res.json()
  // No tracks on the playlist: the server published straight away.
  if ('published' in result) {
    remaining.value = 0
    phase.value = 'done'
    return
  }
  track.value = result.track
  if (audio.value) audio.value.src = `/api/tracks/${result.track.id}/audio`
  await run()
}

function toggle() {
  if (phase.value === 'ready') void start()
  else if (phase.value === 'running') pause()
  else if (phase.value === 'paused') void run()
}

/** Fades the music out over about a second, then stops it. */
function fadeOut() {
  const el = audio.value
  if (!el) return
  const fade = setInterval(() => {
    el.volume = Math.max(0, el.volume - 0.1)
    if (el.volume === 0) {
      clearInterval(fade)
      el.pause()
    }
  }, 100)
}

async function finish() {
  clearInterval(timer)
  phase.value = 'publishing'
  fadeOut()
  void wakeLock?.release()
  wakeLock = null
  await publish()
}

async function publish() {
  const res = await fetch(`/api/posts/${props.id}/publish`, { method: 'POST' })
  if (res.ok) {
    phase.value = 'done'
    return
  }
  const body = (await res.json().catch(() => null)) as { error?: string; retry_after?: number }
  // The server's clock is the judge; if it disagrees by a moment, wait and ask once more.
  if (res.status === 409 && body?.retry_after && !retried) {
    retried = true
    setTimeout(publish, body.retry_after * 1000)
    return
  }
  error.value = body?.error ?? `Something went wrong (${res.status})`
}

// Leaving the page pauses the music and the timer.
function onVisibility() {
  if (document.visibilityState === 'hidden') pause()
}
onMounted(() => document.addEventListener('visibilitychange', onVisibility))
onBeforeUnmount(() => {
  document.removeEventListener('visibilitychange', onVisibility)
  clearInterval(timer)
  audio.value?.pause()
  void wakeLock?.release()
})

const buttonLabel = computed(() =>
  phase.value === 'running' ? 'PAUSE' : phase.value === 'paused' ? 'RESUME' : 'START',
)
</script>

<template>
  <main v-if="phase === 'done'" class="done">
    <div class="done__inner">
      <h1 class="done__title">POSTED</h1>
      <p class="done__text">Plant watered. Your nikki is live in the garden.</p>
      <div class="done__actions">
        <BaseButton variant="dark" size="md" to="/" class="done__main">
          SEE THE GARDEN
          <template #trailing>→</template>
        </BaseButton>
        <BaseButton variant="secondary" size="sm" to="/me">My garden</BaseButton>
      </div>
    </div>
  </main>

  <main v-else class="practice">
    <header class="head">
      <BaseIconButton tone="night" label="Quit" to="/me">✕</BaseIconButton>
      <h1 class="head__title mono-label">PRACTICE</h1>
      <span class="head__spacer"></span>
    </header>

    <div class="stage">
      <TimerRing :remaining="remaining" :running="phase === 'running'" />
      <span class="stage__note mono-label">QUIT = SAVED TO DRAFTS</span>
    </div>

    <div class="deck">
      <div class="deck__kicker mono-label">{{ track ? 'NOW PLAYING' : 'READY?' }}</div>
      <div class="deck__title">{{ track?.title ?? 'Press start and dance' }}</div>
      <p v-if="phase === 'publishing' && !error" class="deck__status" aria-live="polite">
        Posting…
      </p>
      <p v-if="error" class="deck__error" role="alert">{{ error }}</p>
      <div class="deck__play">
        <BaseButton
          variant="accent"
          :full-width="false"
          :disabled="phase === 'starting' || phase === 'publishing'"
          class="deck__btn"
          @click="toggle"
          >{{ buttonLabel }}</BaseButton
        >
      </div>
    </div>

    <!-- Its src is set when the server picks the track. -->
    <audio ref="audio" preload="auto" loop></audio>
  </main>
</template>

<style scoped>
.practice {
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
  letter-spacing: var(--tracking-wide);
}

.head__spacer {
  width: 44px;
}

.stage {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 18px;
  padding: 16px 0;
}

.stage__note {
  font: var(--type-mono-meta);
  letter-spacing: var(--tracking-label);
  color: var(--on-night-3);
}

.deck {
  padding: 0 24px 40px;
  text-align: center;
}

.deck__kicker {
  font: var(--type-mono-meta);
  letter-spacing: var(--tracking-wide);
  color: var(--orange);
}

.deck__title {
  margin-top: 6px;
  font: var(--type-title);
}

.deck__status,
.deck__error {
  margin: 10px 0 0;
  font: var(--type-small);
}

.deck__status {
  color: var(--on-night-2);
}

.deck__error {
  color: var(--orange);
}

.deck__play {
  display: flex;
  justify-content: center;
  margin: 22px 0 6px;
}

.deck__btn {
  min-width: 72px;
  height: 72px;
  padding: 0 24px;
  font-size: 16px;
}

.done {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100dvh;
  padding: 24px;
  background: var(--moss);
}

.done__inner {
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 100%;
  animation: pn-in 0.5s var(--ease-spring) both;
}

.done__title {
  margin: 0;
  font: var(--type-celebrate);
  color: var(--ink);
  transform: rotate(-5deg);
}

.done__text {
  max-width: 260px;
  margin: 18px 0 0;
  font: 500 17px/1.45 var(--font-body);
  text-align: center;
}

.done__actions {
  display: flex;
  flex-direction: column;
  gap: 10px;
  width: 100%;
  max-width: 300px;
  margin-top: 28px;
}

.done__main {
  height: 56px;
}
</style>
