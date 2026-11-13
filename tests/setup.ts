import { afterEach, beforeEach, vi } from 'vitest'

// 每个测试用例都从干净的本地存储开始，避免用例之间互相污染
// 后端用例跑在 node 环境（没有 window），这里要跳过
beforeEach(() => {
  if (typeof window !== 'undefined') window.localStorage.clear()
})

// fetch stub / 全局替身用完就还原，防止串到下一个用例
afterEach(() => {
  vi.unstubAllGlobals()
})
