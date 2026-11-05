<script setup lang="ts">
import { onMounted, useTemplateRef, watch } from 'vue'

defineProps<{ title: string }>()

const open = defineModel<boolean>('open', { default: false })
const dialog = useTemplateRef<HTMLDialogElement>('dialog')

// A modal <dialog> gives focus trapping, Esc to close and the backdrop for free.
function sync() {
  const el = dialog.value
  if (!el) return
  if (open.value && !el.open) el.showModal()
  else if (!open.value && el.open) el.close()
}
watch(open, sync)
onMounted(sync)

// A click on the dialog box itself (not its content) is a click on the backdrop.
function onClick(event: MouseEvent) {
  if (event.target === dialog.value) open.value = false
}
</script>

<template>
  <dialog ref="dialog" class="sheet" :aria-label="title" @close="open = false" @click="onClick">
    <div class="sheet__body">
      <span class="sheet__grip" aria-hidden="true"></span>
      <div class="sheet__head">
        <h2 class="sheet__title">{{ title }}</h2>
        <button type="button" class="sheet__close" aria-label="Close" @click="open = false">
          <span aria-hidden="true">✕</span>
        </button>
      </div>
      <slot />
    </div>
  </dialog>
</template>

<style scoped>
.sheet {
  width: 100%;
  max-width: 430px;
  max-height: 90dvh;
  margin: auto auto 0;
  padding: 0;
  border: none;
  border-radius: var(--radius-sheet) var(--radius-sheet) 0 0;
  background: var(--paper);
  color: var(--ink);
}

.sheet[open] {
  animation: pn-in 0.3s var(--ease-spring) both;
}

.sheet::backdrop {
  background: var(--scrim);
  backdrop-filter: blur(1px);
}

.sheet__body {
  display: flex;
  flex-direction: column;
  gap: 18px;
  padding: 12px 22px 34px;
}

.sheet__grip {
  align-self: center;
  width: 40px;
  height: 4px;
  border-radius: 2px;
  background: var(--rule-strong);
}

.sheet__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.sheet__title {
  margin: 0;
  font: var(--type-sign-lg);
}

.sheet__close {
  width: 44px;
  height: 44px;
  border: none;
  border-radius: 50%;
  background: var(--moss-mist);
  color: var(--ink);
  font: 16px sans-serif;
  cursor: pointer;
}
</style>
