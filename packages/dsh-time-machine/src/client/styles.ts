/**
 * Minimal styles for the dsh-time-machine panel. Plain CSS injected into a
 * <style> tag — no framework, no animation (MVP).
 */
let applied = false

export function adoptStyles(doc: Document = document): void {
  if (applied) return
  applied = true
  const style = doc.createElement('style')
  style.textContent = `
[data-tm-root] { display: inline-block; }
.tm-trigger { cursor: pointer; }
.tm-panel {
  position: fixed; inset: auto 16px 16px auto; width: min(760px, 90vw);
  max-height: 80vh; overflow: auto; z-index: 9999;
  background: #fff; color: #1a1a1a; border: 1px solid #d0d0d0;
  border-radius: 8px; padding: 12px 14px; box-shadow: 0 8px 30px rgba(0,0,0,.18);
  font-size: 13px; font-family: system-ui, sans-serif;
}
.tm-toolbar { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; }
.tm-toolbar h3 { flex: 1; }
.tm-note { color: #666; margin: 4px 0; }
.tm-error { color: #c00; }
.tm-filters { display: flex; flex-wrap: wrap; gap: 12px; align-items: center; margin: 8px 0; }
.tm-turns { margin-top: 8px; }
.tm-turn { border: 1px solid #e2e2e2; border-radius: 6px; margin-bottom: 10px; padding: 8px; }
.tm-turn-head { display: flex; align-items: center; gap: 10px; margin-bottom: 6px; }
.tm-change { border-top: 1px dashed #eee; padding: 6px 0; }
.tm-change-head { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
.tm-file { font-family: ui-monospace, monospace; font-weight: 600; }
.tm-badge { padding: 1px 6px; border-radius: 4px; font-size: 11px; }
.tm-badge-added { background: #e6f7e6; color: #1a7f1a; }
.tm-badge-modified { background: #fff3d6; color: #9a6b00; }
.tm-badge-deleted { background: #fdecec; color: #b00020; }
.tm-badge-renamed { background: #e8f0fe; color: #1a56db; }
.tm-muted { color: #888; font-size: 12px; }
.tm-conflict-actions { display: flex; flex-wrap: wrap; gap: 4px; }
.tm-threeway { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; padding: 8px 0; }
.tm-threeway > div { min-width: 0; }
.tm-table .tm-diff { max-height: 200px; overflow: auto; }
.tm-diff {
  background: #f7f7f7; border: 1px solid #eee; padding: 8px; overflow: auto;
  font-family: ui-monospace, monospace; font-size: 12px; white-space: pre;
}
.tm-actions { margin-top: 12px; }
.tm-danger { background: #d33; color: #fff; border: 0; border-radius: 4px; padding: 5px 10px; cursor: pointer; }
.tm-warn { color: #9a6b00; }
.tm-preview { border: 1px solid #d0d0d0; border-radius: 6px; padding: 10px; margin-top: 12px; }
.tm-table { width: 100%; border-collapse: collapse; margin: 6px 0; }
.tm-table th, .tm-table td { border: 1px solid #eee; padding: 4px 6px; text-align: left; }
.tm-preview-actions { display: flex; gap: 8px; align-items: center; }
`
  doc.head.appendChild(style)
}
