import { describe, expect, it, vi } from 'vitest'
import { createPost, deletePost, fetchPosts, updatePostLiked } from '@/lib/api'
import type { Post } from '@/lib/posts'

const post: Post = {
  id: 'p1',
  author: '老黄',
  content: '番茄红了',
  createdAt: 1_700_000_000_000,
  liked: false
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' }
  })
}

function stubFetch(handler: (input: string, init?: RequestInit) => Promise<Response>) {
  const mock = vi.fn(handler)
  vi.stubGlobal('fetch', mock)
  return mock
}

describe('fetchPosts', () => {
  it('GET /api/posts 并返回列表', async () => {
    const mock = stubFetch(async () => jsonResponse({ posts: [post] }))

    const result = await fetchPosts()

    expect(result).toEqual({ ok: true, data: [post] })
    expect(mock.mock.calls[0][0]).toBe('/api/posts')
  })

  it('服务端错误时透出 error.message', async () => {
    stubFetch(async () =>
      jsonResponse({ error: { code: 'internal_error', message: '服务端出了点问题，请稍后重试。' } }, 500)
    )

    const result = await fetchPosts()

    expect(result).toEqual({ ok: false, error: '服务端出了点问题，请稍后重试。' })
  })

  it('网络异常时给中文兜底文案', async () => {
    stubFetch(async () => {
      throw new TypeError('Failed to fetch')
    })

    expect(await fetchPosts()).toEqual({ ok: false, error: '拿不到院子里的内容，请检查网络后再试。' })
  })

  it('响应结构不对时给兜底文案', async () => {
    stubFetch(async () => jsonResponse({ posts: 'oops' }))

    expect(await fetchPosts()).toEqual({ ok: false, error: '拿不到院子里的内容，请检查网络后再试。' })
  })

  it('列表里混入结构不合法的元素时给兜底文案', async () => {
    stubFetch(async () => jsonResponse({ posts: [{ id: 1, content: '缺字段' }] }))

    expect(await fetchPosts()).toEqual({ ok: false, error: '拿不到院子里的内容，请检查网络后再试。' })
  })

  it('错误体不是 JSON 时给兜底文案', async () => {
    stubFetch(async () => new Response('<html>500</html>', { status: 500 }))

    expect(await fetchPosts()).toEqual({ ok: false, error: '拿不到院子里的内容，请检查网络后再试。' })
  })
})

describe('createPost', () => {
  it('POST JSON 得体并返回新动态', async () => {
    const mock = stubFetch(async () => jsonResponse({ post }, 201))

    const result = await createPost({ author: '老黄', content: '番茄红了' })

    expect(result).toEqual({ ok: true, data: post })
    const [url, init] = mock.mock.calls[0]
    expect(url).toBe('/api/posts')
    expect(init).toMatchObject({
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ author: '老黄', content: '番茄红了' })
    })
  })

  it('校验失败时用服务端文案', async () => {
    stubFetch(async () =>
      jsonResponse({ error: { code: 'content_too_long', message: '超过 500 字了，删减一点再试。' } }, 400)
    )

    expect(await createPost({ author: '老黄', content: 'x' })).toEqual({
      ok: false,
      error: '超过 500 字了，删减一点再试。'
    })
  })

  it('网络异常时给写入兜底文案', async () => {
    stubFetch(async () => {
      throw new TypeError('Failed to fetch')
    })

    expect(await createPost({ author: '老黄', content: 'x' })).toEqual({
      ok: false,
      error: '保存失败，请检查网络后再试。'
    })
  })

  it('返回的 post 缺字段时给兜底文案', async () => {
    stubFetch(async () => jsonResponse({ post: { id: 'p1' } }, 201))

    expect(await createPost({ author: '老黄', content: 'x' })).toEqual({
      ok: false,
      error: '保存失败，请检查网络后再试。'
    })
  })
})

describe('updatePostLiked', () => {
  it('PATCH 指定 id 并带上 liked', async () => {
    const liked = { ...post, liked: true }
    const mock = stubFetch(async () => jsonResponse({ post: liked }))

    const result = await updatePostLiked('p1', true)

    expect(result).toEqual({ ok: true, data: liked })
    const [url, init] = mock.mock.calls[0]
    expect(url).toBe('/api/posts/p1')
    expect(init).toMatchObject({ method: 'PATCH', body: JSON.stringify({ liked: true }) })
  })

  it('id 会被 URL 编码', async () => {
    const mock = stubFetch(async () => jsonResponse({ post }))

    await updatePostLiked('a/b', false)

    expect(mock.mock.calls[0][0]).toBe('/api/posts/a%2Fb')
  })

  it('404 时透出「已经不在院子里了」', async () => {
    stubFetch(async () =>
      jsonResponse({ error: { code: 'not_found', message: '这条已经不在院子里了。' } }, 404)
    )

    expect(await updatePostLiked('nope', true)).toEqual({ ok: false, error: '这条已经不在院子里了。' })
  })
})

describe('deletePost', () => {
  it('DELETE 成功返回 null（204 无响应体）', async () => {
    const mock = stubFetch(async () => new Response(null, { status: 204 }))

    expect(await deletePost('p1')).toEqual({ ok: true, data: null })
    expect(mock.mock.calls[0][0]).toBe('/api/posts/p1')
    expect((mock.mock.calls[0][1] as RequestInit).method).toBe('DELETE')
  })

  it('网络异常时给删除兜底文案', async () => {
    stubFetch(async () => {
      throw new TypeError('Failed to fetch')
    })

    expect(await deletePost('p1')).toEqual({ ok: false, error: '删除失败，请检查网络后再试。' })
  })
})
