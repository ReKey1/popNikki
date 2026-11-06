<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRouter } from 'vue-router'

import BaseAvatar from '@/components/BaseAvatar.vue'
import BaseIconButton from '@/components/BaseIconButton.vue'
import BasePhoto from '@/components/BasePhoto.vue'
import BasePill from '@/components/BasePill.vue'
import BaseSectionRule from '@/components/BaseSectionRule.vue'
import BaseSheet from '@/components/BaseSheet.vue'
import HistoryRow from '@/components/HistoryRow.vue'
import ReactionBar from '@/components/ReactionBar.vue'
import { usePolling } from '@/composables/usePolling'
import { errorMessage, fetchReactors, type Post, type Reactor } from '@/lib/api'
import { dayNumber, formatShortDate, formatStamp } from '@/lib/format'
import { goBack } from '@/lib/navigation'
import { preloadImages } from '@/lib/preload'
import { reactionSummary } from '@/lib/reactions'
import { useGardenStore } from '@/stores/garden'

const props = defineProps<{ id: string; postId?: string }>()
const router = useRouter()
const garden = useGardenStore()

/** This plant's nikki: drawn at once when the garden fetched them ahead, then refreshed. */
const data = computed(() => garden.posts[Number(props.id)] ?? null)
const error = ref('')

const newest = computed(() => data.value?.posts[0])
/** The post shown large: the one in the URL, or else the newest. */
const featured = computed(
  () => data.value?.posts.find((p) => String(p.id) === props.postId) ?? newest.value,
)
const firstAt = computed(() => data.value?.posts[data.value.posts.length - 1]?.published_at)
const day = (at: number) => dayNumber(firstAt.value ?? at, at)
const counts = (post: Post) => Object.entries(post.reactions).sort((a, b) => b[1] - a[1])

/** The newest post id the viewer was last marked as having seen; undefined before the first. */
let seenNewest: number | null | undefined

async function load(id: string, initial: boolean) {
  const res = await garden.loadPosts(Number(id))
  if (id !== props.id) return
  if (!res.ok) {
    // A failed refresh keeps what is on screen.
    if (initial) error.value = await errorMessage(res)
    return
  }

  // Opening the plant clears its update badge, and so does a post arriving while you look.
  const newestId = data.value?.posts[0]?.id ?? null
  if (newestId !== seenNewest) {
    seenNewest = newestId
    await garden.markSeen(Number(id))
  }
}

watch(
  () => props.id,
  (id) => {
    error.value = ''
    seenNewest = undefined
    return load(id, true)
  },
  { immediate: true },
)
usePolling(() => data.value && load(props.id, false))

// The full-size photos of the other nikki download in the background, so tapping one shows it at once.
watch(
  () => data.value?.posts,
  (posts) => posts && preloadImages(posts.map((p) => `/api/posts/${p.id}/photo`)),
  { immediate: true },
)

async function react(post: Post, emoji: string | null) {
  const res = await garden.react(post, emoji)
  if (!res.ok) error.value = await errorMessage(res)
}

// Tapping the counts shows who reacted.
const reactorsOpen = ref(false)
const reactors = ref<Reactor[]>([])

async function showReactors() {
  const post = featured.value
  if (!post) return
  const res = await fetchReactors(post.id)
  if (!res.ok) {
    error.value = await errorMessage(res)
    return
  }
  reactors.value = await res.json()
  reactorsOpen.value = true
}
</script>

