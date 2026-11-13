<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import AppHeader from '@/components/AppHeader.vue'
import PostComposer from '@/components/PostComposer.vue'
import SearchBar from '@/components/SearchBar.vue'
import PostFeed from '@/components/PostFeed.vue'
import ToastMessage from '@/components/ToastMessage.vue'
import { usePostsStore } from '@/stores/posts'

const store = usePostsStore()

const composer = ref<InstanceType<typeof PostComposer> | null>(null)
const toastMessage = ref('')
const toastTone = ref<'info' | 'error'>('info')
let toastTimer: number | undefined

function showToast(message: string, tone: 'info' | 'error' = 'info'): void {
  toastMessage.value = message
  toastTone.value = tone

  window.clearTimeout(toastTimer)
  toastTimer = window.setTimeout(() => {
    toastMessage.value = ''
  }, 3000)
}

async function refresh(): Promise<void> {
  await store.reload()
  if (store.error) showToast(store.error, 'error')
}

async function handleSubmit(payload: { author: string; content: string }): Promise<void> {
  const result = await store.addPost(payload)

  if (!result.ok) {
    showToast(result.error ?? '保存失败，请稍后重试。', 'error')
    return
  }

  composer.value?.reset()
  showToast('已经种进院子里啦')
}

async function handleLike(id: string): Promise<void> {
  const result = await store.toggleLike(id)
  if (!result.ok && result.error) showToast(result.error, 'error')
}

async function handleDelete(id: string): Promise<void> {
  const result = await store.removePost(id)
  showToast(
    result.ok ? '这条已经从院子里收走了' : result.error ?? '删除失败',
    result.ok ? 'info' : 'error'
  )
}

/** 没有 localStorage 事件了，改用页面重新可见/聚焦时主动拉一次 */
function handleVisibility(): void {
  if (document.visibilityState === 'visible') void refresh()
}

onMounted(async () => {
  window.addEventListener('focus', refresh)
  document.addEventListener('visibilitychange', handleVisibility)

  await store.init()
  if (store.error) showToast(store.error, 'error')
})

onBeforeUnmount(() => {
  window.removeEventListener('focus', refresh)
  document.removeEventListener('visibilitychange', handleVisibility)
  window.clearTimeout(toastTimer)
})
</script>

<template>
  <div class="ambient" aria-hidden="true">
    <span class="ambient__blob ambient__blob--1" />
    <span class="ambient__blob ambient__blob--2" />
    <span class="ambient__blob ambient__blob--3" />
    <span class="ambient__blob ambient__blob--4" />
    <span class="ambient__grain" />
  </div>

  <AppHeader />

  <main class="page">
    <PostComposer
      ref="composer"
      :initial-author="store.author"
      @submit="handleSubmit"
    />

    <SearchBar
      :model-value="store.keyword"
      :total="store.total"
      :match-count="store.matchCount"
      @update:model-value="store.setKeyword"
      @clear="store.clearKeyword"
    />

    <PostFeed
      :posts="store.visiblePosts"
      :query="store.keyword"
      :is-empty="store.isEmpty"
      :is-no-result="store.isNoResult"
      @like="handleLike"
      @delete="handleDelete"
      @clear-search="store.clearKeyword"
      @focus-composer="composer?.focus()"
    />
  </main>

  <footer class="site-footer">
    <p>内容保存在服务端内存里 · 重启后清空</p>
  </footer>

  <ToastMessage :message="toastMessage" :tone="toastTone" />
</template>
