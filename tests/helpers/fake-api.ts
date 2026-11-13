import { vi } from 'vitest'
import { DEFAULT_AUTHOR } from '@/lib/posts'
import type { Post } from '@/lib/posts'

export type FailMode = 'none' | 'network' | 'server'

export interface FakeApi {
  posts: Post[]
  calls: Array<{ url: string; method: string; body?: unknown }>
  failMode: FailMode
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' }
  })
}

const ERROR = {
  content_required: '院子里不能空着，先写点什么吧。',
  not_found: '这条已经不在院子里了。',
  internal_error: '服务端出了点问题，请稍后重试。'
} as const

/**
 * 用 fetch stub 模拟契约里的 REST 接口：
 * 前端用例只关心「发什么请求、拿到什么数据」，不重复实现服务端校验细节。
 */
export function installFakeApi(seed: Partial<Post>[] = []): FakeApi {
  let counter = seed.length

  const api: FakeApi = {
    posts: seed.map((post, index) => {
      const liked = post.liked ?? false
      return {
        id: post.id ?? `p${index + 1}`,
        author: post.author ?? '老黄',
        content: post.content ?? `第 ${index + 1} 条`,
        createdAt: post.createdAt ?? 1_700_000_000_000 + index,
        liked,
        // 点赞数与点赞状态在种子里保持一致，避免出现「已赞但 0 个赞」的假数据
        likes: post.likes ?? (liked ? 1 : 0),
        favorited: post.favorited ?? false
      }
    }),
    calls: [],
    failMode: 'none'
  }

  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      const method = (init?.method ?? 'GET').toUpperCase()
      const body: Record<string, unknown> | undefined =
        typeof init?.body === 'string' ? JSON.parse(init.body) : undefined

      api.calls.push({ url, method, body })

      if (api.failMode === 'network') throw new TypeError('Failed to fetch')
      if (api.failMode === 'server') {
        return json({ error: { code: 'internal_error', message: ERROR.internal_error } }, 500)
      }

      // 返回副本，避免调用方与「服务端」共享对象引用，把悲观更新测成假绿
      if (url === '/api/posts' && method === 'GET') {
        return json({ posts: api.posts.map((post) => ({ ...post })) })
      }

      if (url === '/api/posts' && method === 'POST') {
        const content = String(body?.content ?? '').trim()
        if (!content) {
          return json({ error: { code: 'content_required', message: ERROR.content_required } }, 400)
        }

        counter += 1
        const post: Post = {
          id: `new-${counter}`,
          author: String(body?.author ?? '').trim() || DEFAULT_AUTHOR,
          content,
          createdAt: 1_700_000_100_000 + counter,
          liked: false,
          likes: 0,
          favorited: false
        }
        api.posts = [...api.posts, post]
        return json({ post }, 201)
      }

      const match = /^\/api\/posts\/([^/]+)$/.exec(url)
      if (match) {
        const id = decodeURIComponent(match[1])
        const target = api.posts.find((post) => post.id === id)
        if (!target) return json({ error: { code: 'not_found', message: ERROR.not_found } }, 404)

        if (method === 'PATCH') {
          // 契约：body 里出现哪个字段就改哪个，两者可以同时出现
          if (typeof body?.liked === 'boolean' && body.liked !== target.liked) {
            target.liked = body.liked
            target.likes = Math.max(0, target.likes + (body.liked ? 1 : -1))
          }
          if (typeof body?.favorited === 'boolean') {
            target.favorited = body.favorited
          }
          return json({ post: { ...target } })
        }

        if (method === 'DELETE') {
          api.posts = api.posts.filter((post) => post.id !== id)
          return new Response(null, { status: 204 })
        }
      }

      return json({ error: { code: 'route_not_found', message: '没有这个接口。' } }, 404)
    })
  )

  return api
}
