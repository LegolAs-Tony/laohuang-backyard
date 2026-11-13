<script setup lang="ts">
import PostCard from '@/components/PostCard.vue'
import type { Post } from '@/lib/storage'

defineProps<{
  posts: Post[]
  query: string
  isEmpty: boolean
  isNoResult: boolean
}>()

const emit = defineEmits<{
  like: [id: string]
  delete: [id: string]
  'clear-search': []
  'focus-composer': []
}>()
</script>

<template>
  <section class="feed" aria-labelledby="feed-title">
    <h2 id="feed-title" class="sr-only">院子里的动态</h2>

    <div class="feed__list">
      <PostCard
        v-for="post in posts"
        :key="post.id"
        :post="post"
        :query="query"
        @like="emit('like', $event)"
        @delete="emit('delete', $event)"
      />
    </div>

    <div id="empty" class="empty" :class="{ 'is-visible': isEmpty }" role="status">
      <span class="empty__art" aria-hidden="true">
        <svg viewBox="0 0 64 64" fill="none">
          <path
            d="M20 34h24l-3 18a4 4 0 0 1-4 3.4H27a4 4 0 0 1-4-3.4L20 34Z"
            stroke="currentColor"
            stroke-width="2.2"
            stroke-linejoin="round"
          />
          <path d="M17 34h30" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" />
          <path d="M32 30c0-7 3.4-11.6 9-13.6C41 24 37.4 28 32 30Z" fill="currentColor" opacity=".5" />
          <path d="M32 30c0-6-2.8-9.8-7.6-11.4C24.4 24.6 27.4 28 32 30Z" fill="currentColor" opacity=".3" />
          <path d="M32 30V21" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" />
        </svg>
      </span>
      <p class="empty__text">院子还空着，种下第一条吧</p>
      <button id="empty-action" class="btn btn--ghost" type="button" @click="emit('focus-composer')">
        写点什么
      </button>
    </div>

    <div
      id="no-result"
      class="no-result"
      :class="{ 'is-visible': !isEmpty && isNoResult }"
      role="status"
    >
      <span class="no-result__art" aria-hidden="true">
        <svg viewBox="0 0 64 64" fill="none">
          <circle cx="28" cy="28" r="14" stroke="currentColor" stroke-width="2.2" />
          <path d="m38.5 38.5 11 11" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" />
          <path d="M23 26.5h10M23 32h6" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" />
        </svg>
      </span>
      <p class="no-result__text">院子里没有找到这几个字</p>
      <button
        id="no-result-action"
        class="btn btn--ghost"
        type="button"
        @click="emit('clear-search')"
      >
        清空筛选
      </button>
    </div>
  </section>
</template>
