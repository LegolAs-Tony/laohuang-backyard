// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  DEFAULT_AUTHOR,
  MAX_AUTHOR,
  MAX_CONTENT,
  createPostStore
} from '../../server/src/store'

afterEach(() => {
  vi.useRealTimers()
})

describe('内存 store · 基础', () => {
  it('新建时没有动态', () => {
    const store = createPostStore()
    expect(store.list()).toEqual([])
    expect(store.count()).toBe(0)
  })

  it('create 生成 id / createdAt / liked 默认值', () => {
    const store = createPostStore()
    const result = store.create({ author: '老黄', content: '今天种了番茄' })

    expect(result.ok).toBe(true)
    if (!result.ok) return

    expect(result.post.id).toMatch(/^[0-9a-f-]{36}$/)
    expect(result.post.author).toBe('老黄')
    expect(result.post.content).toBe('今天种了番茄')
    expect(typeof result.post.createdAt).toBe('number')
    expect(result.post.liked).toBe(false)
    expect(store.count()).toBe(1)
  })

  it('list 返回副本，改动不会污染内部数据', () => {
    const store = createPostStore()
    store.create({ author: '老黄', content: '第一条' })

    const snapshot = store.list()
    snapshot[0].content = '被外部改掉了'
    snapshot.push({
      id: 'x',
      author: 'x',
      content: 'x',
      createdAt: 0,
      liked: false
    })

    expect(store.list()).toHaveLength(1)
    expect(store.list()[0].content).toBe('第一条')
  })
})

describe('内存 store · 校验', () => {
  it('正文与署名首尾空白被裁剪', () => {
    const store = createPostStore()
    const result = store.create({ author: '  老黄  ', content: '  有空格  ' })

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.post.author).toBe('老黄')
    expect(result.post.content).toBe('有空格')
  })

  it('署名留空回退默认署名', () => {
    const store = createPostStore()
    const result = store.create({ author: '   ', content: '匿名一句' })

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.post.author).toBe(DEFAULT_AUTHOR)
  })

  it('署名超过上限被裁剪', () => {
    const store = createPostStore()
    const result = store.create({ author: '名'.repeat(MAX_AUTHOR + 5), content: '正文' })

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.post.author).toHaveLength(MAX_AUTHOR)
  })

  it('空正文返回 content_required 且不入库', () => {
    const store = createPostStore()
    const result = store.create({ author: '老黄', content: '   ' })

    expect(result).toEqual({
      ok: false,
      code: 'content_required',
      message: '院子里不能空着，先写点什么吧。'
    })
    expect(store.count()).toBe(0)
  })

  it('正文不是字符串同样按 content_required 处理', () => {
    const store = createPostStore()
    const result = store.create({ content: 42 as unknown as string })

    expect(result.ok).toBe(false)
    expect(store.count()).toBe(0)
  })

  it('正文超过上限返回 content_too_long', () => {
    const store = createPostStore()
    const result = store.create({ author: '老黄', content: 'x'.repeat(MAX_CONTENT + 1) })

    expect(result).toEqual({
      ok: false,
      code: 'content_too_long',
      message: `超过 ${MAX_CONTENT} 字了，删减一点再试。`
    })
    expect(store.count()).toBe(0)
  })

  it('恰好达到上限可以通过', () => {
    const store = createPostStore()
    const result = store.create({ author: '老黄', content: 'x'.repeat(MAX_CONTENT) })
    expect(result.ok).toBe(true)
  })
})

describe('内存 store · 排序与变更', () => {
  it('list 按 createdAt 倒序', () => {
    vi.useFakeTimers()
    const store = createPostStore()

    vi.setSystemTime(1_000)
    store.create({ author: '老黄', content: '早' })
    vi.setSystemTime(3_000)
    store.create({ author: '老黄', content: '晚' })
    vi.setSystemTime(2_000)
    store.create({ author: '老黄', content: '中' })

    expect(store.list().map((post) => post.content)).toEqual(['晚', '中', '早'])
  })

  it('setLiked 更新点赞并返回新对象', () => {
    const store = createPostStore()
    const created = store.create({ author: '老黄', content: '点赞我' })
    if (!created.ok) throw new Error('创建失败')

    const liked = store.setLiked(created.post.id, true)

    expect(liked?.liked).toBe(true)
    expect(store.list()[0].liked).toBe(true)
    expect(store.setLiked(created.post.id, false)?.liked).toBe(false)
  })

  it('setLiked 找不到 id 返回 null', () => {
    const store = createPostStore()
    expect(store.setLiked('nope', true)).toBeNull()
  })

  it('remove 删除存在的动态返回 true，重复删除返回 false', () => {
    const store = createPostStore()
    const created = store.create({ author: '老黄', content: '删我' })
    if (!created.ok) throw new Error('创建失败')

    expect(store.remove(created.post.id)).toBe(true)
    expect(store.count()).toBe(0)
    expect(store.remove(created.post.id)).toBe(false)
  })

  it('clear 清空全部', () => {
    const store = createPostStore()
    store.create({ author: 'a', content: '1' })
    store.create({ author: 'b', content: '2' })

    store.clear()

    expect(store.list()).toEqual([])
    expect(store.count()).toBe(0)
  })

  it('两个 store 实例互不影响', () => {
    const first = createPostStore()
    const second = createPostStore()
    first.create({ author: '老黄', content: '只属于第一个' })

    expect(first.count()).toBe(1)
    expect(second.count()).toBe(0)
  })
})
