<script setup lang="ts">
import { RouterView } from 'vue-router'
</script>

<template>
  <div class="app">
    <RouterView />
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
