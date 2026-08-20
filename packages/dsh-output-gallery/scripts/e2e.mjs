// E2E: creates a temporary workspace, simulates several file create/modify
// turns through the core scanner + indexer, and asserts the gallery list and
// version history are correct. Does not start DSH.
//
// Usage: node scripts/e2e.mjs   (requires `pnpm build` to have produced lib/)
import { mkdtemp, rm, mkdir, writeFile, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

const { createGalleryStore, runStandaloneIndex, scanWorkspace, buildPreview } = await import('../lib/index.js')
const { DEFAULT_CONFIG, applyRelatedCommands, findRelatedCommand } = await import('../lib/core.js')

const root = await mkdtemp(join(tmpdir(), 'dsh-output-gallery-e2e-'))
const ws = join(root, 'workspace')
const storeDir = join(root, 'store')

let failures = 0
const check = (label, ok, extra = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${extra ? `  — ${extra}` : ''}`)
  if (!ok) failures++
}

function assert(cond, label, extra = '') { check(label, !!cond, extra) }

try {
  await mkdir(join(ws, 'out'), { recursive: true })
  await mkdir(join(ws, 'assets'), { recursive: true })
  await mkdir(join(ws, 'node_modules', 'x'), { recursive: true })

  // Turn 5: write a markdown report and a png, plus noise inside node_modules.
  await writeFile(join(ws, 'out', 'report.md'), '# v1\nhello world\n', 'utf8')
  await writeFile(join(ws, 'assets', 'logo.png'), 'fake-png-bytes', 'utf8')
  await writeFile(join(ws, 'node_modules', 'x', 'index.js'), 'noise', 'utf8')

  const store = await createGalleryStore(storeDir)
  const sessionId = 'e2e-session-1'

  const first = await runStandaloneIndex(store, ws, sessionId, 5)
  assert(first.added === 2, 'turn 5 added 2 files', `got ${first.added}`)
  assert(first.scannedFiles === 2, 'scanner excluded node_modules noise', `scanned ${first.scannedFiles}`)
  const list1 = await store.read(sessionId)
  assert(list1.files.length === 2, 'gallery lists 2 files')
  const report1 = list1.files.find((f) => f.path === 'out/report.md')
  assert(report1?.category === 'documents', 'report classified as documents')
  assert(report1?.previewKind === 'markdown', 'report preview kind markdown')
  const png1 = list1.files.find((f) => f.path === 'assets/logo.png')
  assert(png1?.category === 'images', 'png classified as images')

  // Turn 9: report changes content (size changes).
  await writeFile(join(ws, 'out', 'report.md'), '# v2\nhello world\nmore lines\n', 'utf8')
  const second = await runStandaloneIndex(store, ws, sessionId, 9)
  assert(second.changed === 1, 'turn 9 detected 1 change', `got ${second.changed}`)
  const list2 = await store.read(sessionId)
  const report2 = list2.files.find((f) => f.path === 'out/report.md')
  assert(report2.changed === true, 'report flagged changed')
  const vRec = list2.versions.find((v) => v.key === 'out/report.md')
  assert(vRec?.turns.includes(5) && vRec.turns.includes(9), 'version history has turns 5 and 9', JSON.stringify(vRec?.turns))
  assert(list2.changedTurns.includes(5) && list2.changedTurns.includes(9), 'changedTurns includes 5 and 9')

  // Turn 14: report changes again; add a new json data file.
  await writeFile(join(ws, 'out', 'report.md'), '# v3\nfinal\n', 'utf8')
  await writeFile(join(ws, 'data.json'), '{"a":1}', 'utf8')
  const third = await runStandaloneIndex(store, ws, sessionId, 14)
  assert(third.added === 1, 'turn 14 added 1 file (data.json)')
  assert(third.changed === 1, 'turn 14 changed 1 file (report.md)')
  const list3 = await store.read(sessionId)
  const vRec3 = list3.versions.find((v) => v.key === 'out/report.md')
  assert(JSON.stringify(vRec3.turns) === JSON.stringify([5, 9, 14]), 'report version turns = [5,9,14]', JSON.stringify(vRec3.turns))
  const dataFile = list3.files.find((f) => f.path === 'data.json')
  assert(dataFile?.category === 'data' && dataFile.previewKind === 'json', 'data.json classified as data/json')

  // Related-command recognition from synthetic session events (pure core logic).
  const events = [
    { type: 'turn/start', seq: 1, data: { turn: 5 } },
    { type: 'tool/call', seq: 2, data: { turn: 5, name: 'write', arguments: JSON.stringify({ file_path: 'out/report.md', content: 'x' }) } },
    { type: 'tool/call', seq: 3, data: { turn: 9, name: 'bash', arguments: JSON.stringify({ command: 'cat out/report.md' }) } },
  ]
  const rc = findRelatedCommand(events, 'out/report.md')
  assert(rc?.tool === 'write' && rc.confidence === 'high', 'related command prefers write over bash mention', JSON.stringify(rc))
  const relatedSession = applyRelatedCommands(list3, events)
  const relatedReport = relatedSession.files.find((f) => f.path === 'out/report.md')
  assert(relatedReport?.relatedCommand?.command === 'write out/report.md', 'related command attached to session files', relatedReport?.relatedCommand?.command)

  // Deliverables pinning persists across a later scan.
  const pinnedSession = await store.read(sessionId)
  pinnedSession.pins = { 'out/report.md': true }
  await store.write(pinnedSession)
  const pinRes = await runStandaloneIndex(store, ws, sessionId, 15)
  assert(pinRes.changed === 0, 'turn 15 unchanged before pin assertions', `changed ${pinRes.changed}`)
  const pinnedList = await store.read(sessionId)
  const pinnedReport = pinnedList.files.find((f) => f.path === 'out/report.md')
  assert(pinnedList.pins['out/report.md'] === true, 'pin persisted in sidecar store')
  assert(pinnedReport?.pinned === true, 'rebuilt file keeps pinned=true')

  // Markdown preview is served as plain text (safe, no HTML conversion).
  const mdPreview = await buildPreview(
    { ...list3.files.find((f) => f.path === 'out/report.md'), absPath: join(ws, 'out', 'report.md') },
    list3.config ?? DEFAULT_CONFIG,
    ws,
  )
  assert(mdPreview.kind === 'markdown' && typeof mdPreview.content === 'string', 'markdown preview payload is markdown text', JSON.stringify(mdPreview))

  // Config-file include/exclude path via scanWorkspace directly.
  await mkdir(join(ws, '.dsh'), { recursive: true })
  await writeFile(join(ws, '.dsh', 'output-gallery.yml'), 'exclude: [out/**]\ninclude: []\n', 'utf8')
  const cfgScan = await scanWorkspace({ workspace: ws, turn: 20 })
  assert(cfgScan.configSource === 'file', 'config file detected')
  const cfgPaths = cfgScan.files.map((f) => f.path)
  assert(cfgPaths.every((p) => !p.startsWith('out/')), 'exclude rule excluded out/ files', cfgPaths.join(','))

  // Preview safety: executable is metadata-only.
  await writeFile(join(ws, 'build.sh'), '#!/bin/sh\necho hi\n', 'utf8')
  const withBuild = await runStandaloneIndex(store, ws, sessionId, 21)
  const buildFile = withBuild.files.find((f) => f.path === 'build.sh')
  assert(buildFile?.risk === 'danger', 'build.sh marked dangerous')
  const pv = await buildPreview(buildFile, withBuild.config, ws)
  assert(pv.kind === 'none', 'dangerous file preview is none', JSON.stringify(pv))
} catch (error) {
  console.error('E2E_ERROR', error instanceof Error ? (error.stack ?? error.message) : String(error))
  failures++
} finally {
  await rm(root, { recursive: true, force: true })
}

console.log(failures === 0 ? '\nE2E 全部通过' : `\nE2E ${failures} 项失败`)
process.exit(failures === 0 ? 0 : 1)