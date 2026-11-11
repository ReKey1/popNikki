<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, useTemplateRef } from 'vue'
import { useRouter } from 'vue-router'

import BaseButton from '@/components/BaseButton.vue'
import BaseIconButton from '@/components/BaseIconButton.vue'
import TimerRing from '@/components/TimerRing.vue'
import { usePageColor } from '@/composables/usePageColor'
import { useRoulette } from '@/composables/useRoulette'
import { errorMessage, type Roll, type StartResult, type Track } from '@/lib/api'
import { leaveStep } from '@/lib/navigation'
import { useGardenStore } from '@/stores/garden'
import { usePendingPostStore } from '@/stores/pendingPost'
import { useSessionStore } from '@/stores/session'

/** Without an id, the post is still uploading in the background (see NewPostView). */
const props = defineProps<{ id?: string }>()
const router = useRouter()
const pending = usePendingPostStore()
const garden = useGardenStore()
const session = useSessionStore()
const {
  spinning,
  revealing,
  clock: spinClock,
  title: spinTitle,
  spin: spinRoulette,
  reveal: revealSong,
} = useRoulette()

/** Seconds the music takes to fade in, and to fade out so it's silent when the timer ends. */
const FADE_IN = 1.5
const FADE_OUT = 3

const phase = ref<'ready' | 'starting' | 'running' | 'paused' | 'publishing' | 'done'>('ready')
/** What the roulette landed on: how long to dance, and to which song. Null until it has. */
const roll = ref<Roll | null>(null)
/** The playlist is empty: there is nothing to roll, and START posts at once. */
const noMusic = ref(false)
/** Seconds left. This clock only drives the display. The server checks the real time. */
const remaining = ref(0)
const error = ref('')
/** The draft being danced out; null until its upload finishes. */
const postId = ref(props.id ? Number(props.id) : null)
const uploadFailed = ref(false)
const audio = useTemplateRef<HTMLAudioElement>('audio')

let timer: ReturnType<typeof setInterval> | undefined
let lastTick = 0
let wakeLock: WakeLockSentinel | null = null
let retried = false
let mixer: { ctx: AudioContext; gain: AudioParam } | null = null
let fadingOut = false
let loadingTrack: number | null = null

/**
 * Routes the music through a gain node: iPhone Safari ignores `audio.volume`, so this is the
 * only way to fade there. Call it from the tap, since browsers only start audio on a gesture.
 */
function connectMixer() {
  if (mixer || !audio.value || typeof AudioContext === 'undefined') return
  // Web Audio obeys the iPhone silent switch unless the session is marked as playback.
  const session = (navigator as Navigator & { audioSession?: { type: string } }).audioSession
  if (session) session.type = 'playback'
  const ctx = new AudioContext()
  const node = ctx.createGain()
  ctx.createMediaElementSource(audio.value).connect(node).connect(ctx.destination)
  mixer = { ctx, gain: node.gain }
}

/** Ramps the music's volume from `from` (default: where it is now) to `volume` over `seconds`. */
function fadeTo(volume: number, seconds: number, from = mixer?.gain.value ?? 1) {
  if (!mixer) return
  const now = mixer.ctx.currentTime
  mixer.gain.cancelScheduledValues(now)
  mixer.gain.setValueAtTime(from, now)
  mixer.gain.linearRampToValueAtTime(volume, now + seconds)
}

function tick() {
  const now = Date.now()
  remaining.value = Math.max(0, remaining.value - (now - lastTick) / 1000)
  lastTick = now
  if (remaining.value === 0) void finish()
  else if (remaining.value <= FADE_OUT && !fadingOut) {
    fadingOut = true
    fadeTo(0, remaining.value)
  }
}

