import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import {
  DEFAULT_AUTHOR,
  MAX_AUTHOR,
  MAX_CONTENT,
  createId,
  readAuthor,
  readPosts,
  writeAuthor,
  writePosts
} from '@/lib/storage'
import type { Post } from '@/lib/storage'

export interface AddPostPayload {
  author: string
  content: string
}

export interface ActionResult {
  ok: boolean
  error?: string
}

function matchesQuery(post: Post, keyword: string): boolean {
  const needle = keyword.trim().toLowerCase()
  if (!needle) return true

  return (
    post.content.toLowerCase().includes(needle) || post.author.toLowerCase().includes(needle)
  )
}

export const usePostsStore = defineStore('posts', () => {
  /* ------------------------------------------------------------------ 状态 */
  const posts = ref<Post[]>([])
  const author = ref('')
  const keyword = ref('')
  const error = ref<string | null>(null)

  /* ------------------------------------------------------------ 派生状态 */
  const sortedPosts = computed(() =>
    [...posts.value].sort((a, b) => b.createdAt - a.createdAt)
  )

  const visiblePosts = computed(() => {
    if (!keyword.value.trim()) return sortedPosts.value
    return sortedPosts.value.filter((post) => matchesQuery(post, keyword.value))
  })

  const total = computed(() => posts.value.length)
  const matchCount = computed(() => visiblePosts.value.length)
  const isEmpty = computed(() => posts.value.length === 0)
  const isNoResult = computed(
    () => !isEmpty.value && keyword.value.trim() !== '' && matchCount.value === 0
  )
  const isFiltering = computed(() => keyword.value.trim() !== '')

  /* -------------------------------------------------------------- 行为层 */
  function load(): void {
    const result = readPosts()
    posts.value = result.posts
    author.value = readAuthor()
    error.value = result.error ?? null
  }

  function init(): void {
    load()
  }

  function reload(): void {
    load()
  }

  function addPost({ author: rawAuthor, content }: AddPostPayload): ActionResult {
    const trimmedContent = content.trim()
    const trimmedAuthor = rawAuthor.trim().slice(0, MAX_AUTHOR)

    if (!trimmedContent) {
      return { ok: false, error: '院子里不能空着，先写点什么吧。' }
    }

    if (trimmedContent.length > MAX_CONTENT) {
      return { ok: false, error: `超过 ${MAX_CONTENT} 字了，删减一点再试。` }
    }

    const post: Post = {
      id: createId(),
      author: trimmedAuthor || DEFAULT_AUTHOR,
      content: trimmedContent,
      createdAt: Date.now(),
      liked: false
    }

    const next = [...posts.value, post]
    const result = writePosts(next)

    if (!result.ok) {
      error.value = result.error ?? '保存失败，请稍后重试。'
      return { ok: false, error: result.error }
    }

    posts.value = next
    author.value = trimmedAuthor
    writeAuthor(trimmedAuthor)
    error.value = null

    // 当前筛选会把这天新内容藏起来时，顺手清空筛选，避免"发出去了却看不见"
    if (keyword.value.trim() && !matchesQuery(post, keyword.value)) {
      keyword.value = ''
    }

    return { ok: true }
  }

  function toggleLike(id: string): ActionResult {
    const target = posts.value.find((post) => post.id === id)
    if (!target) return { ok: false }

    const next = posts.value.map((post) =>
      post.id === id ? { ...post, liked: !post.liked } : post
    )
    const result = writePosts(next)

    if (!result.ok) {
      error.value = result.error ?? '保存失败，请稍后重试。'
      return { ok: false, error: result.error }
    }

    posts.value = next
    return { ok: true }
  }

  function removePost(id: string): ActionResult {
    const next = posts.value.filter((post) => post.id !== id)
    const result = writePosts(next)

    if (!result.ok) {
      error.value = result.error ?? '保存失败，请稍后重试。'
      return { ok: false, error: result.error }
    }

    posts.value = next
    return { ok: true }
  }

  function setKeyword(value: string): void {
    keyword.value = value
  }

  function clearKeyword(): void {
    keyword.value = ''
  }

  function clearError(): void {
    error.value = null
  }

  return {
    // 状态
    posts,
    author,
    keyword,
    error,
    // 派生
    sortedPosts,
    visiblePosts,
    total,
    matchCount,
    isEmpty,
    isNoResult,
    isFiltering,
    // 行为
    init,
    reload,
    addPost,
    toggleLike,
    removePost,
    setKeyword,
    clearKeyword,
    clearError
  }
})
