<script setup lang="ts">
const {
  breaking = false,
  caption = 'TAP TO OPEN',
  text = 'UNSEEN ✦ UNSEEN ✦ UNSEEN ✦ UNSEEN ✦ ',
} = defineProps<{
  /** Plays the break animation (0.55s). */
  breaking?: boolean
  caption?: string
  text?: string
}>()
</script>

<template>
  <div :class="['seal', { 'seal--breaking': breaking }]" aria-hidden="true">
    <div class="seal__tape">
      <div class="seal__scroll">
        <span>{{ text }}</span>
        <span>{{ text }}</span>
      </div>
    </div>
    <div v-if="caption" class="seal__caption">{{ caption }}</div>
  </div>
</template>

<style scoped>
.seal {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  background: var(--ink);
}

.seal--breaking {
  animation: pn-break 0.55s ease-in forwards;
}

.seal__tape {
  position: absolute;
  width: 160%;
  height: 30px;
  overflow: hidden;
  background: var(--tape);
  transform: rotate(-18deg);
}

.seal__scroll {
  display: flex;
  align-items: center;
  width: max-content;
  height: 100%;
  white-space: nowrap;
  font: 400 13px var(--font-sign);
  letter-spacing: 0.06em;
  color: var(--ink);
  animation: pn-tape 7s linear infinite;
}

.seal__scroll span {
  padding-right: 4px;
}

.seal__caption {
  position: absolute;
  bottom: 12px;
  font: var(--type-mono-meta);
  letter-spacing: var(--tracking-label);
  color: var(--paper);
}
</style>