<template>
  <p v-if="error && !data" class="status" role="alert">{{ error }}</p>
  <template v-else-if="data">
    <header class="head">
      <BaseIconButton label="Back" @click="goBack(router)">←</BaseIconButton>
      <BaseAvatar :name="data.owner.username" />
      <div class="head__text">
        <h1 class="head__name">{{ data.owner.username }}</h1>
        <div class="head__meta">
          <template v-if="newest">DAY {{ day(Date.now()) }} · </template
          >{{ data.posts.length }} NIKKI
        </div>
      </div>
    </header>

    <main>
      <p v-if="!featured" class="status">No nikki yet.</p>
      <article v-else class="featured">
        <BasePhoto
          :src="`/api/posts/${featured.id}/photo`"
          :alt="featured.description || `${data.owner.username}'s plant`"
          :radius="22"
          stripe="lg"
          loading="eager"
          class="featured__photo"
        >
          <ReactionBar
            :selected="featured.my_reaction"
            class="featured__bar"
            @pick="react(featured, $event)"
          />
        </BasePhoto>
        <p v-if="error" class="featured__error" role="alert">{{ error }}</p>
        <button
          v-if="counts(featured).length"
          type="button"
          class="featured__counts"
          aria-label="See who reacted"
          @click="showReactors"
        >
          <BasePill
            v-for="[emoji, n] in counts(featured)"
            :key="emoji"
            tone="count"
            :selected="emoji === featured.my_reaction"
            >{{ emoji }} {{ n }}</BasePill
          >
        </button>
        <div class="featured__meta">
          <span class="mono-label">{{ formatStamp(featured.published_at) }}</span>
          <!-- Saves the stored photo, the largest size there is. -->
          <a
            :href="`/api/posts/${featured.id}/photo`"
            :download="`${data.owner.username}-day-${day(featured.published_at)}.jpg`"
            class="featured__download mono-label"
            >DOWNLOAD ↓</a
          >
        </div>
        <p v-if="featured.description" class="featured__text">{{ featured.description }}</p>
      </article>

      <template v-if="data.posts.length">
        <BaseSectionRule class="rule">ALL NIKKI</BaseSectionRule>
        <div class="history">
          <HistoryRow
            v-for="post in data.posts"
            :key="post.id"
            :current="post === featured"
            :to="{ path: `/plants/${data.owner.id}/${post.id}`, replace: true }"
            :day="day(post.published_at)"
            :date="formatShortDate(post.published_at)"
            :text="post.description"
            :src="`/api/posts/${post.id}/thumb`"
            :meta="reactionSummary(post.reactions)"
          />
        </div>
      </template>
      <p v-if="featured" class="seed">· DAY 1 — SEED PLANTED ·</p>

      <BaseSheet v-model:open="reactorsOpen" title="Reactions" draggable>
        <ul class="reactors">
          <li v-for="r in reactors" :key="r.username" class="reactors__row">
            <BaseAvatar :name="r.username" :size="36" />
            <span class="reactors__name">{{ r.username }}</span>
            <span class="reactors__emoji">{{ r.emoji }}</span>
          </li>
        </ul>
      </BaseSheet>
    </main>
  </template>
</template>

<style scoped>
.status {
  padding: 40px 20px;
  font: var(--type-body);
  color: var(--ink-4);
  text-align: center;
}

.head {
  position: sticky;
  top: 0;
  z-index: 2;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 16px;
  background: var(--paper);
}

.head__text {
  flex: 1;
  min-width: 0;
}

.head__name {
  margin: 0;
  font: 600 16px var(--font-body);
}

.head__meta {
  font: var(--type-mono-note);
  letter-spacing: var(--tracking-tight);
  color: var(--moss);
}

.featured {
  padding: 4px 16px 0;
}

.featured__photo {
  overflow: visible;
}

.featured__bar {
  position: absolute;
  right: 12px;
  bottom: -26px;
  left: 12px;
}

.featured__error {
  margin: 36px 0 0;
  font: var(--type-small);
  color: var(--orange-deep);
}

.featured__counts {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 40px;
  padding: 0;
  border: none;
  background: none;
  color: inherit;
  text-align: start;
  cursor: pointer;
}

.featured__meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-top: 20px;
  letter-spacing: 0.08em;
  color: var(--ink-4);
}

.featured__photo + .featured__meta {
  margin-top: 48px;
}

.featured__download {
  /* A taller hit area without moving the row. */
  margin: -12px 0;
  padding: 12px 0;
  color: var(--moss);
  text-decoration: none;
}

.featured__text {
  margin: 8px 0 0;
  /* Descriptions are the one thing in the app you can select and copy. */
  -webkit-touch-callout: default;
  -webkit-user-select: text;
  user-select: text;
  font: var(--type-post);
  text-wrap: pretty;
  white-space: pre-line;
}

.rule {
  margin: 36px 16px 0;
}

.history {
  padding: 16px 16px 0;
}

.seed {
  margin: 24px 0 0;
  padding-bottom: 40px;
  font: var(--type-mono-meta);
  letter-spacing: var(--tracking-wide);
  color: var(--ink-5);
  text-align: center;
}

.reactors {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.reactors__row {
  display: flex;
  align-items: center;
  gap: 12px;
}

.reactors__name {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  font: 600 15px var(--font-body);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.reactors__emoji {
  font: 22px sans-serif;
}
</style>
