import { existsSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { serve } from '@hono/node-server'
import { serveStatic } from '@hono/node-server/serve-static'
import { Hono } from 'hono'
import { createApp } from './app'

const rawPort = process.env.PORT ?? '8787'
const port = Number(rawPort)

if (!Number.isInteger(port) || port <= 0) {
  console.error(`PORT 必须是正整数，当前收到：${rawPort}`)
  process.exit(1)
}

const dist = resolve(process.cwd(), 'dist')

const api = createApp()
const web = new Hono()

if (existsSync(join(dist, 'index.html'))) {
  // 生产验收时由同一个进程托管构建产物，前端与 /api 同源，不需要 CORS
  web.use('*', serveStatic({ root: dist }))
  web.get('*', serveStatic({ path: join(dist, 'index.html') }))
} else {
  console.warn('未找到 dist/index.html，请先运行 npm run build；当前只提供 /api')
}

function isApiPath(pathname: string): boolean {
  return pathname === '/api' || pathname.startsWith('/api/')
}

const server = serve(
  {
    fetch(request) {
      const { pathname } = new URL(request.url)
      return isApiPath(pathname) ? api.fetch(request) : web.fetch(request)
    },
    port
  },
  (info) => {
    console.log(`老黄的后花园后端已启动：http://127.0.0.1:${info.port}`)
  }
)

// 收到退出信号时先关端口，避免验收脚本下一次启动连到旧进程
for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => {
    server.close(() => process.exit(0))
  })
}
