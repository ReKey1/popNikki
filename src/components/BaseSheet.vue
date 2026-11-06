<script setup lang="ts">
import { usePointerSwipe } from '@vueuse/core'
import { onMounted, ref, useTemplateRef, watch } from 'vue'

const { draggable = false } = defineProps<{
  title: string
  /** Lets the header be dragged between half and full height, or down to close. */
  draggable?: boolean
}>()

const open = defineModel<boolean>('open', { default: false })
const dialog = useTemplateRef<HTMLDialogElement>('dialog')
const handle = useTemplateRef<HTMLElement>('handle')

// A modal <dialog> gives focus trapping, Esc to close and the backdrop for free.
function sync() {
  const el = dialog.value
  if (!el) return
  if (open.value && !el.open) el.showModal()
  else if (!open.value && el.open) el.close()
}
watch(open, (isOpen) => {
  // Every opening starts at half height.
  if (isOpen) snap.value = 'half'
  sync()
})
onMounted(sync)

// A click on the dialog box itself (not its content) is a click on the backdrop.
function onClick(event: MouseEvent) {
  if (event.target === dialog.value) open.value = false
}

const snap = ref<'half' | 'full'>('half')
/** The height in px while a finger drags the header; null otherwise. */
const dragHeight = ref<number | null>(null)
let startHeight = 0

const { distanceY } = usePointerSwipe(handle, {
  threshold: 10,
  onSwipeStart() {
    if (!draggable) return
    startHeight = dialog.value?.getBoundingClientRect().height ?? 0
  },
  onSwipe() {
    if (!draggable) return
    const max = window.innerHeight * 0.9
    dragHeight.value = Math.min(max, Math.max(0, startHeight + distanceY.value))
  },
  onSwipeEnd(_event, direction) {
    if (!draggable) return
    dragHeight.value = null
    if (direction === 'up') snap.value = 'full'
    else if (direction === 'down') {
      if (snap.value === 'full') snap.value = 'half'
      else open.value = false
    }
  },
})
</script>

<template>
  <dialog
    ref="dialog"
    :class="['sheet', draggable && `sheet--${snap}`, { 'sheet--dragging': dragHeight !== null }]"
    :style="dragHeight !== null ? { height: `${dragHeight}px` } : undefined"
    :data-snap="draggable ? snap : undefined"
    :aria-label="title"
    @close="open = false"
    @click="onClick"
  >
    <div class="sheet__body">
      <div ref="handle" :class="['sheet__handle', { 'sheet__handle--drag': draggable }]">
        <span v-if="draggable" class="sheet__grip" aria-hidden="true"></span>
        <div class="sheet__head">
          <h2 class="sheet__title">{{ title }}</h2>
          <button type="button" class="sheet__close" aria-label="Close" @click="open = false">
            <span aria-hidden="true">✕</span>
          </button>
        </div>
      </div>
      <div class="sheet__content">
        <slot />
      </div>
    </div>
  </dialog>
</template>

<style scoped>
/* The sheet slides up from the bottom edge and back down when it closes. */
.sheet {
  width: 100%;
  max-width: 430px;
  max-height: 90dvh;
  margin: auto auto 0;
  padding: 0;
  overflow: hidden;
  border: none;
  border-radius: var(--radius-sheet) var(--radius-sheet) 0 0;
  background: var(--paper);
  color: var(--ink);
  translate: 0 100%;
  transition:
    translate 0.3s ease-out,
    height 0.25s ease-out,
    overlay 0.3s allow-discrete,
    display 0.3s allow-discrete;
}

.sheet[open] {
  translate: 0 0;
}

@starting-style {
  .sheet[open] {
    translate: 0 100%;
  }
}

.sheet--half {
  height: 50dvh;
}

.sheet--full {
  height: 90dvh;
}

/* The height follows the finger without lag. */
.sheet--dragging {
  transition: none;
}

.sheet::backdrop {
  background: transparent;
  transition:
    background-color 0.3s,
    overlay 0.3s allow-discrete,
    display 0.3s allow-discrete;
}

.sheet[open]::backdrop {
  background: var(--scrim);
}

@starting-style {
  .sheet[open]::backdrop {
    background: transparent;
  }
}

.sheet__body {
  display: flex;
  flex-direction: column;
  gap: 18px;
  height: 100%;
  max-height: 90dvh;
  padding: 18px 22px 0;
}

.sheet__handle {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

/* usePointerSwipe sets pan-y inline; the drag handle must keep every touch to itself. */
.sheet__handle--drag {
  margin-top: -8px;
  touch-action: none !important;
  cursor: grab;
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

/* The content scrolls inside the sheet at any height. */
.sheet__content {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 18px;
  min-height: 0;
  padding-bottom: max(34px, calc(env(safe-area-inset-bottom) + 16px));
  overflow-y: auto;
  overscroll-behavior: contain;
}
</style>
