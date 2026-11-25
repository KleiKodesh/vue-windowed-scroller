// Browser test of the real component: a row source that is slow, fails, never answers or
// shrinks must never leave the list stuck. `npm run test:e2e`; exits 1 on any failure.
import { fileURLToPath } from 'node:url'
import { createServer } from 'vite'
import { chromium } from 'playwright'

const server = await createServer({
  configFile: fileURLToPath(new URL('../vite.config.ts', import.meta.url)),
  server: { port: 0 },
  logLevel: 'error',
})
await server.listen()
const url = server.resolvedUrls.local[0]
const browser = await chromium.launch({ headless: true })
const results = []
let failed = 0

const frames = (page, n = 10) => page.evaluate((n) => new Promise((resolve) => {
  let i = 0
  const step = () => (++i >= n ? resolve() : requestAnimationFrame(step))
  requestAnimationFrame(step)
}), n)
const state = (page) => page.evaluate(() => {
  const viewport = document.querySelector('#viewport')
  const indexes = [...viewport.querySelectorAll('.windowed-scroller-row:not(.pinned-out-of-window)')].map((row) => Number(row.dataset.index))
  return {
    first: Math.min(...indexes),
    last: Math.max(...indexes),
    atBottom: viewport.scrollTop >= viewport.scrollHeight - viewport.clientHeight - 1,
    requests: window.rig.requests,
  }
})
const setMode = (page, mode) => page.evaluate((mode) => { window.rig.mode = mode }, mode)

/** Scrolls to the end of the mounted rows until the window stops growing. */
async function toEdge(page) {
  let previous = -1
  for (let i = 0; i < 40; i++) {
    await page.evaluate(() => { const viewport = document.querySelector('#viewport'); viewport.scrollTop = viewport.scrollHeight })
    await frames(page, 6)
    const now = await state(page)
    if (now.last === previous && now.atBottom) return now
    previous = now.last
  }
  return state(page)
}

async function wheel(page, x, y, times) {
  await page.mouse.move(x, y)
  for (let i = 0; i < times; i++) {
    await page.mouse.wheel(0, 300)
    await frames(page, 8)
  }
}

async function test(name, body) {
  const page = await browser.newPage({ viewport: { width: 900, height: 700 } })
  const errors = []
  page.on('pageerror', (error) => errors.push(error.message))
  try {
    await page.goto(url)
    await page.waitForFunction(() => document.querySelectorAll('.windowed-scroller-row').length > 5, null, { timeout: 30000 })
    const { pass, detail } = await body(page)
    const ok = pass && errors.length === 0
    if (!ok) failed++
    results.push(`${ok ? 'PASS' : 'FAIL'}  ${name}  ${detail}${errors.length ? `  errors: ${errors.join('; ')}` : ''}`)
  } catch (error) {
    failed++
    results.push(`FAIL  ${name}  ${error.message}`)
  } finally {
    await page.close()
  }
}

try {
  await test('a failed read at the edge, then a wheel over the rows loads on', async (page) => {
    await setMode(page, 'fail')
    const stuck = await toEdge(page)
    await setMode(page, 'ok')
    await frames(page, 30)
    const idle = await state(page)
    await wheel(page, 300, 300, 3)
    const after = await state(page)
    return {
      pass: after.last > stuck.last && idle.requests === stuck.requests,
      detail: `last row ${stuck.last} -> ${after.last}; requests without input ${idle.requests - stuck.requests}`,
    }
  })

  await test('a failed read at the edge, then PageDown loads on', async (page) => {
    await setMode(page, 'fail')
    const stuck = await toEdge(page)
    await setMode(page, 'ok')
    await page.focus('#viewport')
    for (let i = 0; i < 3; i++) {
      await page.keyboard.press('PageDown')
      await frames(page, 8)
    }
    const after = await state(page)
    return { pass: after.last > stuck.last, detail: `last row ${stuck.last} -> ${after.last}` }
  })

  await test('a failed read at the edge, then a wheel over the scrollbar loads on', async (page) => {
    await setMode(page, 'fail')
    const stuck = await toEdge(page)
    await setMode(page, 'ok')
    const bar = await page.evaluate(() => {
      const box = document.querySelector('.windowed-scroller-bar').getBoundingClientRect()
      return { x: box.left + box.width / 2, y: box.top + box.height / 2 }
    })
    await wheel(page, bar.x, bar.y, 3)
    const after = await state(page)
    return { pass: after.last > stuck.last, detail: `last row ${stuck.last} -> ${after.last}` }
  })

  await test('a read that never answers does not stop the list growing after a jump', async (page) => {
    await setMode(page, 'hang')
    await toEdge(page)
    await setMode(page, 'ok')
    await page.evaluate(() => window.rig.scrollToIndex(5000))
    await frames(page, 10)
    const landed = await state(page)
    await wheel(page, 300, 300, 12)
    const after = await state(page)
    return {
      pass: landed.first <= 5000 && after.last > landed.last + 20,
      detail: `landed ${landed.first}-${landed.last}, then last row ${after.last}`,
    }
  })

  await test('a slow read: pushing meanwhile sends no extra requests; rows appear when it arrives', async (page) => {
    await setMode(page, 'slow')
    const stuck = await toEdge(page)
    await wheel(page, 300, 300, 5)
    const pushed = await state(page)
    await page.evaluate(() => window.rig.release())
    await frames(page, 20)
    const after = await state(page)
    return {
      pass: after.last > stuck.last && pushed.requests === stuck.requests,
      detail: `last row ${stuck.last} -> ${after.last}; requests while waiting ${pushed.requests - stuck.requests}`,
    }
  })

  await test('the list shrinking during a read mounts nothing past its end', async (page) => {
    await setMode(page, 'slow')
    const stuck = await toEdge(page)
    const count = stuck.last + 4
    await page.evaluate((n) => window.rig.setCount(n), count)
    await frames(page, 6)
    await page.evaluate(() => window.rig.release())
    await frames(page, 20)
    const after = await state(page)
    return { pass: after.last <= count - 1, detail: `count ${count}, last mounted row ${after.last}` }
  })

  await test('plain scrolling grows the window ahead of the reader', async (page) => {
    await wheel(page, 300, 300, 40)
    const after = await state(page)
    return { pass: after.last > 200 && after.first > 100, detail: `rows ${after.first}-${after.last}, requests ${after.requests}` }
  })
} finally {
  await browser.close()
  await server.close()
}

for (const line of results) console.log(line)
console.log(failed ? `${failed} FAILED` : 'all passed')
process.exit(failed ? 1 : 0)
