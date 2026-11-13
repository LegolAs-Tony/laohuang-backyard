import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { AUTHOR_KEY, readAuthor } from '@/lib/preferences'
import { DEFAULT_AUTHOR, MAX_CONTENT } from '@/lib/posts'
import type { Post } from '@/lib/posts'
import { usePostsStore } from '@/stores/posts'
import { installFakeApi } from '../helpers/fake-api'
import type { FakeApi } from '../helpers/fake-api'

async function freshStore(
  seed: Partial<Post>[] = []
): Promise<{ store: ReturnType<typeof usePostsStore>; api: FakeApi }> {
  const api = installFakeApi(seed)
  setActivePinia(createPinia())
  const store = usePostsStore()
  await store.init()
  return { store, api }
}

/** 只关心写请求：初始化那一次 GET 不算 */
function writes(api: FakeApi): FakeApi['calls'] {
  return api.calls.filter((call) => call.method !== 'GET')
}

beforeEach(() => {
  setActivePinia(createPinia())
})

describe('初始化', () => {
  it('从接口读入动态与本地署名', async () => {
    window.localStorage.setItem(AUTHOR_KEY, '阿棠')
    const { store } = await freshStore([{ content: '院子里的绣球开了' }])

    expect(store.posts).toHaveLength(1)
    expect(store.author).toBe('阿棠')
    expect(store.error).toBeNull()
  })

  it('接口不可用时置空并给出提示', async () => {
    const api = installFakeApi([{ content: '拿不到' }])
    api.failMode = 'server'
    setActivePinia(createPinia())
    const store = usePostsStore()

    await store.init()

    expect(store.posts).toEqual([])
    expect(store.error).toBeTruthy()
  })

  it('reload 会重新拉取（替代原来的多标签同步）', async () => {
    const { store, api } = await freshStore()
    expect(store.posts).toEqual([])

    api.posts = [
      {
        id: 'p9',
        author: '老黄',
        content: '另一页写入的',
        createdAt: 1_700_000_000_000,
        liked: false
      }
    ]

    await store.reload()

    expect(store.posts).toHaveLength(1)
    expect(store.posts[0].content).toBe('另一页写入的')
  })

  it('重新拉取失败时保留已有列表，只给出提示', async () => {
    const { store, api } = await freshStore([{ content: '已经看到的' }])
    api.failMode = 'server'

    await store.reload()

    expect(store.posts).toHaveLength(1)
    expect(store.error).toBeTruthy()
  })
})

describe('发布', () => {
  it('提交成功后追加到列表并记住署名', async () => {
    const { store, api } = await freshStore()

    const result = await store.addPost({ author: '老黄', content: '今天种了番茄' })

    expect(result.ok).toBe(true)
    expect(store.posts).toHaveLength(1)
    expect(store.posts[0]).toMatchObject({ author: '老黄', content: '今天种了番茄', liked: false })
    expect(store.author).toBe('老黄')
    expect(readAuthor()).toBe('老黄')
    expect(api.calls.at(-1)).toMatchObject({
      url: '/api/posts',
      method: 'POST',
      body: { author: '老黄', content: '今天种了番茄' }
    })
  })

  it('正文与署名首尾空白被裁剪后再提交', async () => {
    const { store, api } = await freshStore()

    await store.addPost({ author: '  老黄  ', content: '  有空格  ' })

    expect(api.calls.at(-1)?.body).toEqual({ author: '老黄', content: '有空格' })
    expect(store.posts[0].content).toBe('有空格')
  })

  it('署名留空时由服务端回退默认署名', async () => {
    const { store, api } = await freshStore()

    await store.addPost({ author: '   ', content: '匿名一句' })

    expect(api.calls.at(-1)?.body).toEqual({ author: '', content: '匿名一句' })
    expect(store.posts[0].author).toBe(DEFAULT_AUTHOR)
  })

  it('留空署名发布不会覆盖已记住的署名', async () => {
    window.localStorage.setItem(AUTHOR_KEY, '阿棠')
    const { store } = await freshStore()

    await store.addPost({ author: '', content: '匿名一句' })

    expect(store.posts[0].author).toBe(DEFAULT_AUTHOR)
    expect(readAuthor()).toBe('阿棠')
  })

  it('空内容被拒绝且不发请求', async () => {
    const { store, api } = await freshStore()

    const result = await store.addPost({ author: '老黄', content: '   ' })

    expect(result.ok).toBe(false)
    expect(result.error).toBeTruthy()
    expect(store.posts).toEqual([])
    expect(writes(api)).toHaveLength(0)
  })

  it('超过字数上限被拒绝且不发请求', async () => {
    const { store, api } = await freshStore()

    const result = await store.addPost({ author: '老黄', content: 'x'.repeat(MAX_CONTENT + 1) })

    expect(result.ok).toBe(false)
    expect(store.posts).toEqual([])
    expect(writes(api)).toHaveLength(0)
  })

  it('服务端拒绝时保持列表不变并返回错误', async () => {
    const { store, api } = await freshStore()
    api.failMode = 'server'

    const result = await store.addPost({ author: '老黄', content: '写不进去' })

    expect(result.ok).toBe(false)
    expect(result.error).toBeTruthy()
    expect(store.posts).toEqual([])
    expect(store.error).toBe(result.error)
  })

  it('当前筛选会隐藏这条时自动清空关键词', async () => {
    const { store } = await freshStore()
    store.setKeyword('番茄')

    await store.addPost({ author: '老黄', content: '黄瓜熟了' })

    expect(store.keyword).toBe('')
  })

  it('当前筛选能命中新内容时保留关键词', async () => {
    const { store } = await freshStore()
    store.setKeyword('番茄')

    await store.addPost({ author: '老黄', content: '番茄红了' })

    expect(store.keyword).toBe('番茄')
  })
})

