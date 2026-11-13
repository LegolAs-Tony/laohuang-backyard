import { describe, expect, it } from 'vitest'
import { AUTHOR_KEY, readAuthor, writeAuthor } from '@/lib/preferences'

function brokenStorage(): Storage {
  const fail = (): never => {
    throw new Error('storage blocked')
  }

  return {
    get length(): number {
      return 0
    },
    clear: fail,
    getItem: fail,
    key: fail,
    removeItem: fail,
    setItem: fail
  }
}

describe('署名记忆', () => {
  it('写入后能读回', () => {
    writeAuthor('阿棠')

    expect(readAuthor()).toBe('阿棠')
    expect(window.localStorage.getItem(AUTHOR_KEY)).toBe('阿棠')
  })

  it('没有值时返回空串', () => {
    expect(readAuthor()).toBe('')
  })

  it('存储抛错时读回空串，写入静默降级', () => {
    expect(readAuthor(brokenStorage())).toBe('')
    expect(() => writeAuthor('阿棠', brokenStorage())).not.toThrow()
  })

  it('没有可用的 storage 时同样不抛错', () => {
    expect(readAuthor(null)).toBe('')
    expect(() => writeAuthor('阿棠', null)).not.toThrow()
  })
})
