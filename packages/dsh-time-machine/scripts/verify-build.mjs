// 构建产物守卫：确认 host 和 client 两个 half 都产出。
import fs from 'node:fs'

const EXPECTED = [
  { file: 'lib/index.js', min: 4000 },
  { file: 'lib/client.js', min: 10000 },
]

let failures = 0
for (const { file, min } of EXPECTED) {
  const exists = fs.existsSync(file)
  const size = exists ? fs.statSync(file).size : 0
  const ok = exists && size >= min
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${file}  ${exists ? size + ' B' : '不存在'}${ok ? '' : `  — 期望至少 ${min} B`}`)
  if (!ok) failures++
}

if (fs.existsSync('lib/client.js')) {
  const text = fs.readFileSync('lib/client.js', 'utf8')
  const tail = text.trimEnd()
  const ok = text.includes('window.__ModuleLoader__.load(')
    && text.includes('return module.exports;')
    && tail.endsWith('});')
  console.log(`${ok ? 'PASS' : 'FAIL'}  client.js 保留 __ModuleLoader__ 头尾`)
  if (!ok) failures++
}

if (failures > 0) {
  console.error(`\n构建产物不完整（${failures} 项不通过）。不要提交 lib/，先修构建。`)
  process.exit(1)
}
console.log('\n构建产物完整。')
