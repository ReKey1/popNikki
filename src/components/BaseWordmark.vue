<script setup lang="ts">
// The logo is always set in type: there is no logo file.
import { computed } from 'vue'

import BaseSticker from './BaseSticker.vue'

const {
  layout = 'inline',
  size,
  sticker = false,
  animated = false,
  inverse = false,
} = defineProps<{
  layout?: 'inline' | 'stacked'
  /** Font size in px. Defaults to 84 stacked and 26 inline. */
  size?: number
  /** Adds the tilted 日記 sticker (stacked layout only). */
  sticker?: boolean
  animated?: boolean
  /** For dark backgrounds. */
  inverse?: boolean
}>()

const px = computed(() => size ?? (layout === 'stacked' ? 84 : 26))
</script>

<template>
  <div
    :class="['mark', `mark--${layout}`, { 'mark--animated': animated, 'mark--inverse': inverse }]"
    :style="{ '--size': `${px}px` }"
    role="img"
    aria-label="Pop Nikki"
  >
    <span class="mark__pop">POP</span>
    <span class="mark__nikki">NIKKI</span>
    <BaseSticker
      v-if="sticker && layout === 'stacked'"
      class="mark__sticker"
      :style="{ right: `${-px * 0.4}px`, top: `${-px * 0.21}px` }"
    />
  </div>
</template>

<style scoped>
.mark {
  --ink-color: var(--ink);
  --second-color: var(--moss);

  position: relative;
  display: inline-flex;
  font: 400 var(--size) / 1 var(--font-spray);
}

.mark--inverse {
  --ink-color: var(--paper);
  --second-color: var(--orange);
}

.mark__pop {
  display: inline-block;
  color: var(--ink-color);
}

.mark__nikki {
  display: inline-block;
  color: var(--second-color);
}

.mark--inline {
  align-items: baseline;
  gap: 6px;
  transform: rotate(-3deg);
}

.mark--inline.mark--animated .mark__pop {
  transform-origin: 50% 70%;
  animation: pn-pop 2.8s ease-out infinite;
}

.mark--stacked {
  flex-direction: column;
  align-items: center;
  line-height: 0.9;
}

.mark--stacked .mark__pop {
  transform: rotate(-5deg);
}

.mark--stacked .mark__nikki {
  transform: rotate(-2deg);
}

.mark--stacked.mark--animated {
  animation: pn-hit 3.2s infinite;
}

.mark__sticker {
  position: absolute;
}
</style>
