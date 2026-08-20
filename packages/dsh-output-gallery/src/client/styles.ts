/** dsh-output-gallery client styles. Scoped under [data-gallery-root]. */
export function adoptStyles(): void {
  const id = 'dsh-output-gallery-styles'
  if (document.getElementById(id)) return
  const style = document.createElement('style')
  style.id = id
  style.textContent = `
[data-gallery-root] .gallery-trigger {
  border: 1px solid rgba(128,128,128,.4);
  background: transparent;
  color: inherit;
  border-radius: 6px;
  padding: 2px 8px;
  font-size: 12px;
  cursor: pointer;
}
[data-gallery-root] .gallery-panel {
  position: fixed;
  top: 72px;
  right: 16px;
  width: min(720px, 92vw);
  max-height: 80vh;
  overflow: auto;
  background: var(--bg, #ffffff);
  color: var(--fg, #1a1a1a);
  border: 1px solid rgba(128,128,128,.35);
  border-radius: 10px;
  box-shadow: 0 8px 30px rgba(0,0,0,.28);
  z-index: 9999;
  padding: 12px 14px;
  font-size: 13px;
  line-height: 1.5;
}
[data-gallery-root] .gallery-panel h3 { margin: 0 0 8px; font-size: 15px; }
[data-gallery-root] .gallery-toolbar { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin-bottom: 10px; }
[data-gallery-root] .gallery-toolbar button {
  border: 1px solid rgba(128,128,128,.4);
  background: transparent; color: inherit; border-radius: 6px; padding: 2px 10px; cursor: pointer;
}
[data-gallery-root] .gallery-toolbar select {
  border: 1px solid rgba(128,128,128,.4);
  border-radius: 6px; background: transparent; color: inherit; padding: 2px 6px;
}
[data-gallery-root] .gallery-tabs { display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 8px; }
[data-gallery-root] .gallery-tabs button {
  border: 1px solid transparent; background: transparent; color: inherit;
  border-radius: 12px; padding: 2px 10px; cursor: pointer; opacity: .7;
}
[data-gallery-root] .gallery-tabs button.active { border-color: rgba(128,128,128,.5); opacity: 1; background: rgba(128,128,128,.12); }
[data-gallery-root] .gallery-count { color: rgba(128,128,128,.9); font-weight: normal; }
[data-gallery-root] .gallery-table { width: 100%; border-collapse: collapse; }
[data-gallery-root] .gallery-table th, [data-gallery-root] .gallery-table td {
  text-align: left; padding: 5px 8px; border-bottom: 1px solid rgba(128,128,128,.18); vertical-align: top;
  word-break: break-all;
}
[data-gallery-root] .gallery-table th { font-weight: 600; font-size: 12px; opacity: .7; }
[data-gallery-root] .gallery-row { cursor: pointer; }
[data-gallery-root] .gallery-row:hover { background: rgba(128,128,128,.08); }
[data-gallery-root] .gallery-row.changed td { background: rgba(255,200,0,.08); }
[data-gallery-root] .gallery-path { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 12px; }
[data-gallery-root] .gallery-preview-box {
  margin-top: 10px; border: 1px solid rgba(128,128,128,.3); border-radius: 8px; padding: 10px; background: rgba(128,128,128,.05);
  max-height: 320px; overflow: auto; font-size: 12px;
}
[data-gallery-root] .gallery-preview-box img { max-width: 100%; max-height: 260px; }
[data-gallery-root] .gallery-preview-box pre { white-space: pre-wrap; margin: 0; font-size: 12px; }
[data-gallery-root] .gallery-preview-box iframe { width: 100%; height: 260px; border: none; background: #fff; }
[data-gallery-root] .gallery-json { font-family: ui-monospace, monospace; white-space: pre-wrap; }
[data-gallery-root] .gallery-versions { font-size: 12px; color: #b8860b; }
[data-gallery-root] .gallery-related { font-size: 12px; color: rgba(0,0,0,.55); font-family: ui-monospace, monospace; }
[data-gallery-root] .gallery-pin { border: 1px solid rgba(128,128,128,.4); background: transparent; color: inherit; border-radius: 6px; padding: 1px 6px; cursor: pointer; font-size: 11px; }
[data-gallery-root] .gallery-pin.pinned { border-color: #b8860b; background: rgba(184,134,11,.12); }
[data-gallery-root] .gallery-deliverable-mode { display: inline-flex; align-items: center; gap: 4px; }
[data-gallery-root] .gallery-note { color: rgba(128,128,128,.9); margin: 4px 0; }
[data-gallery-root] .gallery-error { color: #c0392b; }
`
  document.head.appendChild(style)
}