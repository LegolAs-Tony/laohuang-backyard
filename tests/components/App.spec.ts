import { describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import App from '@/App.vue'
import { POSTS_KEY } from '@/lib/storage'
import type { Post } from '@/lib/storage'

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

function mountApp() {
  const pinia = createPinia()
  setActivePinia(pinia)
  return mount(App, { global: { plugins: [pinia] } })
}

describe('App 集成', () => {
  it('没有任何数据时展示空态', () => {
    const wrapper = mountApp()
    expect(wrapper.get('#empty').classes()).toContain('is-visible')
    expect(wrapper.findAll('.card')).toHaveLength(0)
  })

  it('读取本地数据并按时间倒序渲染', () => {
    seed([
      { id: 'old', content: '早一点', createdAt: 1000 },
      { id: 'new', content: '晚一点', createdAt: 2000 }
    ])

    const wrapper = mountApp()
    const cards = wrapper.findAll('.card')

    expect(cards).toHaveLength(2)
    expect(cards[0].get('.card__body').text()).toBe('晚一点')
    expect(cards[1].get('.card__body').text()).toBe('早一点')
  })

  it('发布后列表与本地存储同时更新', async () => {
    const wrapper = mountApp()

    await wrapper.get('#author').setValue('老黄')
    await wrapper.get('#content').setValue('今天种了番茄')
    await wrapper.get('form').trigger('submit')

    expect(wrapper.findAll('.card')).toHaveLength(1)
    expect(wrapper.get('.card__body').text()).toBe('今天种了番茄')

    const stored = JSON.parse(window.localStorage.getItem(POSTS_KEY) ?? '[]')
    expect(stored).toHaveLength(1)
    expect((wrapper.get('#content').element as HTMLTextAreaElement).value).toBe('')
  })

  it('搜索时按关键词过滤并显示命中数', async () => {
    seed([
      { id: 'a', content: '番茄红了' },
      { id: 'b', content: '黄瓜熟了' }
    ])
    const wrapper = mountApp()

    await wrapper.get('#search').setValue('番茄')

    expect(wrapper.findAll('.card')).toHaveLength(1)
    expect(wrapper.get('#feed-stat').text()).toBe('共 2 条 · 命中 1 条')
  })

  it('搜索无结果时展示无结果空态', async () => {
    seed([{ id: 'a', content: '番茄红了' }])
    const wrapper = mountApp()

    await wrapper.get('#search').setValue('西瓜')

    expect(wrapper.get('#no-result').classes()).toContain('is-visible')
  })

  it('点赞后状态写入本地存储', async () => {
    seed([{ id: 'a', content: '番茄红了', liked: false }])
    const wrapper = mountApp()

    await wrapper.get('[data-action="like"]').trigger('click')

    const stored = JSON.parse(window.localStorage.getItem(POSTS_KEY) ?? '[]')
    expect(stored[0].liked).toBe(true)
    expect(wrapper.get('[data-action="like"]').attributes('aria-pressed')).toBe('true')
  })

  it('删除后卡片消失且存储同步', async () => {
    seed([{ id: 'a' }])
    const wrapper = mountApp()
    vi.spyOn(window, 'confirm').mockReturnValue(true)

    await wrapper.get('[data-action="delete"]').trigger('click')

    expect(wrapper.findAll('.card')).toHaveLength(0)
    expect(JSON.parse(window.localStorage.getItem(POSTS_KEY) ?? '[]')).toHaveLength(0)
  })

  it('其他标签页写入后自动同步', async () => {
    const wrapper = mountApp()
    seed([{ content: '别的标签页写的' }])

    window.dispatchEvent(new StorageEvent('storage', { key: POSTS_KEY }))
    await wrapper.vm.$nextTick()

    expect(wrapper.findAll('.card')).toHaveLength(1)
  })
})
