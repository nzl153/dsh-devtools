// dsh-dev-loop preset 生成 CLI。
// 用法：
//   pnpm preset --framework node --name MyApp                       # 打印到 stdout
//   pnpm preset --framework dotnet --name MyApp --output .dsh/devloop.yml
// 带 --output 时若目标文件已存在则拒绝覆盖（除非显式 --force，但默认不鼓励覆盖配置）。
import { existsSync, writeFileSync, mkdirSync } from 'node:fs'
import { join, resolve, dirname } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const libIndex = join(root, 'lib', 'index.js')

if (!existsSync(libIndex)) {
  console.error('lib/index.js 不存在，请先运行 pnpm build')
  process.exit(1)
}

const args = process.argv.slice(2)
function flag(name) {
  const i = args.indexOf(`--${name}`)
  if (i < 0) return undefined
  return args[i + 1]
}

const framework = flag('framework')
const name = flag('name') ?? 'My Project'
const rootPath = flag('root') ?? root
const output = flag('output')
const force = args.includes('--force')

const allowed = ['node', 'python', 'rust', 'dotnet', 'godot']
if (!framework || !allowed.includes(framework)) {
  console.error(`用法: node scripts/generate-preset.mjs --framework <${allowed.join('|')}> [--name NAME] [--root PATH] [--output PATH]`)
  process.exit(1)
}

const { generateTemplate } = await import(pathToFileURL(libIndex).href)
const text = generateTemplate(framework, name, rootPath)

if (output) {
  const target = resolve(root, output)
  if (existsSync(target) && !force) {
    console.error(`目标文件已存在，拒绝覆盖: ${target}`)
    console.error('确认要覆盖请加 --force；这会覆盖现有配置，请自行确认。')
    process.exit(1)
  }
  mkdirSync(dirname(target), { recursive: true })
  writeFileSync(target, text, 'utf8')
  console.log(`已写入 ${target}`)
} else {
  process.stdout.write(text)
}