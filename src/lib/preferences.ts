export const AUTHOR_KEY = 'lyd.author.v1'

/** 访问 window.localStorage 本身也可能抛错（隐私模式 / 禁用 Cookie） */
function defaultStorage(): Storage | null {
  try {
    return window.localStorage
  } catch {
    return null
  }
}

/**
 * 只记住「上次用的署名」这类界面偏好；
 * 动态数据本身已经全部由服务端持有，不再落到浏览器。
 */
export function readAuthor(storage: Storage | null = defaultStorage()): string {
  if (!storage) return ''

  try {
    return storage.getItem(AUTHOR_KEY) ?? ''
  } catch {
    return ''
  }
}

export function writeAuthor(name: string, storage: Storage | null = defaultStorage()): void {
  if (!storage) return

  try {
    storage.setItem(AUTHOR_KEY, name)
  } catch {
    // 署名记忆失败不影响主流程，静默降级
  }
}
