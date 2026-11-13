<script setup lang="ts">
import { computed } from 'vue'
import type { PostView } from '@/lib/posts'

const props = withDefaults(
  defineProps<{
    modelValue: string
    total: number
    matchCount: number
    view?: PostView
    favoriteCount?: number
  }>(),
  { view: 'all', favoriteCount: 0 }
)

const emit = defineEmits<{
  'update:modelValue': [value: string]
  'update:view': [view: PostView]
  clear: []
}>()

const isFiltering = computed(() => props.modelValue.trim() !== '')

const statText = computed(() => {
  const base =
    props.view === 'favorites' ? `收藏 ${props.favoriteCount} 条` : `共 ${props.total} 条`
  return isFiltering.value ? `${base} · 命中 ${props.matchCount} 条` : base
})

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

    <div class="filter__meta">
      <div class="filter__tabs" role="group" aria-label="切换查看范围">
        <button
          id="view-all"
          class="filter__tab"
          type="button"
          :aria-pressed="view === 'all' ? 'true' : 'false'"
          @click="emit('update:view', 'all')"
        >
          全部
        </button>
        <button
          id="view-favorites"
          class="filter__tab"
          type="button"
          :aria-pressed="view === 'favorites' ? 'true' : 'false'"
          @click="emit('update:view', 'favorites')"
        >
          收藏
        </button>
      </div>

      <p id="feed-stat" class="filter__stat" aria-live="polite">{{ statText }}</p>
    </div>
  </section>
</template>
