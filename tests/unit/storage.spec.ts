import { describe, expect, it, vi } from 'vitest'
import {
  AUTHOR_KEY,
  DEFAULT_AUTHOR,
  MAX_AUTHOR,
  MAX_CONTENT,
  POSTS_KEY,
  createId,
  readAuthor,
  readPosts,
  writeAuthor,
  writePosts
} from '@/lib/storage'
import type { Post } from '@/lib/storage'

function makePost(overrides: Partial<Post> = {}): Post {
  return {
    id: 'p1',
    author: '老黄',
    content: '院子里的绣球开了',
    createdAt: 1_700_000_000_000,
    liked: false,
    ...overrides
  }
}

/** 构造一个读取即抛错的存储，模拟浏览器禁用本地存储 */
function brokenStorage(): Storage {
  return {
    getItem() {
      throw new Error('denied')
    },
    setItem() {
      throw new Error('denied')
    },
    removeItem() {},
    clear() {},
    key() {
      return null
    },
    length: 0
  } as unknown as Storage
}

describe('常量', () => {
  it('存储键与上一版保持兼容', () => {
    expect(POSTS_KEY).toBe('lyd.posts.v1')
    expect(AUTHOR_KEY).toBe('lyd.author.v1')
  })

  it('长度上限与默认署名固定', () => {
    expect(MAX_CONTENT).toBe(500)
    expect(MAX_AUTHOR).toBe(20)
    expect(DEFAULT_AUTHOR).toBe('花园访客')
  })
})

describe('createId', () => {
  it('生成的 id 唯一且非空', () => {
    const ids = new Set(Array.from({ length: 200 }, () => createId()))
    expect(ids.size).toBe(200)
    ids.forEach((id) => expect(id.length).toBeGreaterThan(4))
  })
})

describe('readPosts', () => {
  it('空存储返回空数组且无错误', () => {
    expect(readPosts()).toEqual({ posts: [] })
  })

  it('正常数据原样读出', () => {
    const post = makePost()
    window.localStorage.setItem(POSTS_KEY, JSON.stringify([post]))
    expect(readPosts().posts).toEqual([post])
  })

  it('损坏的 JSON 降级为空并给出提示', () => {
    window.localStorage.setItem(POSTS_KEY, '{not json')
    const result = readPosts()
    expect(result.posts).toEqual([])
    expect(result.error).toBeTruthy()
  })

  it('非数组数据同样降级', () => {
    window.localStorage.setItem(POSTS_KEY, '{"a":1}')
    const result = readPosts()
    expect(result.posts).toEqual([])
    expect(result.error).toBeTruthy()
  })

  it('丢弃内容为空或类型不对的条目', () => {
    window.localStorage.setItem(
      POSTS_KEY,
      JSON.stringify([
        { id: 'a', author: '老黄', content: '正常', createdAt: 1, liked: false },
        { id: 'b', author: '老黄', content: '   ', createdAt: 2, liked: false },
        { id: 'c', author: '老黄', content: 42, createdAt: 3 },
        null,
        'oops'
      ])
    )
    const result = readPosts()
    expect(result.posts).toHaveLength(1)
    expect(result.posts[0].content).toBe('正常')
  })

  it('字段被裁剪到上限，非法值回退默认值', () => {
    window.localStorage.setItem(
      POSTS_KEY,
      JSON.stringify([
        {
          id: '',
          author: '   ',
          content: 'x'.repeat(MAX_CONTENT + 100),
          createdAt: 'oops',
          liked: 'yes'
        }
      ])
    )
    const [post] = readPosts().posts
    expect(post.id).toBeTruthy()
    expect(post.author).toBe(DEFAULT_AUTHOR)
    expect(post.content).toHaveLength(MAX_CONTENT)
    expect(typeof post.createdAt).toBe('number')
    expect(post.liked).toBe(false)
  })

  it('署名超长时截断', () => {
    window.localStorage.setItem(
      POSTS_KEY,
      JSON.stringify([makePost({ author: '阿'.repeat(MAX_AUTHOR + 5) })])
    )
    expect(readPosts().posts[0].author).toHaveLength(MAX_AUTHOR)
  })

  it('存储被禁用时返回空数组与提示', () => {
    const result = readPosts(brokenStorage())
    expect(result.posts).toEqual([])
    expect(result.error).toBeTruthy()
  })
})

describe('writePosts', () => {
  it('写入成功后可从存储读回', () => {
    const posts = [makePost()]
    expect(writePosts(posts)).toEqual({ ok: true })
    expect(JSON.parse(window.localStorage.getItem(POSTS_KEY) ?? '[]')).toHaveLength(1)
  })

  it('空间不足时返回失败且不抛出异常', () => {
    const storage = {
      getItem: () => null,
      setItem() {
        const error = new Error('quota')
        error.name = 'QuotaExceededError'
        throw error
      },
      removeItem() {},
      clear() {},
      key: () => null,
      length: 0
    } as unknown as Storage

    const result = writePosts([makePost()], storage)
    expect(result.ok).toBe(false)
    expect(result.error).toBeTruthy()
  })

  it('存储被禁用时返回失败', () => {
    const result = writePosts([makePost()], brokenStorage())
    expect(result.ok).toBe(false)
  })
})

describe('署名记忆', () => {
  it('未存过时返回空字符串', () => {
    expect(readAuthor()).toBe('')
  })

  it('写入后可读回', () => {
    writeAuthor('阿棠')
    expect(readAuthor()).toBe('阿棠')
  })

  it('存储被禁用时读写都不抛错', () => {
    expect(readAuthor(brokenStorage())).toBe('')
    expect(() => writeAuthor('阿棠', brokenStorage())).not.toThrow()
  })
})

describe('浏览器控制台', () => {
  it('存储异常时不打印错误日志（静默降级）', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    readPosts(brokenStorage())
    writePosts([makePost()], brokenStorage())
    expect(spy).not.toHaveBeenCalled()
  })
})
