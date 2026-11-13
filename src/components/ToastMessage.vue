<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(defineProps<{ message?: string; tone?: 'info' | 'error' }>(), {
  message: '',
  tone: 'info'
})

const visible = computed(() => props.message !== '')
</script>

<template>
  <div
    id="toast"
    class="toast"
    :class="{ 'is-visible': visible, 'is-error': tone === 'error' }"
    role="status"
    aria-live="polite"
  >
    {{ message }}
  </div>
</template>
