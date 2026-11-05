<script setup lang="ts">
import { computed, ref, watch } from 'vue'

import BaseButton from './BaseButton.vue'
import BaseSheet from './BaseSheet.vue'
import BaseTextField from './BaseTextField.vue'
import { errorMessage, type Me } from '@/lib/api'

const props = defineProps<{ username: string }>()
const open = defineModel<boolean>('open', { default: false })
const emit = defineEmits<{ renamed: [me: Me]; loggedOut: [] }>()

const name = ref(props.username)
/** A rename asks twice before anything is sent. */
const step = ref<'edit' | 'confirm' | 'final'>('edit')
const error = ref('')
const saving = ref(false)

const newName = computed(() => name.value.trim())
const canSave = computed(() => newName.value.length > 0 && newName.value !== props.username)

// Every opening starts fresh from the current name.
watch(open, (isOpen) => {
  if (!isOpen) return
  name.value = props.username
  step.value = 'edit'
  error.value = ''
})
watch(name, () => {
  step.value = 'edit'
  error.value = ''
})

async function rename() {
  saving.value = true
  try {
    const res = await fetch('/api/me', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: newName.value }),
    })
    if (!res.ok) {
      error.value = await errorMessage(res)
      step.value = 'edit'
      return
    }
    emit('renamed', await res.json())
    open.value = false
  } finally {
    saving.value = false
  }
}

async function logOut() {
  await fetch('/api/logout', { method: 'POST' })
  open.value = false
  emit('loggedOut')
}
</script>

<template>
  <BaseSheet v-model:open="open" title="SETTINGS">
    <form v-if="step === 'edit'" @submit.prevent="step = 'confirm'">
      <BaseTextField
        v-model="name"
        label="USERNAME"
        size="md"
        :maxlength="20"
        autocomplete="off"
        required
      >
        <template #trailing>
          <BaseButton
            type="submit"
            variant="dark"
            size="md"
            :full-width="false"
            :disabled="!canSave"
            >SAVE</BaseButton
          >
        </template>
      </BaseTextField>
    </form>

    <div v-else class="confirm" role="group" aria-label="Confirm new username">
      <p v-if="step === 'confirm'" class="confirm__text">
        Change your name to <strong>{{ newName }}</strong
        >?
      </p>
      <p v-else class="confirm__text">
        Last check: everyone in the garden will see <strong>{{ newName }}</strong
        >. Change it for real?
      </p>
      <div class="confirm__actions">
        <BaseButton variant="secondary" size="md" @click="step = 'edit'">Cancel</BaseButton>
        <BaseButton v-if="step === 'confirm'" variant="dark" size="md" @click="step = 'final'"
          >Continue</BaseButton
        >
        <BaseButton v-else variant="accent" size="md" :disabled="saving" @click="rename"
          >Change name</BaseButton
        >
      </div>
    </div>

    <p v-if="error" class="error" role="alert">{{ error }}</p>
    <BaseButton variant="secondary" size="md" @click="logOut">Log out</BaseButton>
  </BaseSheet>
</template>

<style scoped>
.confirm {
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 16px;
  border-radius: 18px;
  background: var(--moss-mist);
}

.confirm__text {
  margin: 0;
  font: var(--type-body);
}

.confirm__actions {
  display: flex;
  gap: 10px;
}

.error {
  margin: 0;
  font: var(--type-small);
  color: var(--orange-deep);
}
</style>
