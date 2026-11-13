import { afterEach, beforeEach, vi } from 'vitest'

/**
 * Node 26 自带了一个需要 `--localstorage-file` 才能用的全局 localStorage，
 * 它会遮蔽 jsdom 注入的同名属性，导致 `window.localStorage` 变成 undefined。
 * 这里补一个内存实现，语义与浏览器 Storage 一致，让用例在任何 Node 版本下都稳定。
 */
function installMemoryStorage(): void {
  if (typeof window === 'undefined' || window.localStorage) return

  const entries = new Map<string, string>()
  const storage: Storage = {
    get length() {
      return entries.size
    },
    clear: () => entries.clear(),
    getItem: (key) => (entries.has(key) ? entries.get(key)! : null),
    key: (index) => [...entries.keys()][index] ?? null,
    removeItem: (key) => {
      entries.delete(key)
    },
    setItem: (key, value) => {
      entries.set(String(key), String(value))
    }
  }

  Object.defineProperty(window, 'localStorage', {
    value: storage,
    configurable: true,
    writable: true
  })
}

// 每个测试用例都从干净的本地存储开始，避免用例之间互相污染
// 后端用例跑在 node 环境（没有 window），这里要跳过
beforeEach(() => {
  installMemoryStorage()
  if (typeof window !== 'undefined') window.localStorage.clear()
})

// fetch stub / 全局替身用完就还原，防止串到下一个用例
afterEach(() => {
  vi.unstubAllGlobals()
})
