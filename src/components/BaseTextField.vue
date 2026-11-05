<script setup lang="ts">
// Extra attributes (required, autocomplete, name…) go to the input, not the label.
defineOptions({ inheritAttrs: false })

const model = defineModel<string>({ default: '' })

const {
  multiline = false,
  size = 'lg',
  maxlength,
} = defineProps<{
  label?: string
  placeholder?: string
  multiline?: boolean
  maxlength?: number
  size?: 'md' | 'lg'
}>()
</script>

<template>
  <label class="field">
    <span v-if="label || (multiline && maxlength)" class="field__label">
      <span>{{ label }}</span>
      <span v-if="multiline && maxlength">{{ model.length }}/{{ maxlength }}</span>
    </span>
    <span class="field__row">
      <textarea
        v-if="multiline"
        v-model="model"
        v-bind="$attrs"
        :placeholder
        :maxlength
        class="field__control field__control--multiline"
      ></textarea>
      <input
        v-else
        v-model="model"
        v-bind="$attrs"
        :placeholder
        :maxlength
        :class="['field__control', `field__control--${size}`]"
      />
      <slot name="trailing" />
    </span>
  </label>
</template>

<style scoped>
.field {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.field__label {
  display: flex;
  justify-content: space-between;
  font: var(--type-mono-label);
  letter-spacing: var(--tracking-label);
  color: var(--ink-3);
}

.field__row {
  display: flex;
  gap: 8px;
}

.field__control {
  flex: 1;
  min-width: 0;
  border: var(--border-input);
  border-radius: var(--radius-md);
  background: var(--paper-raised);
  color: var(--ink);
  outline: none;
}

.field__control:focus-visible {
  box-shadow: 0 0 0 3px var(--moss-ring);
}

.field__control--lg {
  height: var(--control-input);
  padding: 0 18px;
  font: var(--type-input);
}

.field__control--md {
  height: var(--control-md);
  padding: 0 16px;
  font: 500 17px var(--font-body);
}

.field__control--multiline {
  height: 116px;
  padding: 14px 16px;
  border-radius: var(--radius-lg);
  font: 400 16px/1.5 var(--font-body);
  resize: none;
}
</style>
