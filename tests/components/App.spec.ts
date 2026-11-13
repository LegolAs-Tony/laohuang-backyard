import { afterEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import App from '@/App.vue'
import type { Post } from '@/lib/posts'
import { installFakeApi } from '../helpers/fake-api'
import type { FakeApi } from '../helpers/fake-api'

// App 会注册 window/document 监听器，用例结束必须卸载，否则跨用例串味
const mounted: Array<{ unmount: () => void }> = []

afterEach(() => {
  while (mounted.length) mounted.pop()?.unmount()
})

async function mountApp(seed: Partial<Post>[] = []): Promise<{
  wrapper: ReturnType<typeof mount>
  api: FakeApi
}> {
  const api = installFakeApi(seed)
  const pinia = createPinia()
  setActivePinia(pinia)

  const wrapper = mount(App, { global: { plugins: [pinia] } })
  mounted.push(wrapper)
  await flushPromises()

  return { wrapper, api }
}

describe('App 集成', () => {
  it('接口没有数据时展示空态', async () => {
    const { wrapper } = await mountApp()

    expect(wrapper.get('#empty').classes()).toContain('is-visible')
    expect(wrapper.findAll('.card')).toHaveLength(0)
  })

  it('读取接口数据并按时间倒序渲染', async () => {
    const { wrapper } = await mountApp([
      { id: 'old', content: '早一点', createdAt: 1000 },
      { id: 'new', content: '晚一点', createdAt: 2000 }
    ])
    const cards = wrapper.findAll('.card')

    expect(cards).toHaveLength(2)
    expect(cards[0].get('.card__body').text()).toBe('晚一点')
    expect(cards[1].get('.card__body').text()).toBe('早一点')
  })

  it('发布后列表更新、接口收到请求、正文框清空', async () => {
    const { wrapper, api } = await mountApp()

    await wrapper.get('#author').setValue('老黄')
    await wrapper.get('#content').setValue('今天种了番茄')
    await wrapper.get('form').trigger('submit')
    await flushPromises()

    expect(wrapper.findAll('.card')).toHaveLength(1)
    expect(wrapper.get('.card__body').text()).toBe('今天种了番茄')
    expect(api.posts).toHaveLength(1)
    expect((wrapper.get('#content').element as HTMLTextAreaElement).value).toBe('')
  })

  it('搜索时按关键词过滤并显示命中数', async () => {
    const { wrapper } = await mountApp([
      { id: 'a', content: '番茄红了' },
      { id: 'b', content: '黄瓜熟了' }
    ])

    await wrapper.get('#search').setValue('番茄')

    expect(wrapper.findAll('.card')).toHaveLength(1)
    expect(wrapper.get('#feed-stat').text()).toBe('共 2 条 · 命中 1 条')
  })

  it('搜索无结果时展示无结果空态', async () => {
    const { wrapper } = await mountApp([{ id: 'a', content: '番茄红了' }])

    await wrapper.get('#search').setValue('西瓜')

    expect(wrapper.get('#no-result').classes()).toContain('is-visible')
  })

  it('点赞后写入服务端并更新按钮状态', async () => {
    const { wrapper, api } = await mountApp([{ id: 'a', content: '番茄红了', liked: false }])

    await wrapper.get('[data-action="like"]').trigger('click')
    await flushPromises()

    expect(api.posts[0].liked).toBe(true)
    expect(wrapper.get('[data-action="like"]').attributes('aria-pressed')).toBe('true')
  })

  it('删除后卡片消失且服务端同步', async () => {
    const { wrapper, api } = await mountApp([{ id: 'a' }])
    vi.spyOn(window, 'confirm').mockReturnValue(true)

    await wrapper.get('[data-action="delete"]').trigger('click')
    await flushPromises()

    expect(wrapper.findAll('.card')).toHaveLength(0)
    expect(api.posts).toHaveLength(0)
  })

  it('窗口重新获得焦点时刷新列表', async () => {
    const { wrapper, api } = await mountApp()
    expect(wrapper.findAll('.card')).toHaveLength(0)

    api.posts = [
      {
        id: 'p9',
        author: '老黄',
        content: '别的标签页写的',
        createdAt: 1_700_000_000_000,
        liked: false
      }
    ]
    window.dispatchEvent(new Event('focus'))
    await flushPromises()

    expect(wrapper.findAll('.card')).toHaveLength(1)
  })
})
