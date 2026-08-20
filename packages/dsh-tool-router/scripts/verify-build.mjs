// 构建产物守卫：确认 host 与 core 两个 ESM 产物都产出。
import fs from 'node:fs'

const EXPECTED = [
  { file: 'lib/index.js', min: 2000 },
  { file: 'lib/core.js', min: 2000 },
]

let failures = 0
for (const { file, min } of EXPECTED) {
  const exists = fs.existsSync(file)
  const size = exists ? fs.statSync(file).size : 0
  const ok = exists && size >= min
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${file}  ${exists ? size + ' B' : '不存在'}${ok ? '' : `  — 期望至少 ${min} B`}`)
  if (!ok) failures++
}

if (failures > 0) {
  console.error(`\n构建产物不完整（${failures} 项不通过）。不要提交 lib/，先修构建。`)
  process.exit(1)
}
console.log('\n构建产物完整。')