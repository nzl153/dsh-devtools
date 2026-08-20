/** dsh-debrief client styles, injected once via ctx.effect. */

export function adoptStyles(): void {
  if (document.getElementById('dsh-debrief-styles')) return
  const style = document.createElement('style')
  style.id = 'dsh-debrief-styles'
  style.textContent = `
.dsh-debrief-root { font-size: 12px; line-height: 1.45; color: var(--text-1, #e6e6e6); }
.dsh-debrief-card { border: 1px solid var(--border, rgba(128,128,128,.25)); border-radius: 8px; padding: 6px 8px; margin: 4px 0 10px; background: var(--bg-2, rgba(255,255,255,.02)); }
.dsh-debrief-card-title { font-weight: 600; margin-bottom: 6px; display: flex; align-items: center; gap: 8px; }
.dsh-debrief-card-toggle, .dsh-debrief-card-close { background: transparent; border: 0; color: var(--text-2, #9a9a9a); cursor: pointer; font-size: 14px; line-height: 1; padding: 0 2px; }
.dsh-debrief-card-toggle:hover, .dsh-debrief-card-close:hover { color: var(--text-1, #e6e6e6); }
.dsh-debrief-card-close { margin-left: auto; font-size: 16px; }
.dsh-debrief-metric { display: flex; justify-content: space-between; gap: 8px; padding: 1px 0; }
.dsh-debrief-metric-label { color: var(--text-2, #9a9a9a); }
.dsh-debrief-metric-value { font-variant-numeric: tabular-nums; text-align: right; }
.dsh-debrief-section-title { margin-top: 8px; font-weight: 600; color: var(--text-1, #e6e6e6); }
.dsh-debrief-empty { color: var(--text-3, #777); }
.dsh-debrief-list { margin: 2px 0 0; padding-left: 16px; max-height: 140px; overflow: auto; }
.dsh-debrief-list-item { display: flex; gap: 6px; align-items: baseline; word-break: break-all; }
.dsh-debrief-tag { font-size: 10px; border-radius: 3px; padding: 0 3px; white-space: nowrap; }
.dsh-debrief-tag-exact { background: rgba(80,160,80,.18); color: #7bc47b; }
.dsh-debrief-tag-est { background: rgba(200,160,60,.18); color: #d9b04a; }
.dsh-debrief-exit { font-size: 10px; border-radius: 3px; padding: 0 3px; white-space: nowrap; }
.dsh-debrief-exit-ok { background: rgba(80,160,80,.15); color: #7bc47b; }
.dsh-debrief-exit-bad { background: rgba(200,80,80,.18); color: #e07a7a; }
.dsh-debrief-table { width: 100%; border-collapse: collapse; font-size: 11px; }
.dsh-debrief-table th, .dsh-debrief-table td { text-align: left; padding: 1px 4px; border-bottom: 1px solid var(--border, rgba(128,128,128,.12)); }
.dsh-debrief-tests { font-weight: 600; }
.dsh-debrief-actions { display: flex; gap: 6px; margin-top: 8px; flex-wrap: wrap; }
.dsh-debrief-actions button { font-size: 11px; padding: 2px 8px; border-radius: 4px; border: 1px solid var(--border, rgba(128,128,128,.3)); background: transparent; color: var(--text-1, #e6e6e6); cursor: pointer; }
.dsh-debrief-actions button:hover { background: rgba(128,128,128,.12); }
.dsh-debrief-trigger { border: 1px solid var(--border, rgba(128,128,128,.25)); border-radius: 8px; padding: 6px 8px; margin: 2px 0 10px; background: var(--bg-2, rgba(255,255,255,.02)); display: flex; justify-content: space-between; align-items: center; gap: 8px; }
.dsh-debrief-panel { border: 1px solid var(--border, rgba(128,128,128,.3)); border-radius: 10px; padding: 10px; min-width: 320px; max-width: 460px; background: var(--bg-1, #1b1b1b); }
.dsh-debrief-panel-toolbar { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; }
.dsh-debrief-panel-toolbar h3 { margin: 0; flex: 1; }
.dsh-debrief-note { color: var(--text-3, #999); font-size: 11px; margin-top: 6px; }
.dsh-debrief-scroll { max-height: 60vh; overflow: auto; padding-right: 4px; }
`
  document.head.appendChild(style)
}