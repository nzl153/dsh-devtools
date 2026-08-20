// Smoke test: load built lib/client.js in jsdom and verify the bundle
// registers under the __ModuleLoader__ contract and apply() mounts cleanly.
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import vm from 'node:vm'
import { JSDOM } from 'jsdom'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const code = readFileSync(join(root, 'lib', 'client.js'), 'utf8')

const dom = new JSDOM('<!DOCTYPE html><html><head></head><body></body></html>', {
  url: 'http://127.0.0.1:3080/',
  pretendToBeVisual: true,
})
const { window } = dom

let handoff = null
window.__ModuleLoader__ = { load: (h) => { handoff = h } }

const reactShim = {
  useState: (init) => [typeof init === 'function' ? init() : init, () => {}],
  useEffect: () => {},
  useMemo: (fn) => fn(),
  useCallback: (fn) => fn,
  useRef: () => ({ current: null }),
  createElement: () => ({}),
  Fragment: Symbol('Fragment'),
}
const reactJsxRuntime = { jsx: () => ({}), jsxs: () => ({}) }
const reactDomShim = { createPortal: () => ({}) }
const primitivesShim = new Proxy({}, { get: () => () => ({}) })

vm.createContext(window)
window.require = (spec) => {
  if (spec === 'react') return reactShim
  if (spec === 'react-dom') return reactDomShim
  if (spec === '@deepseek-ai/dsh-client-ui-primitives') return primitivesShim
  if (spec === 'react/jsx-runtime' || spec === 'react/jsx-dev-runtime') return reactJsxRuntime
  if (spec === 'scheduler') return {}
  throw new Error(`unexpected require in smoke: ${spec}`)
}

let failures = 0
const check = (name, ok) => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}`)
  if (!ok) failures++
}

vm.runInContext(code, window, { filename: 'client.js' })
check('bundle registers __ModuleLoader__', handoff !== null && handoff.id === 'dsh-debrief')

const exports_ = handoff.factory(window.require)
check('exports apply', typeof exports_.apply === 'function')
check('exports inject', Array.isArray(exports_.inject))

const registrations = []
const ctx = {
  locale: {
    register: () => () => {},
    bind: () => (key) => key,
  },
  slots: {
    inject: (slotName, fn) => {
      const result = fn()
      registrations.push({ slotName, result })
      return () => {}
    },
    register: (spec, component) => {
      registrations.push({ spec, component })
      return () => {}
    },
  },
  on: () => () => {},
  effect: () => () => {},
  get: () => undefined,
}

try {
  exports_.apply(ctx)
  check('apply mounts without throwing', true)
  const turnTail = registrations.find((r) => r.spec?.name === 'conversation.chat.turnTail')
  check('registered turnTail chain slot', Boolean(turnTail && typeof turnTail.spec?.select === 'function'))
  check('turnTail component is a callable renderer', typeof turnTail?.component === 'function')
  if (turnTail?.spec?.select) {
    check('turnTail selects closed turns', turnTail.spec.select({ turn: { status: 'closed' } }) !== null)
    check('turnTail declines open turns', turnTail.spec.select({ turn: { status: 'open' } }) === null)
  }
  const header = registrations.find((r) => r.slotName === 'conversation.session.header.actions' || r.spec?.name === 'conversation.session.header.actions')
  check('registered header action slot', Boolean(header))
  check('header action component is a callable renderer', typeof header?.component === 'function')
} catch (error) {
  console.error('APPLY_ERROR', error instanceof Error ? (error.stack ?? error.message) : JSON.stringify(error))
  check('apply mounts without throwing', false)
}

console.log(failures === 0 ? '\n全部通过' : `\n${failures} 项失败`)
process.exit(failures === 0 ? 0 : 1)