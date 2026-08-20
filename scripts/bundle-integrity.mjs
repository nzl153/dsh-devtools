/**
 * 产物完整性检查：找出「引用了但整个产物里从未定义」的标识符。
 *
 * 针对的是 2026-08-19 那次事故：Shell.tsx 里 setToolkitOpenId 用了没 import，
 * tsdown 认为没人用把它摇掉了，编译期一声不响，点关闭按钮才 ReferenceError。
 *
 * 做法：把 lib/*.js 解析成 AST，收集全部「声明过的名字」和「被引用的名字」，
 * 引用里减去声明和已知全局，剩下的就是会在运行时炸的。
 *
 * 边界（故意的）：不做作用域分析——某个名字只要在文件任何地方被声明过就算数。
 * 所以它漏报「跨作用域引用」，但不误报。上次那个 bug 属于「哪里都没声明」，能抓到。
 */
import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'

const ts = createRequire(import.meta.url)('typescript')
const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..')

const KNOWN_GLOBALS = new Set([
  'globalThis','window','document','navigator','location','history','console',
  'setTimeout','clearTimeout','setInterval','clearInterval','queueMicrotask',
  'requestAnimationFrame','cancelAnimationFrame','fetch','Headers','Request','Response',
  'URL','URLSearchParams','FormData','Blob','File','FileReader','AbortController',
  'Object','Array','String','Number','Boolean','Symbol','BigInt','Math','JSON','Date',
  'RegExp','Error','TypeError','RangeError','SyntaxError','ReferenceError',
  'Map','Set','WeakMap','WeakSet','Promise','Proxy','Reflect','Intl',
  'parseInt','parseFloat','isNaN','isFinite','encodeURIComponent','decodeURIComponent',
  'undefined','NaN','Infinity','require','module','exports','process','Buffer',
  'localStorage','sessionStorage','CustomEvent','Event','EventTarget','MutationObserver',
  'ResizeObserver','IntersectionObserver','getComputedStyle','matchMedia','structuredClone',
  'HTMLElement','Element','Node','Text','SVGElement','DOMParser','WebSocket','crypto',
  'atob','btoa','TextEncoder','TextDecoder','performance','alert','confirm','prompt',
  'ArrayBuffer','SharedArrayBuffer','DataView','Atomics',
  'Int8Array','Uint8Array','Uint8ClampedArray','Int16Array','Uint16Array',
  'Int32Array','Uint32Array','Float32Array','Float64Array','BigInt64Array','BigUint64Array',
  'AggregateError','EvalError','URIError','FinalizationRegistry','WeakRef',
  'AbortSignal','MessageChannel','MessagePort','Worker','ReadableStream','WritableStream',
  'TransformStream','CompressionStream','DecompressionStream','EventSource','Notification',
  'Image','Audio','Option','XMLHttpRequest','DOMException','CSS','Range','Selection',
  '__dirname','__filename','import',
])

function analyse(pkgDir, file) {
  const code = readFileSync(join(pkgDir, file), 'utf8')
  const sf = ts.createSourceFile(file, code, ts.ScriptTarget.ESNext, true, ts.ScriptKind.JS)

  const declared = new Set()
  const referenced = new Map() // name -> 首次出现行号

  const declareBinding = (name) => {
    if (!name) return
    if (ts.isIdentifier(name)) declared.add(name.text)
    else if (ts.isObjectBindingPattern(name) || ts.isArrayBindingPattern(name)) {
      for (const el of name.elements) {
        if (ts.isBindingElement(el)) declareBinding(el.name)
      }
    }
  }

  const walk = (node) => {
    // ── 收集声明 ──
    if (ts.isVariableDeclaration(node) || ts.isParameter(node)) declareBinding(node.name)
    else if (ts.isFunctionDeclaration(node) || ts.isClassDeclaration(node)) {
      if (node.name) declared.add(node.name.text)
    } else if (ts.isFunctionExpression(node) || ts.isClassExpression(node)) {
      if (node.name) declared.add(node.name.text)
    } else if (ts.isImportClause(node)) {
      if (node.name) declared.add(node.name.text)
    } else if (ts.isImportSpecifier(node) || ts.isNamespaceImport(node)) {
      declared.add(node.name.text)
    } else if (ts.isCatchClause(node) && node.variableDeclaration) {
      declareBinding(node.variableDeclaration.name)
    } else if (ts.isBindingElement(node)) {
      declareBinding(node.name)
    }

    // ── 收集引用 ──
    if (ts.isIdentifier(node)) {
      const p = node.parent
      const isPropertyAccess = ts.isPropertyAccessExpression(p) && p.name === node
      const isPropertyName =
        (ts.isPropertyAssignment(p) || ts.isMethodDeclaration(p) ||
         ts.isPropertySignature(p) || ts.isPropertyDeclaration(p) ||
         ts.isGetAccessorDeclaration(p) || ts.isSetAccessorDeclaration(p) ||
         ts.isEnumMember(p)) && p.name === node
      const isBindingName =
        (ts.isVariableDeclaration(p) || ts.isParameter(p) ||
         ts.isBindingElement(p) || ts.isFunctionDeclaration(p) ||
         ts.isClassDeclaration(p) || ts.isImportSpecifier(p) ||
         ts.isNamespaceImport(p) || ts.isImportClause(p)) && p.name === node
      const isLabel = ts.isLabeledStatement(p) || ts.isBreakOrContinueStatement(p)
      const isMetaProperty = ts.isMetaProperty(p)          // import.meta / new.target

      if (!isPropertyAccess && !isPropertyName && !isBindingName && !isLabel && !isMetaProperty) {
        if (!referenced.has(node.text)) {
          const { line } = sf.getLineAndCharacterOfPosition(node.getStart(sf))
          referenced.set(node.text, line + 1)
        }
      }
    }

    ts.forEachChild(node, walk)
  }
  walk(sf)

  const missing = []
  for (const [name, line] of referenced) {
    if (declared.has(name) || KNOWN_GLOBALS.has(name)) continue
    missing.push({ name, line })
  }
  return { file, declared: declared.size, referenced: referenced.size, missing }
}

const packagesDir = join(repoRoot, 'packages')
const pkgs = readdirSync(packagesDir).filter((n) => existsSync(join(packagesDir, n, 'lib')))

let failures = 0
let scanned = 0

for (const pkg of pkgs) {
  const libDir = join(packagesDir, pkg, 'lib')
  const files = readdirSync(libDir).filter((f) => f.endsWith('.js'))
  if (files.length === 0) continue

  const bad = []
  for (const file of files) {
    const r = analyse(libDir, file)
    scanned++
    if (r.missing.length > 0) bad.push({ file, missing: r.missing })
  }

  if (bad.length === 0) {
    console.log(`PASS  ${pkg}  (${files.length} 个产物)`)
  } else {
    failures++
    console.log(`FAIL  ${pkg}`)
    for (const b of bad) {
      console.log(`        lib/${b.file}:`)
      for (const m of b.missing) console.log(`          ${m.name}  (第 ${m.line} 行)`)
    }
  }
}

console.log(
  failures === 0
    ? `
产物完整性检查通过（${pkgs.length} 个包 / ${scanned} 个文件）`
    : `
${failures} 个包有未定义标识符`,
)
process.exit(failures === 0 ? 0 : 1)
