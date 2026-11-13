import { describe, expect, it } from 'vitest'
import { splitHighlight } from '@/lib/highlight'

/** 片段拼回去必须等于原文，这是渲染不丢字的核心约束 */
function joined(text: string, query: string): string {
  return splitHighlight(text, query)
    .map((seg) => seg.text)
    .join('')
}

describe('splitHighlight', () => {
  it('空关键词时整段不命中', () => {
    const result = splitHighlight('院子里的绣球开了', '')
    expect(result).toHaveLength(1)
    expect(result[0]).toEqual({ text: '院子里的绣球开了', matched: false })
  })

  it('命中一次时只标出命中片段，且不丢字', () => {
    const result = splitHighlight('院子里有番茄', '番茄')
    expect(result.filter((seg) => seg.matched).map((seg) => seg.text)).toEqual(['番茄'])
    expect(joined('院子里有番茄', '番茄')).toBe('院子里有番茄')
  })

  it('英文大小写不敏感且保留原文大小写', () => {
    const result = splitHighlight('Hello Vue', 'vue')
    expect(result.filter((seg) => seg.matched).map((seg) => seg.text)).toEqual(['Vue'])
  })

  it('命中多次时全部标出', () => {
    const result = splitHighlight('番茄炒蛋和番茄汤', '番茄')
    expect(result.filter((seg) => seg.matched)).toHaveLength(2)
    expect(joined('番茄炒蛋和番茄汤', '番茄')).toBe('番茄炒蛋和番茄汤')
  })

  it('未命中时返回单段', () => {
    expect(splitHighlight('院子里有番茄', '黄瓜')).toEqual([
      { text: '院子里有番茄', matched: false }
    ])
  })

  it('关键词为纯空格时视为空', () => {
    const result = splitHighlight('abc', '   ')
    expect(result).toEqual([{ text: 'abc', matched: false }])
  })

  it('关键词首尾空格被忽略', () => {
    const result = splitHighlight('番茄红了', ' 番茄 ')
    expect(result.filter((seg) => seg.matched)).toHaveLength(1)
  })
})
