<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { computed, ref, watch } from 'vue'
import { RouterLink, useRouter } from 'vue-router'

import BaseAvatar from '@/components/BaseAvatar.vue'
import BaseButton from '@/components/BaseButton.vue'
import BaseIconButton from '@/components/BaseIconButton.vue'
import BasePhoto from '@/components/BasePhoto.vue'
import BasePill from '@/components/BasePill.vue'
import HistoryRow from '@/components/HistoryRow.vue'
import SettingsSheet from '@/components/SettingsSheet.vue'
import { errorMessage, type Draft } from '@/lib/api'
import { dayNumber, formatShortDate } from '@/lib/format'
import { goBack } from '@/lib/navigation'
import { useGardenStore } from '@/stores/garden'
import { useSessionStore } from '@/stores/session'

const router = useRouter()
const session = useSessionStore()
const garden = useGardenStore()
// The router only opens this page for a logged-in viewer.
const { me } = storeToRefs(session)

// What the last visit saw shows at once, while the refresh below runs.
const posts = computed(() => (me.value && garden.posts[me.value.id]?.posts) || [])
const drafts = computed(() => garden.drafts ?? [])
const tab = ref<'posted' | 'drafts'>('posted')
const settingsOpen = ref(false)
const error = ref('')

const firstAt = computed(() => posts.value[posts.value.length - 1]?.published_at)
const day = (at: number) => dayNumber(firstAt.value ?? at, at)

void session.load()
watch(
  () => me.value?.id,
  (id) => id && Promise.all([garden.loadPosts(id), garden.loadDrafts()]),
  { immediate: true },
)

/** Takes the draft off the list at once, and puts it back if the server says no. */
async function remove(draft: Draft) {
  if (!window.confirm('Delete this draft?')) return
  const before = drafts.value
  error.value = ''
  garden.drafts = before.filter((d) => d.id !== draft.id)
  const res = await fetch(`/api/posts/${draft.id}`, { method: 'DELETE' }).catch(() => null)
  if (res?.ok) return
  garden.drafts = before
  error.value = res ? await errorMessage(res) : 'Could not delete the draft'
}

async function loggedOut() {
  session.reset()
  garden.clear()
  await router.push('/')
}
</script>

<template>
  <template v-if="me">
    <header class="head">
      <BaseIconButton label="Back" @click="goBack(router)">←</BaseIconButton>
      <h1 class="head__title mono-label">MY GARDEN</h1>
      <BaseIconButton tone="outline" label="Settings" @click="settingsOpen = true"
        >⚙</BaseIconButton
      >
    </header>

    <main>
      <section class="hero">
        <span class="hero__ring" aria-hidden="true"></span>
        <BaseAvatar :name="me.username" tone="orange" :size="112" class="hero__avatar" />
        <h2 class="hero__name">{{ me.username }}</h2>
        <div class="hero__pills">
          <BasePill v-if="firstAt">DAY {{ dayNumber(firstAt) }}</BasePill>
          <BasePill>{{ posts.length }} NIKKI</BasePill>
        </div>
      </section>

      <div class="cta">
        <div class="cta__text">
          <div class="cta__title">PRACTICED TODAY?</div>
          <div class="cta__sub">Then water her and drop a nikki.</div>
        </div>
        <BaseButton variant="accent" size="sm" :full-width="false" to="/new" class="cta__btn"
          >+ POST</BaseButton
        >
      </div>

      <div class="tabs">
        <button
          type="button"
          :class="['tab', { 'tab--on': tab === 'posted' }]"
          :aria-pressed="tab === 'posted'"
          @click="tab = 'posted'"
        >
          POSTED · {{ posts.length }}
        </button>
        <button
          type="button"
          :class="['tab', { 'tab--on': tab === 'drafts' }]"
          :aria-pressed="tab === 'drafts'"
          @click="tab = 'drafts'"
        >
          DRAFTS · {{ drafts.length }}
        </button>
      </div>

      <p v-if="error" class="error" role="alert">{{ error }}</p>

      <template v-if="tab === 'posted'">
        <ul v-if="posts.length" class="grid pn-stagger">
          <li v-for="(post, i) in posts" :key="post.id" :style="{ '--i': i }">
            <RouterLink :to="`/plants/${me.id}/${post.id}`" class="grid__link">
              <BasePhoto
                :src="`/api/posts/${post.id}/thumb`"
                :alt="post.description || `Day ${day(post.published_at)}`"
                ratio="1/1"
                :radius="10"
                stripe="sm"
              >
                <span class="grid__day">DAY {{ day(post.published_at) }}</span>
              </BasePhoto>
            </RouterLink>
          </li>
        </ul>
        <p v-else-if="me && garden.posts[me.id]" class="empty">No nikki yet.</p>
      </template>

      <template v-else>
        <p v-if="garden.drafts && !drafts.length" class="empty">
          No drafts. Quitting a practice saves one here.
        </p>
        <div v-else-if="drafts.length" class="drafts pn-stagger">
          <HistoryRow
            v-for="(draft, i) in drafts"
            :key="draft.id"
            :style="{ '--i': i }"
            card
            :day="day(draft.created_at)"
            :date="`SAVED ${formatShortDate(draft.created_at)}`"
            :text="draft.description"
            :src="`/api/posts/${draft.id}/thumb`"
          >
            <template #actions>
              <BaseButton variant="accent" size="sm" :to="`/practice/${draft.id}`"
                >▶ PRACTICE</BaseButton
              >
              <BaseButton variant="quiet" size="sm" :full-width="false" @click="remove(draft)"
                >Delete</BaseButton
              >
            </template>
          </HistoryRow>
        </div>
      </template>
    </main>

    <SettingsSheet
      v-model:open="settingsOpen"
      :username="me.username"
      @renamed="me = $event"
      @logged-out="loggedOut"
    />
  </template>
