/**
 * 浏览器内验收（零依赖）
 *
 * 流程：起一个只读静态服务托管 dist/ → 启动本机 Chrome/Edge 无头模式
 *      → 通过 DevTools 协议真实点击 / 输入 / 刷新 → 断言 + 截图 → 清理。
 *
 * 用法：
 *   npm run accept          # 先构建再验收
 *   CHROME_PATH=... node scripts/acceptance.mjs
 */
import { spawn } from 'node:child_process'
import { createReadStream, existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { createServer } from 'node:http'
import { dirname, extname, join, normalize, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const DIST = join(ROOT, 'dist')
const SHOT_DIR = join(ROOT, '.acceptance')
const PROFILE_DIR = join(ROOT, '.acceptance', 'profile')

const PORT = Number(process.env.ACCEPT_PORT ?? 4178)
const DEBUG_PORT = Number(process.env.ACCEPT_DEBUG_PORT ?? 9333)
const APP_URL = `http://127.0.0.1:${PORT}/index.html`

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon'
}

const sleep = (ms) => new Promise((done) => setTimeout(done, ms))
const results = []

function check(name, ok, extra = '') {
  results.push({ name, ok })
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${extra ? ' | ' + extra : ''}`)
}

function findBrowser() {
  const candidates = [
    process.env.CHROME_PATH,
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium'
  ].filter(Boolean)

  return candidates.find((candidate) => existsSync(candidate))
}

function startStaticServer() {
  const server = createServer((request, response) => {
    const urlPath = decodeURIComponent((request.url ?? '/').split('?')[0])
    const target = normalize(join(DIST, urlPath === '/' ? 'index.html' : urlPath))

    if (!target.startsWith(normalize(DIST))) {
      response.writeHead(403).end()
      return
    }

    const file = existsSync(target) ? target : join(DIST, 'index.html')
    response.writeHead(200, { 'content-type': MIME[extname(file)] ?? 'application/octet-stream' })
    createReadStream(file).pipe(response)
  })

  return new Promise((done) => server.listen(PORT, '127.0.0.1', () => done(server)))
}

function connect(wsUrl) {
  const socket = new WebSocket(wsUrl)
  const pending = new Map()
  const listeners = new Map()
  let seq = 0

  socket.addEventListener('message', (event) => {
    const message = JSON.parse(event.data)

    if (message.id && pending.has(message.id)) {
      const { resolve: ok, reject } = pending.get(message.id)
      pending.delete(message.id)
      if (message.error) reject(new Error(message.error.message))
      else ok(message.result)
      return
    }

    if (message.method) {
      for (const handler of listeners.get(message.method) ?? []) handler(message.params)
    }
  })

  const ready = new Promise((done) => socket.addEventListener('open', done))

  const send = (method, params = {}) =>
    new Promise((ok, reject) => {
      const id = (seq += 1)
      pending.set(id, { resolve: ok, reject })
      socket.send(JSON.stringify({ id, method, params }))
    })

  const on = (method, handler) => {
    if (!listeners.has(method)) listeners.set(method, [])
    listeners.get(method).push(handler)
  }

  return { ready, send, on, close: () => socket.close() }
}

async function waitForDevtools() {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    try {
      const response = await fetch(`http://127.0.0.1:${DEBUG_PORT}/json/version`)
      if (response.ok) return
    } catch {
      /* 浏览器还没起来 */
    }
    await sleep(200)
  }
  throw new Error('浏览器调试端口未就绪')
}

