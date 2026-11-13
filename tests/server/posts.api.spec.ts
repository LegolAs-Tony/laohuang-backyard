// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createApp } from '../../server/src/app'
import { createPostStore } from '../../server/src/store'
import type { PostStore } from '../../server/src/store'

let app: ReturnType<typeof createApp>
let store: PostStore

const json = (body: unknown): RequestInit => ({
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: typeof body === 'string' ? body : JSON.stringify(body)
})

async function listPosts(): Promise<{ posts: Array<Record<string, unknown>> }> {
  const response = await app.request('/api/posts')
  return (await response.json()) as { posts: Array<Record<string, unknown>> }
}

beforeEach(() => {
  store = createPostStore()
  app = createApp({ store })
})

afterEach(() => {
  vi.useRealTimers()
})

describe('GET /api/posts', () => {
  it('空集合返回 200 与空数组', async () => {
    const response = await app.request('/api/posts')

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ posts: [] })
  })

  it('按 createdAt 倒序返回', async () => {
    vi.useFakeTimers()

    vi.setSystemTime(1_000)
    await app.request('/api/posts', json({ author: '老黄', content: '早' }))
    vi.setSystemTime(3_000)
    await app.request('/api/posts', json({ author: '老黄', content: '晚' }))
    vi.setSystemTime(2_000)
    await app.request('/api/posts', json({ author: '老黄', content: '中' }))

    const { posts } = await listPosts()
    expect(posts.map((post) => post.content)).toEqual(['晚', '中', '早'])
  })
})

describe('POST /api/posts', () => {
  it('创建成功返回 201 与完整字段', async () => {
    const response = await app.request('/api/posts', json({ author: '老黄', content: '今天种了番茄' }))

    expect(response.status).toBe(201)
    const { post } = (await response.json()) as { post: Record<string, unknown> }
    expect(post).toMatchObject({
      author: '老黄',
      content: '今天种了番茄',
      liked: false,
      likes: 0,
      favorited: false
    })
    expect(typeof post.id).toBe('string')
    expect(typeof post.createdAt).toBe('number')

    const { posts } = await listPosts()
    expect(posts).toHaveLength(1)
    expect(posts[0].content).toBe('今天种了番茄')
  })

  it('署名留空回退「花园访客」', async () => {
    const response = await app.request('/api/posts', json({ content: '匿名一句' }))
    const { post } = (await response.json()) as { post: Record<string, unknown> }

    expect(response.status).toBe(201)
    expect(post.author).toBe('花园访客')
  })

  it('正文与署名首尾空白被裁剪', async () => {
    const response = await app.request('/api/posts', json({ author: '  老黄  ', content: '  有空格  ' }))
    const { post } = (await response.json()) as { post: Record<string, unknown> }

    expect(post.author).toBe('老黄')
    expect(post.content).toBe('有空格')
  })

  it('署名超长被裁到 20 字', async () => {
    const response = await app.request('/api/posts', json({ author: '名'.repeat(30), content: '正文' }))
    const { post } = (await response.json()) as { post: Record<string, unknown> }

    expect((post.author as string)).toHaveLength(20)
  })

  it('正文为空返回 400 content_required 且不落库', async () => {
    const response = await app.request('/api/posts', json({ author: '老黄', content: '   ' }))

    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({
      error: { code: 'content_required', message: '院子里不能空着，先写点什么吧。' }
    })
    expect(store.count()).toBe(0)
  })

  it('正文超过 500 字返回 400 content_too_long', async () => {
    const response = await app.request('/api/posts', json({ author: '老黄', content: 'x'.repeat(501) }))

    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({
      error: { code: 'content_too_long', message: '超过 500 字了，删减一点再试。' }
    })
    expect(store.count()).toBe(0)
  })

  it('非法 JSON 返回 400 invalid_json', async () => {
    const response = await app.request('/api/posts', json('{broken'))

    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({
      error: { code: 'invalid_json', message: '请求格式不对，请重试。' }
    })
    expect(store.count()).toBe(0)
  })

  it('合法 JSON 但不是对象时按 invalid_body 处理', async () => {
    for (const body of ['[]', '"x"', 'null', '42']) {
      const response = await app.request('/api/posts', json(body))

      expect(response.status).toBe(400)
      expect(await response.json()).toEqual({
        error: { code: 'invalid_body', message: '请求格式不对，请重试。' }
      })
    }

    expect(store.count()).toBe(0)
  })

  it('content 存在但不是字符串时按 invalid_body 处理', async () => {
    const response = await app.request('/api/posts', json({ author: '老黄', content: 123 }))

    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({
      error: { code: 'invalid_body', message: '请求格式不对，请重试。' }
    })
    expect(store.count()).toBe(0)
  })
})

