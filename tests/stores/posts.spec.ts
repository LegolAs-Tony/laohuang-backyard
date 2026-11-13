import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { AUTHOR_KEY, DEFAULT_AUTHOR, MAX_CONTENT, POSTS_KEY, readAuthor } from '@/lib/storage'
import type { Post } from '@/lib/storage'
import { usePostsStore } from '@/stores/posts'

function seed(posts: Partial<Post>[]): void {
  window.localStorage.setItem(
    POSTS_KEY,
    JSON.stringify(
      posts.map((post, index) => ({
        id: post.id ?? `p${index}`,
        author: post.author ?? '老黄',
        content: post.content ?? `第 ${index} 条`,
        createdAt: post.createdAt ?? 1_700_000_000_000 + index,
        liked: post.liked ?? false
      }))
    )
  )
}

function freshStore() {
  setActivePinia(createPinia())
  const store = usePostsStore()
  store.init()
  return store
}

beforeEach(() => {
  setActivePinia(createPinia())
})

describe('初始化', () => {
  it('从本地存储读入动态与署名', () => {
    seed([{ content: '院子里的绣球开了' }])
    window.localStorage.setItem(AUTHOR_KEY, '阿棠')

    const store = freshStore()

    expect(store.posts).toHaveLength(1)
    expect(store.author).toBe('阿棠')
    expect(store.error).toBeNull()
  })

  it('存储数据损坏时置空并给出提示', () => {
    window.localStorage.setItem(POSTS_KEY, '{broken')

    const store = freshStore()

    expect(store.posts).toEqual([])
    expect(store.error).toBeTruthy()
  })

  it('reload 会重新读取存储（用于多标签同步）', () => {
    const store = freshStore()
    seed([{ content: '另一页写入的' }])

    store.reload()

    expect(store.posts).toHaveLength(1)
    expect(store.posts[0].content).toBe('另一页写入的')
  })
})

describe('发布', () => {
  it('追加一条并写入存储', () => {
    const store = freshStore()

    const result = store.addPost({ author: '老黄', content: '今天种了番茄' })

    expect(result.ok).toBe(true)
    expect(store.posts).toHaveLength(1)
    expect(store.posts[0]).toMatchObject({
      author: '老黄',
      content: '今天种了番茄',
      liked: false
    })
    expect(JSON.parse(window.localStorage.getItem(POSTS_KEY) ?? '[]')).toHaveLength(1)
  })

  it('正文与署名首尾空白被裁剪', () => {
    const store = freshStore()
    store.addPost({ author: '  老黄  ', content: '  有空格  ' })
    expect(store.posts[0].author).toBe('老黄')
    expect(store.posts[0].content).toBe('有空格')
  })

  it('署名留空时回退默认署名', () => {
    const store = freshStore()
    store.addPost({ author: '   ', content: '匿名一句' })
    expect(store.posts[0].author).toBe(DEFAULT_AUTHOR)
  })

  it('署名会被记住', () => {
    const store = freshStore()
    store.addPost({ author: '阿棠', content: '记住我' })
    expect(store.author).toBe('阿棠')
    expect(readAuthor()).toBe('阿棠')
  })

  it('空内容被拒绝，不写入存储', () => {
    const store = freshStore()

    const result = store.addPost({ author: '老黄', content: '   ' })

    expect(result.ok).toBe(false)
    expect(result.error).toBeTruthy()
    expect(store.posts).toEqual([])
    expect(window.localStorage.getItem(POSTS_KEY)).toBeNull()
  })

  it('超过字数上限被拒绝', () => {
    const store = freshStore()

    const result = store.addPost({ author: '老黄', content: 'x'.repeat(MAX_CONTENT + 1) })

    expect(result.ok).toBe(false)
    expect(store.posts).toEqual([])
  })

  it('写入失败时状态回滚并返回错误', () => {
    const store = freshStore()
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      const error = new Error('quota')
      error.name = 'QuotaExceededError'
      throw error
    })

    const result = store.addPost({ author: '老黄', content: '写不进去' })

    expect(result.ok).toBe(false)
    expect(result.error).toBeTruthy()
    expect(store.posts).toEqual([])
  })

  it('当前筛选会隐藏这条时，自动清空关键词', () => {
    const store = freshStore()
    store.setKeyword('番茄')

    store.addPost({ author: '老黄', content: '黄瓜熟了' })

    expect(store.keyword).toBe('')
  })

  it('当前筛选能命中新内容时保留关键词', () => {
    const store = freshStore()
    store.setKeyword('番茄')

    store.addPost({ author: '老黄', content: '番茄红了' })

    expect(store.keyword).toBe('番茄')
  })
})