async function runChecks(cdp) {
  const errors = []

  cdp.on('Page.javascriptDialogOpening', () => {
    cdp.send('Page.handleJavaScriptDialog', { accept: true })
  })
  cdp.on('Runtime.exceptionThrown', (params) => {
    errors.push(params.exceptionDetails?.exception?.description ?? params.exceptionDetails?.text)
  })
  cdp.on('Log.entryAdded', (params) => {
    if (params.entry?.level === 'error') errors.push(params.entry.text)
  })

  async function evaluate(expression) {
    const { result, exceptionDetails } = await cdp.send('Runtime.evaluate', {
      expression,
      returnByValue: true,
      awaitPromise: true
    })
    if (exceptionDetails) {
      throw new Error(exceptionDetails.exception?.description ?? exceptionDetails.text)
    }
    return result.value
  }

  async function waitFor(selector, timeout = 8000) {
    const deadline = Date.now() + timeout
    while (Date.now() < deadline) {
      if (await evaluate(`!!document.querySelector(${JSON.stringify(selector)})`)) return
      await sleep(100)
    }
    throw new Error(`等待元素超时: ${selector}`)
  }

  async function click(selector) {
    const point = await evaluate(`(() => {
      const el = document.querySelector(${JSON.stringify(selector)});
      if (!el) return null;
      el.scrollIntoView({ block: 'center' });
      const rect = el.getBoundingClientRect();
      return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
    })()`)
    if (!point) throw new Error(`找不到元素: ${selector}`)

    await cdp.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: point.x, y: point.y })
    await cdp.send('Input.dispatchMouseEvent', {
      type: 'mousePressed', x: point.x, y: point.y, button: 'left', clickCount: 1
    })
    await cdp.send('Input.dispatchMouseEvent', {
      type: 'mouseReleased', x: point.x, y: point.y, button: 'left', clickCount: 1
    })
    await sleep(150)
  }

  async function typeInto(selector, text) {
    await evaluate(`(() => {
      const el = document.querySelector(${JSON.stringify(selector)});
      el.focus();
      if (el.select) el.select();
      return true;
    })()`)
    await cdp.send('Input.insertText', { text })
    await sleep(120)

    const value = await evaluate(`document.querySelector(${JSON.stringify(selector)}).value`)
    if (value === text) return

    // 兜底：原生 setter + input 事件，等价于用户输入后的 v-model 更新路径
    await evaluate(`(() => {
      const el = document.querySelector(${JSON.stringify(selector)});
      const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
      Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, ${JSON.stringify(text)});
      el.dispatchEvent(new Event('input', { bubbles: true }));
      return true;
    })()`)
    await sleep(120)
  }

  const count = () => evaluate(`document.querySelectorAll('.card').length`)
  const store = () => evaluate(`JSON.parse(localStorage.getItem('lyd.posts.v1') || '[]')`)
  const text = (selector) =>
    evaluate(`document.querySelector(${JSON.stringify(selector)}).textContent.trim()`)
  const pressCtrlEnter = async () => {
    for (const type of ['keyDown', 'keyUp']) {
      await cdp.send('Input.dispatchKeyEvent', {
        type, modifiers: 2, key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13
      })
    }
    await sleep(350)
  }
  const reload = async () => {
    await cdp.send('Page.reload')
    await waitFor('#app .composer')
    await sleep(300)
  }
  const shot = async (name) => {
    const image = await cdp.send('Page.captureScreenshot', { format: 'png' })
    writeFileSync(join(SHOT_DIR, name), Buffer.from(image.data, 'base64'))
  }

  /* -------------------------------------------------------------- 用例 */
  await cdp.send('Page.navigate', { url: APP_URL })
  await waitFor('#app .composer')
  await evaluate('localStorage.clear()')
  await reload()

  check('首屏展示空态', await evaluate(`document.querySelector('#empty').classList.contains('is-visible')`))
  check('统计为「共 0 条」', (await text('#feed-stat')) === '共 0 条')

  await typeInto('#author', '老黄')
  await typeInto('#content', '今天院子里的绣球开了')
  check('字数计数正确', (await text('#counter-current')) === '10')

  await click('#submit-btn')
  await waitFor('.card')
  check('点击发布后出现 1 张卡片', (await count()) === 1)
  check('卡片正文正确', (await text('.card .card__body')) === '今天院子里的绣球开了')
  check('卡片署名正确', (await text('.card .card__author')) === '老黄')
  check('正文输入框已清空', (await evaluate(`document.querySelector('#content').value`)) === '')
  check('署名保留在输入框', (await evaluate(`document.querySelector('#author').value`)) === '老黄')

  const stored = await store()
  check(
    '本地存储写入 1 条且字段完整',
    stored.length === 1 && Boolean(stored[0].id) && stored[0].liked === false &&
      typeof stored[0].createdAt === 'number'
  )

  await click('.card [data-action="like"]')
  check(
    '点赞后 aria-pressed=true',
    (await evaluate(`document.querySelector('.card [data-action="like"]').getAttribute('aria-pressed')`)) === 'true'
  )
  check('点赞状态已持久化', (await store())[0].liked === true)

  await typeInto('#author', '')
  await typeInto('#content', '番茄红了第一颗')
  await pressCtrlEnter()
  check('Ctrl+Enter 发布成功', (await count()) === 2)
  check(
    '留空署名回退「花园访客」',
    (await evaluate(`document.querySelectorAll('.card .card__author')[0].textContent`)) === '花园访客'
  )

  await typeInto('#search', '番茄')
  await sleep(300)
  check('筛选后只剩 1 张卡片', (await count()) === 1)
  check('统计显示命中数', (await text('#feed-stat')) === '共 2 条 · 命中 1 条')
  check('命中词高亮为 mark', (await evaluate(`document.querySelectorAll('mark.card__highlight').length`)) === 1)

  await typeInto('#search', '西瓜')
  await sleep(300)
  check(
    '无结果展示「没搜到」空态',
    (await evaluate(`document.querySelector('#no-result').classList.contains('is-visible')`)) === true &&
      (await evaluate(`document.querySelector('#empty').classList.contains('is-visible')`)) === false
  )

  await click('#search-clear')
  await sleep(300)
  check('点清除后恢复 2 张卡片', (await count()) === 2)

  await reload()
  check('刷新后数据仍在', (await count()) === 2)
  check(
    '刷新后点赞状态保留',
    await evaluate(`Array.from(document.querySelectorAll('.card [data-action="like"]'))
      .some((btn) => btn.getAttribute('aria-pressed') === 'true')`)
  )

  await cdp.send('Emulation.setDeviceMetricsOverride', {
    width: 1280, height: 1000, deviceScaleFactor: 1, mobile: false
  })
  await sleep(400)
  await shot('desktop.png')

  await click('.card [data-action="delete"]')
  await sleep(600)
  check('确认删除后剩 1 张卡片', (await count()) === 1)
  check('删除已同步到存储', (await store()).length === 1)

  await cdp.send('Emulation.setDeviceMetricsOverride', {
    width: 390, height: 844, deviceScaleFactor: 1, mobile: true
  })
  await sleep(500)
  const overflow = await evaluate('document.documentElement.scrollWidth - window.innerWidth')
  check('移动端 390px 无横向溢出', overflow <= 1, `${overflow}px`)
  check(
    '移动端发布按钮通栏',
    await evaluate(`(() => {
      const btn = document.querySelector('#submit-btn');
      const footer = document.querySelector('.composer__footer');
      return Math.abs(btn.getBoundingClientRect().width - footer.getBoundingClientRect().width) < 4;
    })()`)
  )
  await shot('mobile.png')

  check('控制台无异常', errors.length === 0, errors.join(' ; ').slice(0, 160))
}

