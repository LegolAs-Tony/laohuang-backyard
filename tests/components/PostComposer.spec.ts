import { describe, expect, it } from 'vitest'
import { nextTick } from 'vue'
import { mount } from '@vue/test-utils'
import PostComposer from '@/components/PostComposer.vue'
import { MAX_CONTENT } from '@/lib/storage'

async function write(wrapper: ReturnType<typeof mount>, text: string) {
  await wrapper.get('#content').setValue(text)
}

describe('PostComposer', () => {
  it('回填上次使用的署名', () => {
    const wrapper = mount(PostComposer, { props: { initialAuthor: '阿棠' } })
    expect((wrapper.get('#author').element as HTMLInputElement).value).toBe('阿棠')
  })

  it('字数计数随输入更新', async () => {
    const wrapper = mount(PostComposer)
    await write(wrapper, '院子里')
    expect(wrapper.get('#counter-current').text()).toBe('3')
  })

  it('超过上限时禁用提交并标红计数', async () => {
    const wrapper = mount(PostComposer)
    await write(wrapper, 'x'.repeat(MAX_CONTENT + 1))

    expect(wrapper.get('#submit-btn').attributes('disabled')).toBeDefined()
    expect(wrapper.get('#counter').classes()).toContain('is-full')
  })

  it('空内容提交时给出错误且不派发事件', async () => {
    const wrapper = mount(PostComposer)
    await write(wrapper, '   ')
    await wrapper.get('form').trigger('submit')

    expect(wrapper.emitted('submit')).toBeUndefined()
    expect(wrapper.get('#composer-error').text()).toBeTruthy()
  })

  it('有效内容提交时派发 submit 事件', async () => {
    const wrapper = mount(PostComposer, { props: { initialAuthor: '老黄' } })
    await write(wrapper, '  今天种了番茄  ')
    await wrapper.get('form').trigger('submit')

    expect(wrapper.emitted('submit')?.[0]).toEqual([
      { author: '老黄', content: '今天种了番茄' }
    ])
  })

  it('Ctrl + Enter 也能提交', async () => {
    const wrapper = mount(PostComposer, { props: { initialAuthor: '老黄' } })
    await write(wrapper, '快捷键提交')
    await wrapper.get('#content').trigger('keydown', { key: 'Enter', ctrlKey: true })

    expect(wrapper.emitted('submit')).toHaveLength(1)
  })

  it('提交后不会自动清空草稿，避免保存失败时丢字', async () => {
    const wrapper = mount(PostComposer, { props: { initialAuthor: '老黄' } })
    await write(wrapper, '写失败也要留住')
    await wrapper.get('form').trigger('submit')

    expect((wrapper.get('#content').element as HTMLTextAreaElement).value).toBe('写失败也要留住')
  })

  it('暴露 reset() 供父组件在保存成功后清空', async () => {
    const wrapper = mount(PostComposer, { props: { initialAuthor: '老黄' } })
    await write(wrapper, '已经存住了')
    const exposed = wrapper.vm as unknown as { reset: () => void }
    exposed.reset()
    await nextTick()

    expect((wrapper.get('#content').element as HTMLTextAreaElement).value).toBe('')
    expect(wrapper.get('#counter-current').text()).toBe('0')
  })

  it('点击提交按钮同样触发提交', async () => {
    const wrapper = mount(PostComposer, { props: { initialAuthor: '老黄' } })
    await write(wrapper, '点按钮')
    await wrapper.get('#submit-btn').trigger('click')

    expect(wrapper.emitted('submit')).toHaveLength(1)
  })
})
