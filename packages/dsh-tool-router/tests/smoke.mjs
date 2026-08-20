// dsh-tool-router smoke tests against the built core.
import assert from 'node:assert/strict'
import {
  classifyTool,
  planRoute,
  routeCategories,
} from '../lib/core.js'

const tools = [
  { name: 'read', description: 'Read a file from the workspace.' },
  { name: 'write', description: 'Write a file.' },
  { name: 'grep', description: 'Search file contents with regex.' },
  { name: 'bash', description: 'Run a shell command.' },
  { name: 'web_search', description: 'Search the web.' },
  { name: 'web_fetch', description: 'Fetch a URL.' },
]

// Classification
assert.equal(classifyTool({ name: 'read' }).category, 'filesystem')
assert.equal(classifyTool({ name: 'grep' }).category, 'search')
assert.equal(classifyTool({ name: 'web_search' }).category, 'web')
assert.equal(classifyTool({ name: 'bash' }).category, 'shell')

// Heuristic routing
const edit = routeCategories({ prompt: '修改 README', recent: '' })
assert.ok(edit.categories.includes('filesystem'), 'edit prompt should select filesystem')
assert.ok(edit.categories.includes('search'), 'edit prompt should also select search (README/find terms)')

const web = routeCategories({ prompt: '查网页', recent: '' })
assert.ok(web.categories.includes('web'), 'web prompt should select web')
assert.ok(web.categories.includes('browser'), 'web prompt should select browser')

// Adaptive filtering hides unrelated tools but keeps always-visible safe set
const plan = planRoute(tools, { prompt: '修改 README', recent: '' }, {
  mode: 'adaptive',
  alwaysVisible: ['read'],
  minimumSafeTools: ['bash', 'read', 'search'],
  fallbackToolName: 'request_tools',
  enabledCategories: [],
})
assert.ok(plan.hiddenNames.includes('web_search'), 'web_search should be hidden for a file-edit prompt')
assert.ok(plan.visibleNames.includes('read'), 'read should stay visible')
assert.ok(plan.visibleNames.includes('bash'), 'bash should stay visible')
assert.ok(plan.visibleNames.includes('grep'), 'grep should stay visible (search category)')
assert.ok(plan.savedTokens > 0, 'adaptive mode should save tokens')

// Observe mode does not hide anything
const observe = planRoute(tools, { prompt: '修改 README', recent: '' }, {
  mode: 'observe',
  alwaysVisible: ['read'],
  minimumSafeTools: ['bash', 'read', 'search'],
  fallbackToolName: 'request_tools',
  enabledCategories: [],
})
assert.equal(observe.hiddenNames.length, 0, 'observe mode must not hide tools')

console.log('smoke: all assertions passed')