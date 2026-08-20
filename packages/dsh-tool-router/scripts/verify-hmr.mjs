// verify-hmr：校验 dsh-tool-router（host-only）的 profile link / realpath。
// 宿主 half 改动需要 DSH 重启；脚本仍会尝试对比 graph rev 以便及时发现已装配的版本。
import { createHash } from 'node:crypto'
import { readFileSync, realpathSync, existsSync, statSync } from 'node:fs'
import { join, dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { homedir } from 'node:os'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const profile = process.argv.find((a) => a.startsWith('--profile='))?.split('=')[1] ?? 'web'
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))
const name = pkg.name
const bundlePath = join(root, 'lib/index.js')

let failures = 0
const check = (label, ok, extra = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${extra ? `  — ${extra}` : ''}`)
  if (!ok) failures++
}

const hasBundle = existsSync(bundlePath)
check('host bundle 存在', hasBundle, hasBundle ? bundlePath : '缺少 lib/index.js')

const dshHome = process.env.DSH_HOME ?? join(homedir(), '.dsh')
const profileDir = join(dshHome, 'profiles', profile)
const profilePkgPath = join(profileDir, 'package.json')
let linkOk = false
let linkDetail = 'profile package.json 不可读'
if (existsSync(profilePkgPath)) {
  const profilePkg = JSON.parse(readFileSync(profilePkgPath, 'utf8'))
  const dep = profilePkg.dependencies?.[name] ?? profilePkg.devDependencies?.[name] ?? ''
  const norm = (p) => p.replaceAll('/', '/').replace(/^[A-Za-z]:/, (m) => m.toUpperCase())
  const rootNorm = norm(root)
  if (typeof dep === 'string' && dep.startsWith('link:')) {
    const linkTarget = norm(dep.slice(5))
    linkOk = linkTarget.toLowerCase() === rootNorm.toLowerCase()
    linkDetail = `依赖声明 link:${dep.slice(5)}`
  } else {
    linkDetail = `依赖声明为 ${dep || '未找到'}`
  }
}

const nmLink = join(profileDir, 'node_modules', name)
let realOk = false
let realDetail = 'node_modules 链接不可读'
try {
  const actual = realpathSync(nmLink)
  realOk = actual.toLowerCase() === root.toLowerCase()
  realDetail = `realpath → ${actual}`
} catch {
  realDetail = 'node_modules 下没有该包'
}

let hash = ''
if (hasBundle) {
  hash = createHash('sha1').update(readFileSync(bundlePath)).digest('hex').slice(0, 12)
}

let revOk = false
let revDetail = 'DSH 未运行或 /plugins/events 不可达'
const baseUrl = process.env.DSH_WEB_URL ?? 'http://127.0.0.1:3080'
const controller = new AbortController()
const timer = setTimeout(() => controller.abort(), 3000)
try {
  const res = await fetch(`${baseUrl}/plugins/events`, { signal: controller.signal })
  if (res.ok) {
    const reader = res.body.getReader()
    const decoder = new TextDecoder()
    let buf = ''
    let graphRev = null
    let done = false
    while (!done) {
      const { done: d, value } = await reader.read()
      if (d) break
      buf += decoder.decode(value, { stream: true })
      const match = buf.match(/data: (\{.*?\})\n\n/)
      if (match) {
        const frame = JSON.parse(match[1])
        if (frame.type === 'graph') {
          const row = frame.graph?.entries?.find((e) => e.id === name)
          graphRev = row?.rev ?? null
          done = true
        }
      }
    }
    if (graphRev) {
      revOk = graphRev === hash
      revDetail = `graph rev=${graphRev}，本地 hash=${hash}`
    }
  }
} catch {
  revDetail = 'DSH 未运行或 /plugins/events 不可达'
} finally {
  clearTimeout(timer)
}

check('profile link 指向当前仓库', linkOk, linkDetail)
check('node_modules realpath 指向当前仓库', realOk, realDetail)
check('DSH graph rev 与本地 bundle hash 一致', revOk, revDetail)

if (hasBundle) {
  const st = statSync(bundlePath)
  console.log(`\n${name} host bundle: ${bundlePath}`)
  console.log(`  mtime: ${st.mtime.toISOString()}  size: ${st.size} B  hash: ${hash}`)
}
console.log(linkOk && realOk ? '\nProfile 链路就绪。' : `\n${failures} 项不通过，先修再开发。`)
process.exit(failures === 0 ? 0 : 1)