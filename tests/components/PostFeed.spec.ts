import { describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import PostFeed from '@/components/PostFeed.vue'
import type { Post } from '@/lib/posts'

function makePost(id: string, overrides: Partial<Post> = {}): Post {
  return {
    id,
    author: '老黄',
    content: `第 ${id} 条`,
    createdAt: 1_700_000_000_000,
    liked: false,
    likes: 0,
    favorited: false,
    ...overrides
  }
}

describe('PostFeed', () => {
  it('每条动态渲染一张卡片', () => {
    const wrapper = mount(PostFeed, {
      props: {
        posts: [makePost('a'), makePost('b')],
        query: '',
        isEmpty: false,
        isNoResult: false
      }
    })

    expect(wrapper.findAll('.card')).toHaveLength(2)
  })

  it('一条都没有时展示空态，并隐藏无结果态', () => {
    const wrapper = mount(PostFeed, {
      props: { posts: [], query: '', isEmpty: true, isNoResult: false }
    })

    expect(wrapper.get('#empty').classes()).toContain('is-visible')
    expect(wrapper.get('#no-result').classes()).not.toContain('is-visible')
  })

  it('搜索无结果时展示另一种空态', () => {
    const wrapper = mount(PostFeed, {
      props: { posts: [], query: '不存在', isEmpty: false, isNoResult: true }
    })

    expect(wrapper.get('#no-result').classes()).toContain('is-visible')
    expect(wrapper.get('#empty').classes()).not.toContain('is-visible')
  })

  it('收藏为空时展示收藏空态', () => {
    const wrapper = mount(PostFeed, {
      props: {
        posts: [],
        query: '',
        isEmpty: false,
        isNoResult: false,
        isFavoritesEmpty: true
      }
    })

    expect(wrapper.get('#favorites-empty').classes()).toContain('is-visible')
    expect(wrapper.get('#empty').classes()).not.toContain('is-visible')
    expect(wrapper.get('#no-result').classes()).not.toContain('is-visible')
  })

  it('非收藏视图时收藏空态隐藏', () => {
    const wrapper = mount(PostFeed, {
      props: {
        posts: [makePost('a')],
        query: '',
        isEmpty: false,
        isNoResult: false,
        isFavoritesEmpty: false
      }
    })

    expect(wrapper.get('#favorites-empty').classes()).not.toContain('is-visible')
  })

  it('收藏空态的按钮请求切回全部视图', async () => {
    const wrapper = mount(PostFeed, {
      props: {
        posts: [],
        query: '',
        isEmpty: false,
        isNoResult: false,
        isFavoritesEmpty: true
      }
    })

    await wrapper.get('#favorites-empty-action').trigger('click')

    expect(wrapper.emitted('show-all')).toHaveLength(1)
  })

  it('把卡片的点赞事件向上转发', async () => {
    const wrapper = mount(PostFeed, {
      props: {
        posts: [makePost('a')],
        query: '',
        isEmpty: false,
        isNoResult: false
      }
    })

    await wrapper.get('[data-action="like"]').trigger('click')

    expect(wrapper.emitted('like')?.[0]).toEqual(['a'])
  })

  it('把卡片的收藏事件向上转发', async () => {
    const wrapper = mount(PostFeed, {
      props: {
        posts: [makePost('a')],
        query: '',
        isEmpty: false,
        isNoResult: false
      }
    })

    await wrapper.get('[data-action="favorite"]').trigger('click')

    expect(wrapper.emitted('favorite')?.[0]).toEqual(['a'])
  })

  it('把卡片的删除事件向上转发', async () => {
    const wrapper = mount(PostFeed, {
      props: {
        posts: [makePost('a')],
        query: '',
        isEmpty: false,
        isNoResult: false
      }
    })
    vi.spyOn(window, 'confirm').mockReturnValue(true)

    await wrapper.get('[data-action="delete"]').trigger('click')

    expect(wrapper.emitted('delete')?.[0]).toEqual(['a'])
  })

  it('空态按钮请求聚焦发布框', async () => {
    const wrapper = mount(PostFeed, {
      props: { posts: [], query: '', isEmpty: true, isNoResult: false }
    })

    await wrapper.get('#empty-action').trigger('click')

    expect(wrapper.emitted('focus-composer')).toHaveLength(1)
  })

  it('无结果态的清空按钮向上请求清空筛选', async () => {
    const wrapper = mount(PostFeed, {
      props: { posts: [], query: '不存在', isEmpty: false, isNoResult: true }
    })

    await wrapper.get('#no-result-action').trigger('click')

    expect(wrapper.emitted('clear-search')).toHaveLength(1)
  })
})
