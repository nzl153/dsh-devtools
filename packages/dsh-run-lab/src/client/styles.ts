/** dsh-run-lab 面板样式（注入全局 DOM，前缀 rl- 防冲突）。 */
let injected = false

export function adoptStyles(): void {
  if (injected) return
  injected = true
  const style = document.createElement('style')
  style.textContent = `
.rl-footer-action{background:transparent;border:1px solid rgba(128,128,160,.35);border-radius:8px;
  color:inherit;padding:4px 10px;cursor:pointer;font-size:13px;white-space:nowrap}
.rl-footer-action:hover{border-color:#7aa2f7;color:#7aa2f7}
.rl-overlay{position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:1200;
  display:flex;align-items:flex-start;justify-content:flex-end;padding:12px}
.rl-panel{background:#1b1e2b;color:#e6e6ee;border:1px solid #33385a;border-radius:12px;
  width:min(680px,92vw);max-height:88vh;overflow:auto;padding:16px;box-shadow:0 12px 40px rgba(0,0,0,.5)}
.rl-panel h3{margin:0 0 4px;font-size:16px}
.rl-panel .rl-sub{color:#9aa0b5;font-size:12px;margin-bottom:12px}
.rl-panel input,.rl-panel textarea{width:100%;box-sizing:border-box;background:#12141f;color:#e6e6ee;
  border:1px solid #33385a;border-radius:6px;padding:6px 8px;margin:4px 0 10px;font:inherit}
.rl-panel textarea{min-height:60px;resize:vertical}
.rl-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}
.rl-field label{font-size:11px;color:#9aa0b5;display:block;margin-bottom:2px}
.rl-btn{background:#2a3c8f;color:#fff;border:none;border-radius:6px;padding:7px 12px;cursor:pointer;font-size:13px}
.rl-btn:hover{background:#3550b0}
.rl-btn.secondary{background:#33385a}
.rl-btn.danger{background:#7a2a2a}
.rl-row{display:flex;gap:8px;align-items:center}
.rl-card{background:#12141f;border:1px solid #2a2f4a;border-radius:8px;padding:10px;margin-bottom:8px}
.rl-card .rl-status{font-size:11px;color:#9aa0b5}
.rl-metrics{display:grid;grid-template-columns:repeat(2,auto);gap:2px 16px;font-size:12px;margin-top:6px}
.rl-metrics b{color:#9fd1ff}
.rl-err{color:#ff8080;font-size:12px;white-space:pre-wrap}
.rl-note{color:#c9a86a;font-size:11px}
`
  document.head.appendChild(style)
}

export function adoptStylesInTests(): void {
  injected = false
}
