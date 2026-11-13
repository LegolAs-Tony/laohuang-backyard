<script setup lang="ts">
import { computed } from 'vue'
import type { Post } from '@/lib/storage'
import { splitHighlight } from '@/lib/highlight'
import { formatFull, formatTime, toIsoString } from '@/lib/time'

const HEART_PATH =
  'M12 20.2c-.3 0-.6-.1-.9-.3C6.1 16.2 3 13.3 3 9.9 3 7.2 5.1 5 7.7 5c1.5 0 3 .7 4.3 2 1.3-1.3 2.8-2 4.3-2C18.9 5 21 7.2 21 9.9c0 3.4-3.1 6.3-8.1 10-.3.2-.6.3-.9.3Z'

const props = withDefaults(defineProps<{ post: Post; query?: string }>(), { query: '' })

const emit = defineEmits<{ like: [id: string]; delete: [id: string] }>()

const AVATAR_VARIANTS = 6

const segments = computed(() => splitHighlight(props.post.content, props.query))
const relativeTime = computed(() => formatTime(props.post.createdAt))
const fullTime = computed(() => formatFull(props.post.createdAt))
const isoTime = computed(() => toIsoString(props.post.createdAt))
const initial = computed(() => props.post.author.trim().charAt(0).toUpperCase() || '?')

const avatarVariant = computed(() => {
  let hash = 0
  for (let index = 0; index < props.post.id.length; index += 1) {
    hash = (hash * 31 + props.post.id.charCodeAt(index)) % 100003
  }
  return hash % AVATAR_VARIANTS
})

function requestDelete(): void {
  if (window.confirm(`确定要收走「${props.post.author}」的这条吗？`)) {
    emit('delete', props.post.id)
  }
}
</script>

<template>
  <article class="card">
    <span class="card__avatar" :class="`card__avatar--${avatarVariant}`" aria-hidden="true">
      {{ initial }}
    </span>

    <div class="card__main">
      <div class="card__head">
        <span class="card__author">{{ post.author }}</span>
        <time class="card__time" :datetime="isoTime" :title="fullTime">{{ relativeTime }}</time>
      </div>

      <p class="card__body"><template v-for="(segment, index) in segments" :key="index"><mark v-if="segment.matched" class="card__highlight">{{ segment.text }}</mark><template v-else>{{ segment.text }}</template></template></p>

      <div class="card__actions">
        <button
          type="button"
          class="card__action card__action--like"
          data-action="like"
          :aria-pressed="post.liked ? 'true' : 'false'"
          :aria-label="post.liked ? '取消点赞' : '点赞'"
          @click="emit('like', post.id)"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
            <path
              :d="HEART_PATH"
              :fill="post.liked ? 'currentColor' : 'none'"
              :fill-opacity="post.liked ? '0.85' : '0'"
              stroke="currentColor"
              stroke-width="1.6"
              stroke-linejoin="round"
            />
          </svg>
          <span class="card__action-icon">{{ post.liked ? '已赞' : '赞' }}</span>
        </button>

        <button
          type="button"
          class="card__action card__action--delete"
          data-action="delete"
          aria-label="删除这条动态"
          @click="requestDelete"
        >
          <span>删除</span>
        </button>
      </div>
    </div>
  </article>
</template>