describe('点赞', () => {
  it('切换点赞状态并持久化', () => {
    seed([{ id: 'p1', liked: false }])
    const store = freshStore()

    store.toggleLike('p1')

    expect(store.posts[0].liked).toBe(true)
    expect(JSON.parse(window.localStorage.getItem(POSTS_KEY) ?? '[]')[0].liked).toBe(true)

    store.toggleLike('p1')
    expect(store.posts[0].liked).toBe(false)
  })

  it('id 不存在时不做任何改动', () => {
    seed([{ id: 'p1' }])
    const store = freshStore()

    store.toggleLike('nope')

    expect(store.posts).toHaveLength(1)
    expect(store.posts[0].liked).toBe(false)
  })
})

describe('删除', () => {
  it('删除指定动态并持久化', () => {
    seed([{ id: 'p1' }, { id: 'p2' }])
    const store = freshStore()

    const result = store.removePost('p1')

    expect(result.ok).toBe(true)
    expect(store.posts.map((post) => post.id)).toEqual(['p2'])
    expect(JSON.parse(window.localStorage.getItem(POSTS_KEY) ?? '[]')).toHaveLength(1)
  })
})

describe('排序与筛选', () => {
  it('按时间倒序排列', () => {
    seed([
      { id: 'old', createdAt: 1000 },
      { id: 'new', createdAt: 3000 },
      { id: 'mid', createdAt: 2000 }
    ])
    const store = freshStore()
    expect(store.sortedPosts.map((post) => post.id)).toEqual(['new', 'mid', 'old'])
  })

  it('关键词对正文与署名都生效且大小写不敏感', () => {
    seed([
      { id: 'a', author: '老黄', content: '番茄红了' },
      { id: 'b', author: 'VueFan', content: '换了个水培灯' }
    ])
    const store = freshStore()

    store.setKeyword('番茄')
    expect(store.visiblePosts.map((post) => post.id)).toEqual(['a'])

    store.setKeyword('vuefan')
    expect(store.visiblePosts.map((post) => post.id)).toEqual(['b'])
  })

  it('统计总数与命中数', () => {
    seed([{ id: 'a', content: '番茄' }, { id: 'b', content: '黄瓜' }])
    const store = freshStore()

    expect(store.total).toBe(2)
    expect(store.matchCount).toBe(2)
  })

  it('关键词为空时命中数等于总数', () => {
    seed([{ id: 'a' }, { id: 'b' }])
    const store = freshStore()

    store.setKeyword('番茄')
    store.clearKeyword()

    expect(store.keyword).toBe('')
    expect(store.matchCount).toBe(2)
    expect(store.visiblePosts).toHaveLength(2)
  })

  it('空态与无结果态是两种不同状态', () => {
    const empty = freshStore()
    expect(empty.isEmpty).toBe(true)
    expect(empty.isNoResult).toBe(false)

    seed([{ id: 'a', content: '黄瓜' }])
    const store = freshStore()
    store.setKeyword('番茄')

    expect(store.isEmpty).toBe(false)
    expect(store.isNoResult).toBe(true)
  })

  it('有关键词但仍有命中时不算无结果', () => {
    seed([{ id: 'a', content: '番茄' }])
    const store = freshStore()
    store.setKeyword('番茄')

    expect(store.isNoResult).toBe(false)
  })
})

describe('错误状态', () => {
  it('clearError 可以清空提示', () => {
    window.localStorage.setItem(POSTS_KEY, '{broken')
    const store = freshStore()
    expect(store.error).toBeTruthy()

    store.clearError()

    expect(store.error).toBeNull()
  })
})
