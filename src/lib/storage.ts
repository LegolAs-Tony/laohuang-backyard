export interface Post {
  id: string
  author: string
  content: string
  createdAt: number
  liked: boolean
}

export const POSTS_KEY = 'lyd.posts.v1'
export const AUTHOR_KEY = 'lyd.author.v1'

export const MAX_CONTENT = 500
export const MAX_AUTHOR = 20
export const DEFAULT_AUTHOR = '花园访客'

const ERROR_STORAGE_BLOCKED = '浏览器禁用了本地存储，这次的改动可能无法保存。'
const ERROR_STORAGE_BROKEN = '本地数据读不出来了，已先给你一片干净的院子。'
const ERROR_STORAGE_QUOTA = '本地空间已满，删掉几条再试试。'
const ERROR_STORAGE_WRITE = '本地存储写入失败，请检查浏览器设置。'

export interface ReadPostsResult {
  posts: Post[]
  error?: string
}

export interface WritePostsResult {
  ok: boolean
  error?: string
}

export function createId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7)
}

/** 访问 window.localStorage 本身也可能抛错（隐私模式 / 禁用 Cookie） */
function defaultStorage(): Storage | null {
  try {
    return window.localStorage
  } catch {
    return null
  }
}

function isQuotaError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false
  const candidate = error as { name?: string; code?: number }
  return (
    candidate.name === 'QuotaExceededError' ||
    candidate.name === 'NS_ERROR_DOM_QUOTA_REACHED' ||
    candidate.code === 22
  )
}

function sanitize(raw: unknown): Post[] {
  if (!Array.isArray(raw)) throw new Error('数据不是数组')

  return raw
    .filter((item): item is Record<string, unknown> => {
      if (!item || typeof item !== 'object') return false
      const content = (item as Record<string, unknown>).content
      return typeof content === 'string' && content.trim() !== ''
    })
    .map((item) => {
      const author = typeof item.author === 'string' ? item.author.trim() : ''
      const createdAt = Number(item.createdAt)

      return {
        id: typeof item.id === 'string' && item.id ? item.id : createId(),
        author: author ? author.slice(0, MAX_AUTHOR) : DEFAULT_AUTHOR,
        content: String(item.content).trim().slice(0, MAX_CONTENT),
        createdAt: createdAt > 0 ? createdAt : Date.now(),
        liked: item.liked === true
      }
    })
}

export function readPosts(storage: Storage | null = defaultStorage()): ReadPostsResult {
  if (!storage) return { posts: [], error: ERROR_STORAGE_BLOCKED }

  let raw: string | null
  try {
    raw = storage.getItem(POSTS_KEY)
  } catch {
    return { posts: [], error: ERROR_STORAGE_BLOCKED }
  }

  if (!raw) return { posts: [] }

  try {
    return { posts: sanitize(JSON.parse(raw)) }
  } catch {
    return { posts: [], error: ERROR_STORAGE_BROKEN }
  }
}

export function writePosts(
  posts: Post[],
  storage: Storage | null = defaultStorage()
): WritePostsResult {
  if (!storage) return { ok: false, error: ERROR_STORAGE_BLOCKED }

  try {
    storage.setItem(POSTS_KEY, JSON.stringify(posts))
    return { ok: true }
  } catch (error) {
    return { ok: false, error: isQuotaError(error) ? ERROR_STORAGE_QUOTA : ERROR_STORAGE_WRITE }
  }
}

export function readAuthor(storage: Storage | null = defaultStorage()): string {
  if (!storage) return ''

  try {
    return storage.getItem(AUTHOR_KEY) ?? ''
  } catch {
    return ''
  }
}

export function writeAuthor(name: string, storage: Storage | null = defaultStorage()): void {
  if (!storage) return

  try {
    storage.setItem(AUTHOR_KEY, name)
  } catch {
    // 署名记忆失败不影响主流程，静默降级
  }
}
