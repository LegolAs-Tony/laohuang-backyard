import type { Post } from './posts'

export const API_BASE = '/api'

export type ApiResult<T> = { ok: true; data: T } | { ok: false; error: string }

const NETWORK_ERROR = {
  read: '拿不到院子里的内容，请检查网络后再试。',
  write: '保存失败，请检查网络后再试。',
  remove: '删除失败，请检查网络后再试。'
} as const

interface ErrorBody {
  error?: { code?: unknown; message?: unknown }
}

type Transport = { ok: true; response: Response } | { ok: false; error: string }

/** 服务端错误优先用它的中文文案，读不出结构时退回调用方的兜底文案 */
async function errorMessage(response: Response, fallback: string): Promise<string> {
  try {
    const body = (await response.json()) as ErrorBody
    const message = body.error?.message
    return typeof message === 'string' && message ? message : fallback
  } catch {
    return fallback
  }
}

async function transport(
  input: string,
  init: RequestInit | undefined,
  fallback: string
): Promise<Transport> {
  try {
    return { ok: true, response: await fetch(input, init) }
  } catch {
    return { ok: false, error: fallback }
  }
}

/** 计数只接受有限非负整数，负数或小数都算脏数据 */
function isCount(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0
}

/** 服务端返回的东西不可信，逐字段校验后再交给视图，避免 computed 里崩渲染 */
function isPost(value: unknown): value is Post {
  if (typeof value !== 'object' || value === null) return false

  const post = value as Record<string, unknown>
  return (
    typeof post.id === 'string' &&
    post.id !== '' &&
    typeof post.author === 'string' &&
    typeof post.content === 'string' &&
    typeof post.createdAt === 'number' &&
    Number.isFinite(post.createdAt) &&
    typeof post.liked === 'boolean' &&
    isCount(post.likes) &&
    typeof post.favorited === 'boolean'
  )
}

async function readPosts(transportResult: Transport): Promise<ApiResult<Post[]>> {
  if (!transportResult.ok) return transportResult

  const { response } = transportResult
  if (!response.ok) {
    return { ok: false, error: await errorMessage(response, NETWORK_ERROR.read) }
  }

  try {
    const body = (await response.json()) as { posts?: unknown }
    return Array.isArray(body.posts) && body.posts.every(isPost)
      ? { ok: true, data: body.posts }
      : { ok: false, error: NETWORK_ERROR.read }
  } catch {
    return { ok: false, error: NETWORK_ERROR.read }
  }
}

async function readPost(transportResult: Transport): Promise<ApiResult<Post>> {
  if (!transportResult.ok) return transportResult

  const { response } = transportResult
  if (!response.ok) {
    return { ok: false, error: await errorMessage(response, NETWORK_ERROR.write) }
  }

  try {
    const body = (await response.json()) as { post?: unknown }
    return isPost(body.post)
      ? { ok: true, data: body.post }
      : { ok: false, error: NETWORK_ERROR.write }
  } catch {
    return { ok: false, error: NETWORK_ERROR.write }
  }
}

export async function fetchPosts(): Promise<ApiResult<Post[]>> {
  return readPosts(await transport(`${API_BASE}/posts`, undefined, NETWORK_ERROR.read))
}

export async function createPost(input: {
  author: string
  content: string
}): Promise<ApiResult<Post>> {
  const init: RequestInit = {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ author: input.author, content: input.content })
  }

  return readPost(await transport(`${API_BASE}/posts`, init, NETWORK_ERROR.write))
}

/** 只带需要改的字段，服务端按「出现即更新」处理 */
export interface PostPatch {
  liked?: boolean
  favorited?: boolean
}

export async function updatePost(id: string, patch: PostPatch): Promise<ApiResult<Post>> {
  const init: RequestInit = {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(patch)
  }

  return readPost(
    await transport(`${API_BASE}/posts/${encodeURIComponent(id)}`, init, NETWORK_ERROR.write)
  )
}

export async function deletePost(id: string): Promise<ApiResult<null>> {
  const result = await transport(
    `${API_BASE}/posts/${encodeURIComponent(id)}`,
    { method: 'DELETE' },
    NETWORK_ERROR.remove
  )

  if (!result.ok) return result
  if (!result.response.ok) {
    return { ok: false, error: await errorMessage(result.response, NETWORK_ERROR.remove) }
  }

  return { ok: true, data: null }
}
