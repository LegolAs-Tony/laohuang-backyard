export interface HighlightSegment {
  text: string
  matched: boolean
}

/**
 * 把正文按关键词切成片段，供模板渲染成 <mark>。
 * 纯函数、大小写不敏感、不丢字：所有片段拼接后必须等于原文。
 */
export function splitHighlight(text: string, query: string): HighlightSegment[] {
  const needle = query.trim().toLowerCase()

  if (!needle) return [{ text, matched: false }]

  const haystack = text.toLowerCase()
  const segments: HighlightSegment[] = []
  let cursor = 0
  let position = haystack.indexOf(needle)

  while (position !== -1) {
    if (position > cursor) {
      segments.push({ text: text.slice(cursor, position), matched: false })
    }

    segments.push({ text: text.slice(position, position + needle.length), matched: true })
    cursor = position + needle.length
    position = haystack.indexOf(needle, cursor)
  }

  if (cursor < text.length) {
    segments.push({ text: text.slice(cursor), matched: false })
  }

  return segments
}
