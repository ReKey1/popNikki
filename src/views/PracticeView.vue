<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, useTemplateRef } from 'vue'
import { useRouter } from 'vue-router'

import BaseButton from '@/components/BaseButton.vue'
import BaseIconButton from '@/components/BaseIconButton.vue'
import TimerRing from '@/components/TimerRing.vue'
import { errorMessage, type StartResult, type Track } from '@/lib/api'
import { leaveStep } from '@/lib/navigation'
import { usePendingPostStore } from '@/stores/pendingPost'

/** Without an id, the post is still uploading in the background (see NewPostView). */
const props = defineProps<{ id?: string }>()
const router = useRouter()
const pending = usePendingPostStore()

/** The client clock only drives the display. The server checks the real two minutes. */
const TOTAL = 120
/** Seconds the music takes to fade in, and to fade out so it's silent when the timer ends. */
const FADE_IN = 1.5
const FADE_OUT = 3

const phase = ref<'ready' | 'starting' | 'running' | 'paused' | 'publishing' | 'done'>('ready')
const remaining = ref(TOTAL)
const track = ref<Track | null>(null)
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

function setTrack(next: Track) {
  track.value = next
  if (audio.value) audio.value.src = `/api/tracks/${next.id}/audio`
}

/** Picks the song as the page opens, so it loads while the dancer gets ready. */
async function loadTrack() {
  const res = await fetch('/api/tracks/next')
  // On failure START picks the song instead.
  if (!res.ok) return
  const { track: next } = (await res.json()) as { track: Track | null }
  if (next && phase.value === 'ready') setTrack(next)
}

async function start() {
  connectMixer()
  phase.value = 'starting'
  error.value = ''
  const res = await fetch(`/api/posts/${postId.value}/start`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ track_id: track.value?.id }),
  })
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
  // The server may pick another song, if the loaded one has left the playlist.
  if (result.track.id !== track.value?.id) setTrack(result.track)
  await run()
}

function toggle() {
  if (uploadFailed.value) void waitForUpload(pending.again())
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
onMounted(() => {
  document.addEventListener('visibilitychange', onVisibility)
  void loadTrack().catch(() => {})
  if (postId.value === null) void waitForUpload(pending.upload)
})
onBeforeUnmount(() => {
  document.removeEventListener('visibilitychange', onVisibility)
  clearInterval(timer)
  audio.value?.pause()
  void mixer?.ctx.close()
  void wakeLock?.release()
})

const uploading = computed(() => postId.value === null && !uploadFailed.value)
const buttonLabel = computed(() => {
  if (uploadFailed.value) return 'RETRY'
  if (uploading.value) return 'UPLOADING…'
  return phase.value === 'running' ? 'PAUSE' : phase.value === 'paused' ? 'RESUME' : 'START'
})
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
      <TimerRing :remaining="remaining" :running="phase === 'running'" />
      <span class="stage__note mono-label">QUIT = SAVED TO DRAFTS</span>
    </div>

    <div class="deck">
      <div class="deck__kicker mono-label">
        {{
          !track ? 'READY?' : phase === 'ready' || phase === 'starting' ? 'UP NEXT' : 'NOW PLAYING'
        }}
      </div>
      <div class="deck__title">{{ track?.title ?? 'Press start and dance' }}</div>
      <p v-if="phase === 'publishing' && !error" class="deck__status" aria-live="polite">
        Posting…
      </p>
      <p v-if="error" class="deck__error" role="alert">{{ error }}</p>
      <div class="deck__play">
        <BaseButton
          variant="accent"
          :full-width="false"
          :disabled="uploading || phase === 'starting' || phase === 'publishing'"
          class="deck__btn"
          @click="toggle"
          >{{ buttonLabel }}</BaseButton
        >
      </div>
    </div>

    <!-- Its src is set as soon as the server picks the track, so it loads before START. -->
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
