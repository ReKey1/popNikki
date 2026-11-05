<script setup lang="ts">
import { computed, ref, watch } from 'vue'

import BaseAvatar from '@/components/BaseAvatar.vue'
import BaseIconButton from '@/components/BaseIconButton.vue'
import BasePhoto from '@/components/BasePhoto.vue'
import BasePill from '@/components/BasePill.vue'
import BaseSectionRule from '@/components/BaseSectionRule.vue'
import HistoryRow from '@/components/HistoryRow.vue'
import ReactionBar from '@/components/ReactionBar.vue'
import { errorMessage, setReaction, type PlantPosts, type Post } from '@/lib/api'
import { dayNumber, formatShortDate, formatStamp } from '@/lib/format'
import { reactionSummary } from '@/lib/reactions'

const props = defineProps<{ id: string }>()

const data = ref<PlantPosts | null>(null)
const error = ref('')

const latest = computed(() => data.value?.posts[0])
const previous = computed(() => data.value?.posts.slice(1) ?? [])
const firstAt = computed(() => data.value?.posts[data.value.posts.length - 1]?.published_at)
const day = (at: number) => dayNumber(firstAt.value ?? at, at)
const counts = (post: Post) => Object.entries(post.reactions).sort((a, b) => b[1] - a[1])

watch(
  () => props.id,
  async (id) => {
    error.value = ''
    const res = await fetch(`/api/users/${id}/posts`)
    if (!res.ok) {
      error.value = await errorMessage(res)
      return
    }
    data.value = await res.json()
    // Opening the plant clears its update badge.
    await fetch(`/api/users/${id}/seen`, { method: 'POST' })
  },
  { immediate: true },
)

/** Moves the viewer's reaction on `post` to `emoji` (or removes it) in the local counts. */
function applyReaction(post: Post, emoji: string | null) {
  const old = post.my_reaction
  if (old) {
    post.reactions[old] = (post.reactions[old] ?? 1) - 1
    if (!post.reactions[old]) delete post.reactions[old]
  }
  if (emoji) post.reactions[emoji] = (post.reactions[emoji] ?? 0) + 1
  post.my_reaction = emoji
}

// Updates at once, and rolls back if the server says no.
async function react(post: Post, emoji: string | null) {
  const old = post.my_reaction
  applyReaction(post, emoji)
  const res = await setReaction(post.id, emoji)
  if (!res.ok) {
    applyReaction(post, old)
    error.value = await errorMessage(res)
  }
}
</script>

<template>
  <p v-if="error && !data" class="status" role="alert">{{ error }}</p>
  <template v-else-if="data">
    <header class="head">
      <BaseIconButton label="Back" to="/">←</BaseIconButton>
      <BaseAvatar :name="data.owner.username" />
      <div class="head__text">
        <h1 class="head__name">{{ data.owner.username }}</h1>
        <div class="head__meta">
          <template v-if="latest">DAY {{ day(Date.now()) }} · </template
          >{{ data.posts.length }} NIKKI
        </div>
      </div>
    </header>

    <main>
      <p v-if="!latest" class="status">No nikki yet.</p>
      <article v-else class="latest">
        <BasePhoto
          :src="`/api/posts/${latest.id}/photo`"
          :alt="latest.description || `${data.owner.username}'s plant`"
          :radius="22"
          stripe="lg"
          class="latest__photo"
        >
          <ReactionBar
            :selected="latest.my_reaction"
            class="latest__bar"
            @pick="react(latest, $event)"
          />
        </BasePhoto>
        <p v-if="error" class="latest__error" role="alert">{{ error }}</p>
        <div v-if="counts(latest).length" class="latest__counts">
          <BasePill
            v-for="[emoji, n] in counts(latest)"
            :key="emoji"
            tone="count"
            :selected="emoji === latest.my_reaction"
            >{{ emoji }} {{ n }}</BasePill
          >
        </div>
        <div class="latest__stamp mono-label">{{ formatStamp(latest.published_at) }}</div>
        <p v-if="latest.description" class="latest__text">{{ latest.description }}</p>
      </article>

      <template v-if="previous.length">
        <BaseSectionRule class="rule">PREVIOUS NIKKI</BaseSectionRule>
        <div class="history">
          <HistoryRow
            v-for="post in previous"
            :key="post.id"
            :day="day(post.published_at)"
            :date="formatShortDate(post.published_at)"
            :text="post.description"
            :src="`/api/posts/${post.id}/thumb`"
            :meta="reactionSummary(post.reactions)"
          />
        </div>
      </template>
      <p v-if="latest" class="seed">· DAY 1 — SEED PLANTED ·</p>
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

.latest {
  padding: 4px 16px 0;
}

.latest__photo {
  overflow: visible;
}

.latest__bar {
  position: absolute;
  right: 12px;
  bottom: -26px;
  left: 12px;
}

.latest__error {
  margin: 36px 0 0;
  font: var(--type-small);
  color: var(--orange-deep);
}

.latest__counts {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 40px;
}

.latest__stamp {
  margin-top: 20px;
  letter-spacing: 0.08em;
  color: var(--ink-4);
}

.latest__counts + .latest__stamp,
.latest__error + .latest__stamp {
  margin-top: 20px;
}

.latest__photo + .latest__stamp {
  margin-top: 48px;
}

.latest__text {
  margin: 8px 0 0;
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
</style>
