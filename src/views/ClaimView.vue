<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'

import BaseButton from '@/components/BaseButton.vue'
import BaseTextField from '@/components/BaseTextField.vue'
import BaseWordmark from '@/components/BaseWordmark.vue'
import { errorMessage } from '@/lib/api'
import { useSessionStore } from '@/stores/session'

const router = useRouter()
const session = useSessionStore()
const username = ref('')
const error = ref('')
const sending = ref(false)

async function claim() {
  sending.value = true
  error.value = ''
  const res = await fetch('/api/claim', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: username.value }),
  })
  sending.value = false
  if (res.ok) {
    // The claim logged you in: the next navigation asks the server who you are.
    session.reset()
    await router.push('/')
  } else error.value = await errorMessage(res)
}
</script>

<template>
  <main class="login">
    <div class="login__top mono-label">
      <span>EST. 2026</span>
      <span>MEMBERS ONLY</span>
    </div>
    <div class="login__hero">
      <span class="login__ring" aria-hidden="true"></span>
      <span class="login__disc" aria-hidden="true"></span>
      <h1 class="login__mark"><BaseWordmark layout="stacked" sticker animated /></h1>
      <p class="login__tagline">PRACTICE · WATER · POST</p>
    </div>
    <form class="login__form" @submit.prevent="claim">
      <BaseTextField
        v-model="username"
        label="WHO'S ON THE FLOOR?"
        placeholder="your name"
        :maxlength="20"
        required
        autocomplete="nickname"
      />
      <BaseButton type="submit" :disabled="sending">
        HIT IT
        <template #trailing>→</template>
      </BaseButton>
    </form>
    <p v-if="error" class="login__error" role="alert">{{ error }}</p>
    <p class="login__foot">Pick a name. It's how the crew sees you.</p>
  </main>
</template>

<style scoped>
.login {
  display: flex;
  flex-direction: column;
  min-height: 100dvh;
  padding: 28px 28px 40px;
}

.login__top {
  display: flex;
  justify-content: space-between;
  letter-spacing: 0.08em;
  color: var(--ink-3);
}

.login__hero {
  position: relative;
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 360px;
}

.login__ring,
.login__disc {
  position: absolute;
  top: 50%;
  left: 50%;
  border-radius: 50%;
}

.login__ring {
  width: 300px;
  height: 300px;
  border: 1.5px solid var(--moss-ring);
  transform: translate(-50%, -62%);
}

.login__disc {
  width: 210px;
  height: 210px;
  background: var(--moss-mist);
  transform: translate(-50%, -72%);
}

.login__mark {
  position: relative;
  margin: -60px 0 0;
  font-size: inherit;
}

.login__tagline {
  position: relative;
  margin: 48px 0 0;
  font: 500 12px var(--font-mono);
  letter-spacing: 0.14em;
  color: var(--ink-3);
}

.login__form {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.login__error {
  margin: 12px 0 0;
  font: var(--type-small);
  color: var(--orange-deep);
  text-align: center;
}

.login__foot {
  margin: 16px 0 0;
  font: 13px var(--font-body);
  color: var(--ink-4);
  text-align: center;
}
</style>
