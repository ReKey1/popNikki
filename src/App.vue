<script setup lang="ts">
import { ref, watch } from 'vue'
import { RouterView, useRoute, useRouter } from 'vue-router'

import { useSessionStore } from '@/stores/session'

const route = useRoute()
const router = useRouter()
const session = useSessionStore()

// The device remembered a member, so their page opened at once. If the server then says the
// session is over, or they log out, a members page goes back to the gate.
watch(
  () => session.me,
  (me) => {
    if (!me && route.meta.requiresAuth) void router.replace({ name: 'home' })
  },
)

/**
 * Counts the steps forward. Each one remounts the page, which plays its entrance. Replacing a
 * page shows the new one at once, and going back shows the page as it was, with no entrances
 * at all (see `.pn-page` in motion.css).
 */
const step = ref(0)
const back = ref(false)
router.afterEach((_to, _from, failure) => {
  if (failure) return
  const { forward, replaced } = router.options.history.state
  // Only a page that was gone back to has one ahead of it.
  back.value = Boolean(forward)
  if (!forward && !replaced) step.value++
})
</script>

<template>
  <div class="app">
    <div :key="step" :class="['pn-page', { 'pn-page--back': back }]">
      <RouterView />
    </div>
  </div>
</template>

<style scoped>
/* A phone-width column: the design is drawn at 390pt. */
.app {
  position: relative;
  max-width: 430px;
  min-height: 100dvh;
  margin: 0 auto;
  background: var(--paper);
}
</style>