describe('PATCH /api/posts/:id', () => {
  async function seedPost(content = '点赞我'): Promise<string> {
    const response = await app.request('/api/posts', json({ author: '老黄', content }))
    const { post } = (await response.json()) as { post: { id: string } }
    return post.id
  }

  it('切换点赞返回 200 并在列表里生效', async () => {
    const id = await seedPost()

    const liked = await app.request(`/api/posts/${id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ liked: true })
    })

    expect(liked.status).toBe(200)
    const { post } = (await liked.json()) as { post: Record<string, unknown> }
    expect(post.liked).toBe(true)
    expect((await listPosts()).posts[0].liked).toBe(true)

    const unliked = await app.request(`/api/posts/${id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ liked: false })
    })
    expect(((await unliked.json()) as { post: Record<string, unknown> }).post.liked).toBe(false)
  })

  it('id 不存在返回 404 not_found', async () => {
    const response = await app.request('/api/posts/nope', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ liked: true })
    })

    expect(response.status).toBe(404)
    expect(await response.json()).toEqual({
      error: { code: 'not_found', message: '这条已经不在院子里了。' }
    })
  })

  it('缺少 liked 或类型不对返回 400 invalid_body', async () => {
    const id = await seedPost()

    for (const body of [{}, { liked: 'yes' }]) {
      const response = await app.request(`/api/posts/${id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body)
      })

      expect(response.status).toBe(400)
      expect(await response.json()).toEqual({
        error: { code: 'invalid_body', message: '请求格式不对，请重试。' }
      })
    }
  })

  it('点赞时 likes 计数加一，取消时减一', async () => {
    const id = await seedPost()

    const liked = await app.request(`/api/posts/${id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ liked: true })
    })
    const likedPost = ((await liked.json()) as { post: Record<string, unknown> }).post
    expect(liked.status).toBe(200)
    expect(likedPost).toMatchObject({ liked: true, likes: 1 })

    const unliked = await app.request(`/api/posts/${id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ liked: false })
    })
    const unlikedPost = ((await unliked.json()) as { post: Record<string, unknown> }).post
    expect(unlikedPost).toMatchObject({ liked: false, likes: 0 })
    expect((await listPosts()).posts[0]).toMatchObject({ liked: false, likes: 0 })
  })

  it('重复提交相同 liked 值幂等，likes 不重复累加', async () => {
    const id = await seedPost()
    const body = JSON.stringify({ liked: true })

    await app.request(`/api/posts/${id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body
    })
    const again = await app.request(`/api/posts/${id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body
    })

    expect(((await again.json()) as { post: Record<string, unknown> }).post.likes).toBe(1)
  })

  it('只给 favorited 时收藏成功且不影响 liked', async () => {
    const id = await seedPost()

    const response = await app.request(`/api/posts/${id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ favorited: true })
    })

    expect(response.status).toBe(200)
    const { post } = (await response.json()) as { post: Record<string, unknown> }
    expect(post).toMatchObject({ favorited: true, liked: false, likes: 0 })
    expect((await listPosts()).posts[0].favorited).toBe(true)
  })

  it('收藏可以取消，重复取消幂等', async () => {
    const id = await seedPost()
    const patch = (favorited: boolean) =>
      app.request(`/api/posts/${id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ favorited })
      })

    await patch(true)
    expect(((await (await patch(true)).json()) as { post: Record<string, unknown> }).post.favorited).toBe(true)
    expect(((await (await patch(false)).json()) as { post: Record<string, unknown> }).post.favorited).toBe(false)
    expect(((await (await patch(false)).json()) as { post: Record<string, unknown> }).post.favorited).toBe(false)
  })

  it('同时给 liked 与 favorited 时一次更新两个字段', async () => {
    const id = await seedPost()

    const response = await app.request(`/api/posts/${id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ liked: true, favorited: true })
    })

    expect(response.status).toBe(200)
    const { post } = (await response.json()) as { post: Record<string, unknown> }
    expect(post).toMatchObject({ liked: true, likes: 1, favorited: true })
    expect((await listPosts()).posts[0]).toMatchObject({ liked: true, likes: 1, favorited: true })
  })

  it('两个字段都不给返回 400 invalid_body 且不改状态', async () => {
    const id = await seedPost()

    for (const body of [{}, { liked: undefined, favorited: undefined }]) {
      const response = await app.request(`/api/posts/${id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body)
      })

      expect(response.status).toBe(400)
      expect(await response.json()).toEqual({
        error: { code: 'invalid_body', message: '请求格式不对，请重试。' }
      })
    }

    expect((await listPosts()).posts[0]).toMatchObject({ liked: false, favorited: false, likes: 0 })
  })

  it('liked 或 favorited 不是 boolean 时返回 400 invalid_body', async () => {
    const id = await seedPost()

    for (const body of [
      { liked: 'yes' },
      { liked: 1 },
      { liked: null },
      { favorited: 'yes' },
      { favorited: 0 },
      { liked: true, favorited: 'yes' }
    ]) {
      const response = await app.request(`/api/posts/${id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body)
      })

      expect(response.status).toBe(400)
      expect(await response.json()).toEqual({
        error: { code: 'invalid_body', message: '请求格式不对，请重试。' }
      })
    }

    expect((await listPosts()).posts[0]).toMatchObject({ liked: false, likes: 0, favorited: false })
  })

  it('未知字段被忽略，仍然按已知字段更新并返回 200', async () => {
    const id = await seedPost()

    const response = await app.request(`/api/posts/${id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ favorited: true, likes: 99, author: '别人', nope: 'x' })
    })

    expect(response.status).toBe(200)
    const { post } = (await response.json()) as { post: Record<string, unknown> }
    expect(post).toMatchObject({ favorited: true, liked: false, likes: 0, author: '老黄' })
  })

  it('收藏与点赞都作用于对应 id，不影响其他动态', async () => {
    const first = await seedPost('第一条')
    const second = await seedPost('第二条')

    await app.request(`/api/posts/${first}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ liked: true, favorited: true })
    })

    const { posts } = await listPosts()
    const target = posts.find((post) => post.id === first)
    const other = posts.find((post) => post.id === second)

    expect(target).toMatchObject({ liked: true, likes: 1, favorited: true })
    expect(other).toMatchObject({ liked: false, likes: 0, favorited: false })
  })
})

