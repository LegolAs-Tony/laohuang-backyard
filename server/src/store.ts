import { randomUUID } from 'node:crypto'

export interface Post {
  id: string
  author: string
  content: string
  createdAt: number
  /** 当前客户端是否点过赞 */
  liked: boolean
  /** 点赞总数，整数 >= 0；liked 为 true 时至少为 1 */
  likes: number
  /** 是否收藏 */
  favorited: boolean
}

/** 局部更新：只处理明确给出的字段 */
export interface PostPatch {
  liked?: boolean
  favorited?: boolean
}

export const MAX_CONTENT = 500
export const MAX_AUTHOR = 20
export const DEFAULT_AUTHOR = '花园访客'

export const CONTENT_REQUIRED_MESSAGE = '院子里不能空着，先写点什么吧。'
export const CONTENT_TOO_LONG_MESSAGE = `超过 ${MAX_CONTENT} 字了，删减一点再试。`

export type CreateFailureCode = 'content_required' | 'content_too_long'

export type CreateResult =
  | { ok: true; post: Post }
  | { ok: false; code: CreateFailureCode; message: string }

export interface CreateInput {
  author?: string
  content?: string
}

export interface PostStore {
  list(): Post[]
  count(): number
  create(input: CreateInput): CreateResult
  setLiked(id: string, liked: boolean): Post | null
  setFavorited(id: string, favorited: boolean): Post | null
  /** 一次写入多个字段，返回最终 post（副本）；找不到返回 null */
  update(id: string, patch: PostPatch): Post | null
  remove(id: string): boolean
  clear(): void
}

/** 点赞状态迁移：只在真正发生翻转时增减计数，重复提交保持幂等 */
function nextLikes(current: Post, liked: boolean): number {
  if (liked === current.liked) return current.likes
  return liked ? current.likes + 1 : Math.max(0, current.likes - 1)
}

/**
 * 进程内内存存储：重启即清空，够演示用。
 * 对外只返回副本，避免调用方直接改到内部状态。
 */
export function createPostStore(): PostStore {
  const posts = new Map<string, Post>()

  function updatePost(id: string, patch: PostPatch): Post | null {
    const target = posts.get(id)
    if (!target) return null

    // 整体替换而不是原地改，内部对象永远不被外部引用共享
    const next: Post = { ...target }

    if (patch.liked !== undefined) {
      next.likes = nextLikes(target, patch.liked)
      next.liked = patch.liked
    }

    if (patch.favorited !== undefined) {
      next.favorited = patch.favorited
    }

    posts.set(id, next)
    return { ...next }
  }

  return {
    list() {
      return [...posts.values()]
        .map((post) => ({ ...post }))
        .sort((left, right) => right.createdAt - left.createdAt)
    },

    count() {
      return posts.size
    },

    create({ author, content } = {}) {
      const trimmed = typeof content === 'string' ? content.trim() : ''

      if (!trimmed) {
        return { ok: false, code: 'content_required', message: CONTENT_REQUIRED_MESSAGE }
      }

      if (trimmed.length > MAX_CONTENT) {
        return { ok: false, code: 'content_too_long', message: CONTENT_TOO_LONG_MESSAGE }
      }

      const name = typeof author === 'string' ? author.trim().slice(0, MAX_AUTHOR) : ''
      const post: Post = {
        id: randomUUID(),
        author: name || DEFAULT_AUTHOR,
        content: trimmed,
        createdAt: Date.now(),
        liked: false,
        likes: 0,
        favorited: false
      }

      posts.set(post.id, post)
      return { ok: true, post: { ...post } }
    },

    setLiked(id, liked) {
      return updatePost(id, { liked })
    },

    setFavorited(id, favorited) {
      return updatePost(id, { favorited })
    },

    update: updatePost,

    remove(id) {
      return posts.delete(id)
    },

    clear() {
      posts.clear()
    }
  }
}
