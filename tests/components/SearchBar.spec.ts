import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import SearchBar from '@/components/SearchBar.vue'

describe('SearchBar', () => {
  it('无关键词时只显示总数', () => {
    const wrapper = mount(SearchBar, {
      props: { modelValue: '', total: 3, matchCount: 3 }
    })
    expect(wrapper.get('#feed-stat').text()).toBe('共 3 条')
  })

  it('有关键词时显示命中数', () => {
    const wrapper = mount(SearchBar, {
      props: { modelValue: '番茄', total: 3, matchCount: 1 }
    })
    expect(wrapper.get('#feed-stat').text()).toBe('共 3 条 · 命中 1 条')
  })

  it('无关键词时清除按钮隐藏', () => {
    const wrapper = mount(SearchBar, {
      props: { modelValue: '', total: 0, matchCount: 0 }
    })
    expect(wrapper.get('#search-clear').isVisible()).toBe(false)
  })

  it('有内容时清除按钮显示', () => {
    const wrapper = mount(SearchBar, {
      props: { modelValue: '番茄', total: 3, matchCount: 1 }
    })
    expect(wrapper.get('#search-clear').isVisible()).toBe(true)
  })

  it('输入时通过 update:modelValue 向上同步', async () => {
    const wrapper = mount(SearchBar, {
      props: { modelValue: '', total: 0, matchCount: 0 }
    })
    await wrapper.get('#search').setValue('番茄')

    expect(wrapper.emitted('update:modelValue')?.[0]).toEqual(['番茄'])
  })

  it('点击清除派发 clear', async () => {
    const wrapper = mount(SearchBar, {
      props: { modelValue: '番茄', total: 3, matchCount: 1 }
    })
    await wrapper.get('#search-clear').trigger('click')

    expect(wrapper.emitted('clear')).toHaveLength(1)
  })

  it('按 Esc 也能清空筛选', async () => {
    const wrapper = mount(SearchBar, {
      props: { modelValue: '番茄', total: 3, matchCount: 1 }
    })
    await wrapper.get('#search').trigger('keydown', { key: 'Escape' })

    expect(wrapper.emitted('clear')).toHaveLength(1)
  })

  it('渲染「全部 / 收藏」两个页签', () => {
    const wrapper = mount(SearchBar, {
      props: { modelValue: '', total: 3, matchCount: 3 }
    })

    expect(wrapper.findAll('.filter__tab')).toHaveLength(2)
    expect(wrapper.get('#view-all').text()).toBe('全部')
    expect(wrapper.get('#view-favorites').text()).toBe('收藏')
  })

  it('默认停在「全部」页签', () => {
    const wrapper = mount(SearchBar, {
      props: { modelValue: '', total: 3, matchCount: 3 }
    })

    expect(wrapper.get('#view-all').attributes('aria-pressed')).toBe('true')
    expect(wrapper.get('#view-favorites').attributes('aria-pressed')).toBe('false')
  })

  it('收藏视图时对应页签 aria-pressed=true', () => {
    const wrapper = mount(SearchBar, {
      props: { modelValue: '', total: 3, matchCount: 1, view: 'favorites', favoriteCount: 1 }
    })

    expect(wrapper.get('#view-all').attributes('aria-pressed')).toBe('false')
    expect(wrapper.get('#view-favorites').attributes('aria-pressed')).toBe('true')
  })

  it('点收藏页签派发 update:view', async () => {
    const wrapper = mount(SearchBar, {
      props: { modelValue: '', total: 3, matchCount: 3 }
    })
    await wrapper.get('#view-favorites').trigger('click')

    expect(wrapper.emitted('update:view')?.[0]).toEqual(['favorites'])
  })

  it('点全部页签派发 update:view', async () => {
    const wrapper = mount(SearchBar, {
      props: { modelValue: '', total: 3, matchCount: 3, view: 'favorites', favoriteCount: 2 }
    })
    await wrapper.get('#view-all').trigger('click')

    expect(wrapper.emitted('update:view')?.[0]).toEqual(['all'])
  })

  it('收藏视图未搜索时统计收藏条数', () => {
    const wrapper = mount(SearchBar, {
      props: { modelValue: '', total: 3, matchCount: 2, view: 'favorites', favoriteCount: 2 }
    })

    expect(wrapper.get('#feed-stat').text()).toBe('收藏 2 条')
  })

  it('收藏视图有搜索词时追加命中数', () => {
    const wrapper = mount(SearchBar, {
      props: { modelValue: '番茄', total: 3, matchCount: 1, view: 'favorites', favoriteCount: 2 }
    })

    expect(wrapper.get('#feed-stat').text()).toBe('收藏 2 条 · 命中 1 条')
  })
})
