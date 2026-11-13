<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  modelValue: string
  total: number
  matchCount: number
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string]
  clear: []
}>()

const isFiltering = computed(() => props.modelValue.trim() !== '')

const statText = computed(() =>
  isFiltering.value
    ? `共 ${props.total} 条 · 命中 ${props.matchCount} 条`
    : `共 ${props.total} 条`
)

function handleInput(event: Event): void {
  emit('update:modelValue', (event.target as HTMLInputElement).value)
}
</script>

<template>
  <section class="filter" aria-labelledby="filter-title">
    <h2 id="filter-title" class="sr-only">在院子里找一找</h2>

    <div class="filter__bar">
      <svg class="filter__icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <circle cx="11" cy="11" r="6.2" stroke="currentColor" stroke-width="1.6" />
        <path d="m15.6 15.6 4 4" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" />
      </svg>

      <label class="sr-only" for="search">按关键词筛选</label>
      <input
        id="search"
        class="filter__input"
        type="search"
        :value="modelValue"
        placeholder="搜一搜正文或署名……"
        autocomplete="off"
        spellcheck="false"
        @input="handleInput"
        @keydown.esc="emit('clear')"
      >

      <button
        id="search-clear"
        v-show="isFiltering"
        class="filter__clear"
        type="button"
        @click="emit('clear')"
      >
        清除
      </button>
    </div>

    <p id="feed-stat" class="filter__stat" aria-live="polite">{{ statText }}</p>
  </section>
</template>
