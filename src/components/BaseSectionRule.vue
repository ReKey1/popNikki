<template>
  <div class="rule">
    <h2 class="rule__title"><slot /></h2>
    <span class="rule__line"></span>
  </div>
</template>

<style scoped>
.rule {
  display: flex;
  align-items: center;
  gap: 10px;
}

.rule__title {
  margin: 0;
  font: var(--type-sign-sm);
  color: var(--ink);
}

.rule__line {
  flex: 1;
  height: 1.5px;
  background: var(--ink);
}
</style>
