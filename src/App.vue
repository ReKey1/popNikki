<script setup lang="ts">
import { RouterLink, RouterView } from 'vue-router'
</script>

<template>
  <header>
    <RouterLink to="/">popNikki</RouterLink>
  </header>
  <main>
    <RouterView />
  </main>
</template>

<style>
body {
  font-family: system-ui, sans-serif;
  margin: 0 auto;
  max-width: 40rem;
  padding: 0 1rem;
}

img {
  max-width: 100%;
  height: auto;
}
</style>