describe('点赞', () => {
  it('切换点赞并同步到服务端', async () => {
    const { store, api } = await freshStore([{ id: 'p1', liked: false }])

    const result = await store.toggleLike('p1')

    expect(result.ok).toBe(true)
    expect(store.posts[0].liked).toBe(true)
    expect(api.calls.at(-1)).toMatchObject({
      url: '/api/posts/p1',
      method: 'PATCH',
      body: { liked: true }
    })

    await store.toggleLike('p1')
    expect(store.posts[0].liked).toBe(false)
  })

  it('连点两次只发一次请求，不会互相覆盖', async () => {
    const { store, api } = await freshStore([{ id: 'p1', liked: false }])

    const [first, second] = await Promise.all([store.toggleLike('p1'), store.toggleLike('p1')])

    expect(first.ok).toBe(true)
    expect(second.ok).toBe(false)
    expect(writes(api).filter((call) => call.method === 'PATCH')).toHaveLength(1)
    expect(store.posts[0].liked).toBe(true)
  })

  it('成功后清空上一次的错误提示', async () => {
    const { store, api } = await freshStore([{ id: 'p1' }])
    api.failMode = 'server'
    await store.toggleLike('p1')
    expect(store.error).toBeTruthy()

    api.failMode = 'none'
    const result = await store.toggleLike('p1')

    expect(result.ok).toBe(true)
    expect(store.error).toBeNull()
  })

  it('id 不存在时不做任何改动也不发请求', async () => {
    const { store, api } = await freshStore([{ id: 'p1' }])

    const result = await store.toggleLike('nope')

    expect(result.ok).toBe(false)
    expect(store.posts).toHaveLength(1)
    expect(store.posts[0].liked).toBe(false)
    expect(writes(api)).toHaveLength(0)
  })

  it('服务端失败时状态不乱改', async () => {
    const { store, api } = await freshStore([{ id: 'p1', liked: false }])
    api.failMode = 'server'

    const result = await store.toggleLike('p1')

    expect(result.ok).toBe(false)
    expect(store.posts[0].liked).toBe(false)
    expect(store.error).toBeTruthy()
  })
})

describe('删除', () => {
  it('删除成功后从列表移除', async () => {
    const { store, api } = await freshStore([{ id: 'p1' }, { id: 'p2' }])

    const result = await store.removePost('p1')

    expect(result.ok).toBe(true)
    expect(store.posts.map((post) => post.id)).toEqual(['p2'])
    expect(api.calls.at(-1)).toMatchObject({ url: '/api/posts/p1', method: 'DELETE' })
  })

  it('删除失败时保留原数据', async () => {
    const { store, api } = await freshStore([{ id: 'p1' }])
    api.failMode = 'server'

    const result = await store.removePost('p1')

    expect(result.ok).toBe(false)
    expect(store.posts).toHaveLength(1)
    expect(store.error).toBeTruthy()
  })
})

describe('排序与筛选', () => {
  it('按时间倒序排列', async () => {
    const { store } = await freshStore([
      { id: 'old', createdAt: 1000 },
      { id: 'new', createdAt: 3000 },
      { id: 'mid', createdAt: 2000 }
    ])

    expect(store.sortedPosts.map((post) => post.id)).toEqual(['new', 'mid', 'old'])
  })

  it('关键词对正文与署名都生效且大小写不敏感', async () => {
    const { store } = await freshStore([
      { id: 'a', author: '老黄', content: '番茄红了' },
      { id: 'b', author: 'VueFan', content: '换了个水培灯' }
    ])

    store.setKeyword('番茄')
    expect(store.visiblePosts.map((post) => post.id)).toEqual(['a'])

    store.setKeyword('vuefan')
    expect(store.visiblePosts.map((post) => post.id)).toEqual(['b'])
  })

  it('统计总数与命中数', async () => {
    const { store } = await freshStore([{ id: 'a', content: '番茄' }, { id: 'b', content: '黄瓜' }])

    expect(store.total).toBe(2)
    expect(store.matchCount).toBe(2)
  })

  it('关键词为空时命中数等于总数', async () => {
    const { store } = await freshStore([{ id: 'a' }, { id: 'b' }])

    store.setKeyword('番茄')
    store.clearKeyword()

    expect(store.keyword).toBe('')
    expect(store.matchCount).toBe(2)
    expect(store.visiblePosts).toHaveLength(2)
  })

  it('空态与无结果态是两种不同状态', async () => {
    const empty = await freshStore()
    expect(empty.store.isEmpty).toBe(true)
    expect(empty.store.isNoResult).toBe(false)

    const filled = await freshStore([{ id: 'a', content: '黄瓜' }])
    filled.store.setKeyword('番茄')

    expect(filled.store.isEmpty).toBe(false)
    expect(filled.store.isNoResult).toBe(true)
  })

  it('有关键词但仍有命中时不算无结果', async () => {
    const { store } = await freshStore([{ id: 'a', content: '番茄' }])
    store.setKeyword('番茄')

    expect(store.isNoResult).toBe(false)
  })
})

describe('错误状态', () => {
  it('clearError 可以清空提示', async () => {
    const api = installFakeApi([{ content: '拿不到' }])
    api.failMode = 'server'
    setActivePinia(createPinia())
    const store = usePostsStore()
    await store.init()
    expect(store.error).toBeTruthy()

    store.clearError()

    expect(store.error).toBeNull()
  })
})