async function run() {
  phase.value = 'running'
  lastTick = Date.now()
  clearInterval(timer)
  timer = setInterval(tick, 250)
  if (mixer) {
    void mixer.ctx.resume()
    fadingOut = false
    fadeTo(1, FADE_IN, 0)
  }
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

/** Waits for the background upload, then gives the page the post's own address. */
async function waitForUpload(upload: Promise<number> | null) {
  // Opened without an upload, e.g. after a reload: any finished upload is in the drafts.
  if (!upload) return leaveStep(router, '/me')
  uploadFailed.value = false
  error.value = ''
  try {
    postId.value = await upload
    pending.clear()
    await router.replace(`/practice/${postId.value}`)
  } catch (err) {
    uploadFailed.value = true
    error.value = err instanceof Error ? err.message : String(err)
  }
}

/** Starts downloading a song, so it is ready to play by the time of the tap on START. */
function preload(track: Track) {
  if (!audio.value || loadingTrack === track.id) return
  loadingTrack = track.id
  audio.value.src = `/api/tracks/${track.id}/audio`
}

/** Takes a roll as the dance to do. */
function land(next: Roll) {
  roll.value = next
  remaining.value = next.seconds
  preload(next.track)
}

async function requestRoll(): Promise<Roll | null> {
  const res = await fetch('/api/roll', { method: 'POST' })
  if (!res.ok) throw new Error(await errorMessage(res))
  const { roll: next } = (await res.json()) as { roll: Roll | null }
  // The song loads while the roulette is still turning.
  if (next) preload(next.track)
  return next
}

/**
 * Spins the roulette. The page spins every time it opens, even for a draft that was spun
 * before: the server rolls once and remembers, so the spin lands on the same result.
 */
async function spin() {
  error.value = ''
  try {
    const next = await spinRoulette(requestRoll())
    if (!next) {
      noMusic.value = true
      return
    }
    land(next)
    // The time lands first. The song rolls after it, unless there is no dance to play it for.
    if (next.seconds) await revealSong(next.track.title)
  } catch (err) {
    error.value = err instanceof Error ? err.message : String(err)
  }
}

async function start() {
  connectMixer()
  phase.value = 'starting'
  error.value = ''
  const res = await fetch(`/api/posts/${postId.value}/start`, { method: 'POST' })
  if (!res.ok) {
    error.value = await errorMessage(res)
    phase.value = 'ready'
    return
  }
  const result: StartResult = await res.json()
  // A roll of zero seconds, or an empty playlist: the server published straight away.
  if ('published' in result) {
    remaining.value = 0
    posted()
    return
  }
  // The server's roll is the one that counts.
  land(result)
  await run()
}

function toggle() {
  if (uploadFailed.value) void waitForUpload(pending.again())
  else if (waiting.value) void spin()
  else if (phase.value === 'ready' && postId.value !== null) void start()
  else if (phase.value === 'running') pause()
  else if (phase.value === 'paused') void run()
}

async function finish() {
  clearInterval(timer)
  phase.value = 'publishing'
  // The fade has already brought the volume down to nothing.
  audio.value?.pause()
  void wakeLock?.release()
  wakeLock = null
  await publish()
}

async function publish() {
  const res = await fetch(`/api/posts/${postId.value}/publish`, { method: 'POST' })
  if (res.ok) {
    posted()
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

/** Shows the celebration, and brings the garden up to date before the member gets there. */
function posted() {
  phase.value = 'done'
  if (garden.drafts) garden.drafts = garden.drafts.filter((d) => d.id !== postId.value)
  void garden.loadPlants().catch(() => {})
  if (session.me) void garden.loadPosts(session.me.id).catch(() => {})
}

// Leaving the page pauses the music and the timer.
function onVisibility() {
  if (document.visibilityState === 'hidden') pause()
}
onMounted(() => {
  document.addEventListener('visibilitychange', onVisibility)
  if (postId.value === null) void waitForUpload(pending.upload)
})
onBeforeUnmount(() => {
  document.removeEventListener('visibilitychange', onVisibility)
  clearInterval(timer)
  audio.value?.pause()
  void mixer?.ctx.close()
  void wakeLock?.release()
})

usePageColor(() => (phase.value === 'done' ? 'moss' : 'night'))

const uploading = computed(() => postId.value === null && !uploadFailed.value)
/** The roulette is still to be spun. */
const waiting = computed(() => !roll.value && !noMusic.value)
const preparing = computed(() => phase.value === 'ready' || phase.value === 'starting')

const ring = computed(() => {
  if (spinning.value) return 'spinning'
  if (waiting.value) return 'idle'
  return roll.value && preparing.value ? 'landed' : undefined
})
const ringDisplay = computed(() => {
  if (spinning.value) return spinClock.value || '?:??'
  return waiting.value ? '?:??' : undefined
})
// Until the roulette lands, the dial and the song say nothing.
const ringCaption = computed(() => (spinning.value || waiting.value ? '' : undefined))
const kicker = computed(() => {
  if (spinning.value || waiting.value) return 'ROULETTE'
  if (!roll.value) return 'READY?'
  if (!roll.value.seconds) return ''
  return preparing.value ? 'UP NEXT' : 'NOW PLAYING'
})
const title = computed(() => {
  if (revealing.value) return spinTitle.value || '???'
  if (waiting.value) return '???'
  if (!roll.value) return 'Press start and dance'
  return roll.value.seconds ? roll.value.track.title : ''
})
const buttonLabel = computed(() => {
  if (uploadFailed.value) return 'RETRY'
  if (spinning.value || waiting.value) return 'SPIN'
  if (uploading.value) return 'UPLOADING…'
  if (phase.value === 'running') return 'PAUSE'
  if (phase.value === 'paused') return 'RESUME'
  return roll.value?.seconds === 0 ? 'POST' : 'START'
})
const buttonDisabled = computed(
  () =>
    spinning.value ||
    revealing.value ||
    (uploading.value && !waiting.value) ||
    phase.value === 'starting' ||
    phase.value === 'publishing',
)
</script>

<template>
  <main v-if="phase === 'done'" class="done">
    <div class="done__inner">
      <h1 class="done__title">POSTED</h1>
      <p class="done__text">Plant watered. Your nikki is live in the garden.</p>
      <div class="done__actions">
        <BaseButton variant="dark" size="md" class="done__main" @click="leaveStep(router, '/')">
          SEE THE GARDEN
          <template #trailing>→</template>
        </BaseButton>
        <BaseButton variant="secondary" size="sm" @click="leaveStep(router, '/me')"
          >My garden</BaseButton
        >
      </div>
    </div>
  </main>

  <main v-else class="practice">
    <header class="head">
      <!-- Leaving never keeps the timer in the history, so Back can't return to it. -->
      <BaseIconButton tone="night" label="Quit" @click="leaveStep(router, '/me')">✕</BaseIconButton>
      <h1 class="head__title mono-label">PRACTICE</h1>
      <span class="head__spacer"></span>
    </header>

    <div class="stage">
      <TimerRing
        :remaining="remaining"
        :total="roll?.seconds"
        :running="phase === 'running'"
        :display="ringDisplay"
        :caption="ringCaption"
        :roulette="ring"
      />
      <span class="stage__note mono-label">QUIT = SAVED TO DRAFTS</span>
    </div>

    <div class="deck">
      <div class="deck__kicker mono-label">{{ kicker }}</div>
      <div
        :class="[
          'deck__title',
          {
            'deck__title--spin': waiting || revealing,
            'deck__title--landed': ring === 'landed' && !revealing,
          },
        ]"
        aria-live="polite"
      >
        {{ title }}
      </div>
      <!-- Always there, so nothing below it moves when the line comes and goes. -->
      <p class="deck__note mono-label" aria-live="polite">
        {{ phase === 'publishing' && !error ? 'Posting…' : '' }}
      </p>
      <p v-if="error" class="deck__error" role="alert">{{ error }}</p>
      <div class="deck__play">
        <BaseButton
          variant="accent"
          :full-width="false"
          :disabled="buttonDisabled"
          class="deck__btn"
          @click="toggle"
          >{{ buttonLabel }}</BaseButton
        >
      </div>
    </div>

    <!-- Its src is set as soon as the roulette picks the song, so it loads before START. -->
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
  min-height: 13px;
  font: var(--type-mono-meta);
  letter-spacing: var(--tracking-wide);
  color: var(--orange);
}

.deck__title {
  /* Room for one line, so the button stays put while the roulette turns. */
  min-height: 30px;
  margin-top: 6px;
  font: var(--type-title);
  overflow-wrap: anywhere;
}

/* The hidden song title keeps a steady width while it flickers. */
.deck__title--spin {
  font-family: var(--font-mono);
  color: var(--on-night-3);
}

.deck__title--landed {
  animation: pn-in 0.5s var(--ease-spring) both;
}

.deck__note {
  min-height: 14px;
  margin: 10px 0 0;
  font: var(--type-mono-meta);
  letter-spacing: var(--tracking-label);
  color: var(--on-night-2);
}

.deck__error {
  margin: 10px 0 0;
  font: var(--type-small);
  color: var(--orange);
}

.deck__play {
  display: flex;
  justify-content: center;
  margin: 22px 0 6px;
}

.deck__btn {
  /* Wide enough for most labels, so the button keeps its size as they change. */
  min-width: 132px;
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
}

/* The word lands first, then the rest follows it in. */
.done__text,
.done__actions {
  animation: pn-rise 0.32s var(--ease-out) 0.18s backwards;
}

.done__actions {
  animation-delay: 0.26s;
}

.done__title {
  margin: 0;
  font: var(--type-celebrate);
  color: var(--ink);
  rotate: -5deg;
  animation: pn-in 0.5s var(--ease-spring) both;
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
