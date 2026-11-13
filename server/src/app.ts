import { Hono } from 'hono'
import type { Context } from 'hono'
import { createPostStore } from './store'
import type { PostPatch, PostStore } from './store'

const MESSAGES = {
  invalid_json: '请求格式不对，请重试。',
  invalid_body: '请求格式不对，请重试。',
  not_found: '这条已经不在院子里了。',
  route_not_found: '没有这个接口。',
  internal_error: '服务端出了点问题，请稍后重试。'
} as const

type ErrorCode = keyof typeof MESSAGES
type FailureStatus = 400 | 404 | 500

function fail(c: Context, status: FailureStatus, code: ErrorCode) {
  return c.json({ error: { code, message: MESSAGES[code] } }, status)
}

/** 请求体不是合法 JSON 时不要抛 500，交给调用方回 400 */
async function readJsonBody(c: Context): Promise<{ ok: true; value: unknown } | { ok: false }> {
  try {
    return { ok: true, value: await c.req.json() }
  } catch {
    return { ok: false }
  }
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export interface AppOptions {
  /** 注入独立 store，测试用例之间互不污染 */
  store?: PostStore
}

export function createApp(options: AppOptions = {}): Hono {
  const store = options.store ?? createPostStore()
  const app = new Hono()
  const api = new Hono()

  api.get('/health', (c) => c.json({ status: 'ok', posts: store.count() }))

  api.get('/posts', (c) => c.json({ posts: store.list() }))

  api.post('/posts', async (c) => {
    const body = await readJsonBody(c)
    if (!body.ok) return fail(c, 400, 'invalid_json')
    if (!isPlainObject(body.value)) return fail(c, 400, 'invalid_body')

    const { author, content } = body.value
    // 字段给了但类型不对，是形状问题；字段缺失才交给 store 判内容空不空
    if (author !== undefined && typeof author !== 'string') return fail(c, 400, 'invalid_body')
    if (content !== undefined && typeof content !== 'string') return fail(c, 400, 'invalid_body')

    const result = store.create({ author, content })

    if (!result.ok) {
      return c.json({ error: { code: result.code, message: result.message } }, 400)
    }

    return c.json({ post: result.post }, 201)
  })

  api.patch('/posts/:id', async (c) => {
    const body = await readJsonBody(c)
    if (!body.ok) return fail(c, 400, 'invalid_json')
    if (!isPlainObject(body.value)) return fail(c, 400, 'invalid_body')

    const value = body.value
    const hasLiked = Object.prototype.hasOwnProperty.call(value, 'liked')
    const hasFavorited = Object.prototype.hasOwnProperty.call(value, 'favorited')

    // 至少要给一个字段，否则无从更新
    if (!hasLiked && !hasFavorited) return fail(c, 400, 'invalid_body')

    // 字段给了但类型不对是形状问题；未知字段一律忽略
    if (hasLiked && typeof value.liked !== 'boolean') return fail(c, 400, 'invalid_body')
    if (hasFavorited && typeof value.favorited !== 'boolean') return fail(c, 400, 'invalid_body')

    const patch: PostPatch = {}
    if (hasLiked) patch.liked = value.liked as boolean
    if (hasFavorited) patch.favorited = value.favorited as boolean

    // 只改一次，计数增减与幂等由 store 负责
    const post = store.update(c.req.param('id'), patch)
    if (!post) return fail(c, 404, 'not_found')

    return c.json({ post })
  })

  api.delete('/posts/:id', (c) => {
    if (!store.remove(c.req.param('id'))) return fail(c, 404, 'not_found')
    return c.body(null, 204)
  })

  api.delete('/posts', (c) => {
    store.clear()
    return c.body(null, 204)
  })

  app.route('/api', api)

  app.notFound((c) => fail(c, 404, 'route_not_found'))
  app.onError((_error, c) => fail(c, 500, 'internal_error'))

  return app
}