async function main() {
  if (!existsSync(join(DIST, 'index.html'))) {
    console.error('缺少 dist/index.html，请先运行 npm run build')
    process.exit(1)
  }

  const browser = findBrowser()
  if (!browser) {
    console.error('未找到 Chrome 或 Edge，请用 CHROME_PATH 指定可执行文件路径')
    process.exit(1)
  }

  mkdirSync(SHOT_DIR, { recursive: true })

  const server = await startStaticServer()
  const chrome = spawn(
    browser,
    [
      '--headless=new',
      '--no-sandbox',
      '--disable-gpu',
      '--no-first-run',
      '--disable-extensions',
      '--hide-scrollbars',
      `--remote-debugging-port=${DEBUG_PORT}`,
      `--user-data-dir=${PROFILE_DIR}`,
      '--window-size=1280,1100',
      'about:blank'
    ],
    { stdio: 'ignore' }
  )

  try {
    await waitForDevtools()

    const target = await (
      await fetch(`http://127.0.0.1:${DEBUG_PORT}/json/new?${encodeURIComponent(APP_URL)}`, {
        method: 'PUT'
      })
    ).json()

    const cdp = connect(target.webSocketDebuggerUrl)
    await cdp.ready
    await cdp.send('Runtime.enable')
    await cdp.send('Page.enable')
    await cdp.send('Log.enable')

    await runChecks(cdp)
    cdp.close()
  } catch (error) {
    console.log('FAIL 验收流程异常 | ' + error.message)
    results.push({ name: '验收流程异常', ok: false })
  } finally {
    chrome.kill()
    server.close()
    await sleep(600)
    try {
      rmSync(PROFILE_DIR, { recursive: true, force: true })
    } catch {
      // 浏览器进程可能仍占用临时配置目录，忽略即可（目录已在 .gitignore 中）
    }

    const failed = results.filter((item) => !item.ok).length
    console.log(`\nRESULT: ${failed === 0 ? 'PASS' : 'FAIL'} (${results.length - failed}/${results.length})`)
    console.log(`截图已保存到 ${SHOT_DIR}`)
    process.exit(failed === 0 ? 0 : 1)
  }
}

main()
