import { describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import PostCard from '@/components/PostCard.vue'
import type { Post } from '@/lib/storage'

function makePost(overrides: Partial<Post> = {}): Post {
  return {
    id: 'p1',
    author: '老黄',
    content: '院子里的番茄红了',
    createdAt: Date.now() - 3 * 60 * 1000,
    liked: false,
    ...overrides
  }
}

describe('PostCard', () => {
  it('渲染署名、正文与语义化时间', () => {
    const post = makePost()
    const wrapper = mount(PostCard, { props: { post } })

    expect(wrapper.get('.card__author').text()).toBe('老黄')
    expect(wrapper.get('.card__body').text()).toBe('院子里的番茄红了')

    const time = wrapper.get('time')
    expect(time.attributes('datetime')).toBe(new Date(post.createdAt).toISOString())
    expect(time.text()).toBe('3 分钟前')
  })

  it('保留正文换行', () => {
    const wrapper = mount(PostCard, {
      props: { post: makePost({ content: '第一行\n第二行' }) }
    })
    expect(wrapper.get('.card__body').text()).toContain('\n')
  })

  it('关键词命中时渲染 mark 高亮', () => {
    const wrapper = mount(PostCard, { props: { post: makePost(), query: '番茄' } })
    expect(wrapper.findAll('mark.card__highlight')).toHaveLength(1)
  })

  it('无关键词时不渲染高亮', () => {
    const wrapper = mount(PostCard, { props: { post: makePost() } })
    expect(wrapper.findAll('mark')).toHaveLength(0)
  })

  it('未点赞时显示「赞」且 aria-pressed=false', () => {
    const wrapper = mount(PostCard, { props: { post: makePost({ liked: false }) } })
    const like = wrapper.get('[data-action="like"]')

    expect(like.attributes('aria-pressed')).toBe('false')
    expect(like.text()).toContain('赞')
  })

  it('已点赞时显示「已赞」且 aria-pressed=true', () => {
    const wrapper = mount(PostCard, { props: { post: makePost({ liked: true }) } })
    const like = wrapper.get('[data-action="like"]')

    expect(like.attributes('aria-pressed')).toBe('true')
    expect(like.text()).toContain('已赞')
  })

  it('点击点赞派发 like 事件并带上 id', async () => {
    const wrapper = mount(PostCard, { props: { post: makePost() } })
    await wrapper.get('[data-action="like"]').trigger('click')

    expect(wrapper.emitted('like')?.[0]).toEqual(['p1'])
  })

  it('删除需要二次确认', async () => {
    const wrapper = mount(PostCard, { props: { post: makePost() } })
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false)

    await wrapper.get('[data-action="delete"]').trigger('click')
    expect(confirmSpy).toHaveBeenCalled()
    expect(wrapper.emitted('delete')).toBeUndefined()

    confirmSpy.mockReturnValue(true)
    await wrapper.get('[data-action="delete"]').trigger('click')
    expect(wrapper.emitted('delete')?.[0]).toEqual(['p1'])
  })

  it('头像取署名首字并带配色变体', () => {
    const wrapper = mount(PostCard, { props: { post: makePost({ author: '阿棠' }) } })
    const avatar = wrapper.get('.card__avatar')

    expect(avatar.text()).toBe('阿')
    expect(avatar.classes().some((name) => name.startsWith('card__avatar--'))).toBe(true)
  })
})
