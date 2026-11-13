export interface Post {
  id: string
  author: string
  content: string
  createdAt: number
  liked: boolean
}

export const MAX_CONTENT = 500
export const MAX_AUTHOR = 20
export const DEFAULT_AUTHOR = '花园访客'

/** 关键词命中：正文或署名，大小写不敏感 */
export function matchesQuery(post: Post, keyword: string): boolean {
  const needle = keyword.trim().toLowerCase()
  if (!needle) return true

  return post.content.toLowerCase().includes(needle) || post.author.toLowerCase().includes(needle)
}
