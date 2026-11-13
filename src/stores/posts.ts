import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { createPost, deletePost, fetchPosts, updatePost } from '@/lib/api'
import { MAX_AUTHOR, MAX_CONTENT, matchesQuery } from '@/lib/posts'
import type { Post, PostView } from '@/lib/posts'
import { readAuthor, writeAuthor } from '@/lib/preferences'

export interface AddPostPayload {
  author: string
  content: string
}

export interface ActionResult {
  ok: boolean
  error?: string
}

export const usePostsStore = defineStore('posts', () => {
  /* ------------------------------------------------------------------ 状态 */
  const posts = ref<Post[]>([])
  // 署名是纯界面偏好，同步读出来，避免输入框空一下再填上
  const author = ref(readAuthor())
  const keyword = ref('')
  const error = ref<string | null>(null)
  // 当前列表视图：全部 / 只看收藏
  const view = ref<PostView>('all')
  // 正在请求中的点赞 / 收藏 id，防止连点重复提交；两者互不阻塞
  const liking = new Set<string>()
  const favoriting = new Set<string>()

  /* ------------------------------------------------------------ 派生状态 */
  const sortedPosts = computed(() =>
    [...posts.value].sort((a, b) => b.createdAt - a.createdAt)
  )

  const favoritePosts = computed(() => sortedPosts.value.filter((post) => post.favorited))
  const favoriteCount = computed(() => favoritePosts.value.length)

  /** 先按视图取范围，再按关键词过滤，顺序不能反（否则统计与空态都会错） */
  const scopedPosts = computed(() =>
    view.value === 'favorites' ? favoritePosts.value : sortedPosts.value
  )

  const visiblePosts = computed(() => {
    if (!keyword.value.trim()) return scopedPosts.value
    return scopedPosts.value.filter((post) => matchesQuery(post, keyword.value))
  })

  const total = computed(() => posts.value.length)
  const matchCount = computed(() => visiblePosts.value.length)
  const isEmpty = computed(() => posts.value.length === 0)
  const isFiltering = computed(() => keyword.value.trim() !== '')
  const isFavoritesEmpty = computed(() => view.value === 'favorites' && favoriteCount.value === 0)
  // 收藏为空时由专门的空态接管，不再叠一个「没搜到」
  const isNoResult = computed(
    () =>
      !isFavoritesEmpty.value &&
      scopedPosts.value.length > 0 &&
      isFiltering.value &&
      matchCount.value === 0
  )

  /* -------------------------------------------------------------- 行为层 */
  async function load(): Promise<void> {
    const result = await fetchPosts()

    if (!result.ok) {
      // 只提示不擦除：后端重启或网络瞬断时，已经渲染出来的内容不该凭空消失
      error.value = result.error
      return
    }

    posts.value = result.data
    error.value = null
  }

  function init(): Promise<void> {
    return load()
  }

  /** 窗口重新可见/聚焦时调用，替代原来的多标签 storage 事件 */
  function reload(): Promise<void> {
    return load()
  }

  async function addPost({ author: rawAuthor, content }: AddPostPayload): Promise<ActionResult> {
    const trimmedContent = content.trim()
    const trimmedAuthor = rawAuthor.trim().slice(0, MAX_AUTHOR)

    if (!trimmedContent) {
      return { ok: false, error: '院子里不能空着，先写点什么吧。' }
    }

    if (trimmedContent.length > MAX_CONTENT) {
      return { ok: false, error: `超过 ${MAX_CONTENT} 字了，删减一点再试。` }
    }

    const result = await createPost({ author: trimmedAuthor, content: trimmedContent })

    if (!result.ok) {
      error.value = result.error
      return { ok: false, error: result.error }
    }

    // 期间可能有一次 focus 触发的 reload 已经把这条带回来了，按 id 去重再合并
    posts.value = [...posts.value.filter((post) => post.id !== result.data.id), result.data]

    // 匿名发布不覆盖已记住的署名
    if (trimmedAuthor) {
      author.value = trimmedAuthor
      writeAuthor(trimmedAuthor)
    }
    error.value = null

    // 当前筛选或收藏视图会把新内容藏起来时，顺手切回全部，避免"发出去了却看不见"
    if (view.value === 'favorites') {
      view.value = 'all'
    }

    if (keyword.value.trim() && !matchesQuery(result.data, keyword.value)) {
      keyword.value = ''
    }

    return { ok: true }
  }

  async function toggleLike(id: string): Promise<ActionResult> {
    const target = posts.value.find((post) => post.id === id)
    if (!target) return { ok: false }

    // 连点保护：请求在途时忽略后续点击，否则两次都基于旧状态算出同一个目标值
    if (liking.has(id)) return { ok: false }

    liking.add(id)
    try {
      const result = await updatePost(id, { liked: !target.liked })

      if (!result.ok) {
        error.value = result.error
        return { ok: false, error: result.error }
      }

      posts.value = posts.value.map((post) => (post.id === id ? result.data : post))
      error.value = null
      return { ok: true }
    } finally {
      liking.delete(id)
    }
  }

  async function toggleFavorite(id: string): Promise<ActionResult> {
    const target = posts.value.find((post) => post.id === id)
    if (!target) return { ok: false }

    // 与点赞同款连点保护：在途期间忽略后续点击，失败时不留下半截状态
    if (favoriting.has(id)) return { ok: false }

    favoriting.add(id)
    try {
      const result = await updatePost(id, { favorited: !target.favorited })

      if (!result.ok) {
        error.value = result.error
        return { ok: false, error: result.error }
      }

      posts.value = posts.value.map((post) => (post.id === id ? result.data : post))
      error.value = null
      return { ok: true }
    } finally {
      favoriting.delete(id)
    }
  }

  async function removePost(id: string): Promise<ActionResult> {
    const result = await deletePost(id)

    if (!result.ok) {
      error.value = result.error
      return { ok: false, error: result.error }
    }

    posts.value = posts.value.filter((post) => post.id !== id)
    error.value = null
    return { ok: true }
  }

  function setKeyword(value: string): void {
    keyword.value = value
  }

  function setView(next: PostView): void {
    view.value = next
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
    view,
    // 派生
    sortedPosts,
    favoritePosts,
    favoriteCount,
    visiblePosts,
    total,
    matchCount,
    isEmpty,
    isNoResult,
    isFavoritesEmpty,
    isFiltering,
    // 行为
    init,
    reload,
    addPost,
    toggleLike,
    toggleFavorite,
    removePost,
    setKeyword,
    clearKeyword,
    setView,
    clearError
  }
})