describe('DELETE /api/posts', () => {
  it('删除单条返回 204 空体，再删同一条返回 404', async () => {
    const created = await app.request('/api/posts', json({ author: '老黄', content: '删我' }))
    const { post } = (await created.json()) as { post: { id: string } }

    const removed = await app.request(`/api/posts/${post.id}`, { method: 'DELETE' })

    expect(removed.status).toBe(204)
    expect(await removed.text()).toBe('')
    expect((await listPosts()).posts).toEqual([])

    const again = await app.request(`/api/posts/${post.id}`, { method: 'DELETE' })
    expect(again.status).toBe(404)
    expect(await again.json()).toEqual({
      error: { code: 'not_found', message: '这条已经不在院子里了。' }
    })
  })

  it('DELETE /api/posts 清空集合', async () => {
    await app.request('/api/posts', json({ author: '老黄', content: '1' }))
    await app.request('/api/posts', json({ author: '老黄', content: '2' }))

    const response = await app.request('/api/posts', { method: 'DELETE' })

    expect(response.status).toBe(204)
    expect(store.count()).toBe(0)
  })
})

describe('其他', () => {
  it('GET /api/health 返回状态与条数', async () => {
    await app.request('/api/posts', json({ author: '老黄', content: '一条' }))

    const response = await app.request('/api/health')

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ status: 'ok', posts: 1 })
  })

  it('未知 /api 路由返回 404 与统一错误体', async () => {
    const response = await app.request('/api/nope')

    expect(response.status).toBe(404)
    expect(await response.json()).toEqual({
      error: { code: 'route_not_found', message: '没有这个接口。' }
    })
  })
})
