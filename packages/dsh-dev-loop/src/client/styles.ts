// dsh-dev-loop：面板样式（scoped class，注入全局 <style> 一次）。
export function adoptStyles(): void {
  if (typeof document === 'undefined') return
  if (document.getElementById('dsh-dev-loop-styles')) return
  const style = document.createElement('style')
  style.id = 'dsh-dev-loop-styles'
  style.textContent = `
.dsh-devloop-root { font: 13px/1.5 system-ui, sans-serif; }
.dsh-devloop-root * { box-sizing: border-box; }
.dsh-devloop-trigger {
  border: 1px solid var(--dv-border, rgba(128,128,128,.4));
  background: var(--dv-bg, transparent);
  color: var(--dv-fg, inherit);
  border-radius: 6px; padding: 4px 8px; cursor: pointer;
}
.dsh-devloop-trigger:hover { background: var(--dv-bg-hover, rgba(128,128,128,.12)); }
.dsh-devloop-panel {
  position: fixed; top: 64px; right: 24px; width: 460px; max-height: 80vh;
  background: var(--dv-panel, #fff); color: var(--dv-fg, #1a1a1a);
  border: 1px solid var(--dv-border, rgba(0,0,0,.15));
  border-radius: 10px; box-shadow: 0 8px 30px rgba(0,0,0,.18);
  display: flex; flex-direction: column; z-index: 999;
  overflow: hidden;
}
.dsh-devloop-head {
  display: flex; align-items: center; justify-content: space-between;
  padding: 10px 14px; border-bottom: 1px solid var(--dv-border, rgba(0,0,0,.12));
}
.dsh-devloop-head-title { font-weight: 600; }
.dsh-devloop-close { border: none; background: none; cursor: pointer; font-size: 16px; opacity: .7; }
.dsh-devloop-body { padding: 12px 14px; overflow: auto; }
.dsh-devloop-actions { display: flex; flex-wrap: wrap; gap: 8px; margin: 10px 0; }
.dsh-devloop-action-btn {
  border: 1px solid var(--dv-border, rgba(0,0,0,.25));
  background: var(--dv-bg, #f5f5f5); color: var(--dv-fg, #1a1a1a);
  border-radius: 6px; padding: 6px 12px; cursor: pointer; font-size: 13px;
}
.dsh-devloop-action-btn:hover:not(:disabled) { background: var(--dv-bg-hover, #e8e8e8); }
.dsh-devloop-action-btn:disabled { opacity: .5; cursor: default; }
.dsh-devloop-status-chip {
  display: inline-block; padding: 2px 8px; border-radius: 999px; font-size: 12px;
  margin-left: 6px; font-weight: 600;
}
.dsh-devloop-records { display: flex; flex-direction: column; gap: 8px; }
.dsh-devloop-record {
  border: 1px solid var(--dv-border, rgba(0,0,0,.12)); border-radius: 8px; padding: 8px 10px;
}
.dsh-devloop-record-head { display: flex; align-items: center; gap: 8px; }
.dsh-devloop-record-meta { font-size: 12px; color: var(--dv-muted, #777); }
.dsh-devloop-output {
  margin-top: 6px; font-family: ui-monospace, SFMono-Regular, Consolas, monospace;
  font-size: 12px; white-space: pre-wrap; word-break: break-word;
  background: var(--dv-code, #fafafa); border: 1px solid var(--dv-border, rgba(0,0,0,.1));
  border-radius: 6px; padding: 8px; max-height: 220px; overflow: auto;
}
.dsh-devloop-trust {
  border: 1px solid #c0392b55; background: #c0392b11; border-radius: 8px; padding: 10px; margin: 10px 0;
}
.dsh-devloop-notice { font-size: 12px; color: var(--dv-muted, #777); }
.dsh-devloop-watch {
  display: flex; align-items: center; gap: 8px; flex-wrap: wrap;
  border: 1px solid var(--dv-border, rgba(0,0,0,.12)); border-radius: 8px;
  padding: 8px 10px; margin: 10px 0;
}
.dsh-devloop-watch-meta { font-size: 12px; color: var(--dv-muted, #777); }
.dsh-devloop-preset { margin: 10px 0; }
.dsh-devloop-preset-body {
  display: flex; flex-direction: column; gap: 8px; margin-top: 8px;
  border: 1px solid var(--dv-border, rgba(0,0,0,.12)); border-radius: 8px; padding: 10px;
}
.dsh-devloop-preset-text {
  width: 100%; font-family: ui-monospace, SFMono-Regular, Consolas, monospace; font-size: 12px;
  border: 1px solid var(--dv-border, rgba(0,0,0,.2)); border-radius: 6px; padding: 8px;
}
.dsh-devloop-root-input {
  width: 100%; margin-top: 8px; padding: 6px 8px; border: 1px solid var(--dv-border, rgba(0,0,0,.3));
  border-radius: 6px; font: inherit;
}
`
}
