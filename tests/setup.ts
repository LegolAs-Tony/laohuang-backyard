import { beforeEach } from 'vitest'

// 每个测试用例都从干净的本地存储开始，避免用例之间互相污染
beforeEach(() => {
  window.localStorage.clear()
})