</template>

<style scoped>
.head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 16px;
}

.head__title {
  margin: 0;
  color: var(--ink-3);
}

.hero {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 20px 20px 0;
}

.hero__ring {
  position: absolute;
  top: 0;
  width: min(200px, 55vw);
  aspect-ratio: 1;
  border: 1.5px solid var(--moss-ring);
  border-radius: 50%;
}

.hero__avatar {
  position: relative;
  margin-top: 22px;
}

.hero__name {
  position: relative;
  margin: 22px 0 0;
  font: var(--type-name-xl);
  overflow-wrap: anywhere;
  text-align: center;
}

.hero__pills {
  display: flex;
  gap: 8px;
  margin-top: 12px;
}

.cta {
  display: flex;
  align-items: center;
  gap: 14px;
  margin: 24px 16px 0;
  padding: 18px;
  border-radius: 20px;
  background: var(--ink);
  color: var(--paper);
}

.cta__text {
  flex: 1;
}

.cta__title {
  font: var(--type-sign-md);
}

.cta__sub {
  margin-top: 4px;
  font: var(--type-small);
  color: var(--on-night-2);
}

.cta__btn {
  height: 48px;
}

.tabs {
  display: flex;
  gap: 8px;
  padding: 24px 16px 0;
}

.tab {
  flex: 1;
  height: 44px;
  border: var(--border-input);
  border-radius: var(--radius-pill);
  background: transparent;
  color: var(--ink);
  font: 600 12px var(--font-mono);
  letter-spacing: 0.08em;
  cursor: pointer;
  transition:
    background-color var(--dur-press),
    color var(--dur-press),
    transform var(--dur-press);
}

.tab:active {
  transform: scale(0.97);
}

.tab--on {
  background: var(--ink);
  color: var(--paper);
}

.grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 6px;
  margin: 0;
  padding: 12px 16px 40px;
  list-style: none;
}

.grid__link {
  display: block;
  text-decoration: none;
  transition: transform var(--dur-press);
}

.grid__link:active {
  transform: scale(0.96);
}

.grid__day {
  position: absolute;
  left: 6px;
  bottom: 6px;
  padding: 2px 5px;
  border-radius: 6px;
  background: var(--paper);
  font: 600 9px var(--font-mono);
  color: var(--moss);
}

.drafts {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 12px 16px 40px;
}

.empty {
  padding: 32px 20px;
  margin: 0;
  font: var(--type-body);
  color: var(--ink-4);
  text-align: center;
}

.error {
  margin: 12px 16px 0;
  font: var(--type-small);
  color: var(--orange-deep);
}
</style>
