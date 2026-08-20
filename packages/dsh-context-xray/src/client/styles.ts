/** Minimal component styles, injected once through a data-plugin style tag. */
const css = `
[dsh-context-xray-root] {
  position: relative;
  font-size: 12px;
  line-height: 1.5;
}
[dsh-context-xray-root] .xray-trigger {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  border: 1px solid var(--dsw-alias-border-l3, rgba(128,128,128,.4));
  background: transparent;
  border-radius: 8px;
  padding: 2px 8px;
  cursor: pointer;
  color: var(--dsw-alias-label-secondary, inherit);
}
[dsh-context-xray-root] .xray-panel {
  position: absolute;
  right: 0;
  top: calc(100% + 6px);
  z-index: 1000;
  width: min(720px, calc(100vw - 32px));
  max-height: 70vh;
  overflow: auto;
  background: var(--dsw-specific-menu, #fff);
  color: var(--dsw-alias-label-primary, inherit);
  border: 1px solid var(--dsw-alias-border-inverted, rgba(0,0,0,.2));
  border-radius: 12px;
  box-shadow: var(--dsw-shadow-lv3, 0 8px 30px rgba(0,0,0,.2));
  padding: 12px;
}
.xray-panel h3 {
  margin: 0 0 8px;
  font-size: 13px;
}
.xray-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 16px;
  margin-bottom: 8px;
  color: var(--dsw-alias-label-secondary, inherit);
}
.xray-category-row {
  display: flex;
  justify-content: space-between;
  gap: 8px;
  padding: 2px 0;
}
.xray-bar {
  height: 4px;
  border-radius: 999px;
  background: var(--dsw-alias-interactive-bg-hover, #eee);
  overflow: hidden;
  margin: 2px 0 4px;
}
.xray-bar > span {
  display: block;
  height: 100%;
  background: #4D6BFE;
}
.xray-table {
  width: 100%;
  border-collapse: collapse;
  font-variant-numeric: tabular-nums;
}
.xray-table th, .xray-table td {
  text-align: left;
  padding: 2px 6px;
  border-bottom: 1px solid var(--dsw-alias-border-l3, rgba(128,128,128,.2));
}
.xray-toolbar {
  display: flex;
  gap: 8px;
  margin-bottom: 8px;
}
.xray-toolbar button {
  border: 1px solid var(--dsw-alias-border-l3, rgba(128,128,128,.4));
  background: transparent;
  border-radius: 6px;
  padding: 2px 8px;
  cursor: pointer;
}
.xray-history {
  display: flex;
  align-items: flex-end;
  gap: 4px;
  height: 60px;
  padding: 4px 0;
}
.xray-history .bar {
  flex: 1;
  min-width: 6px;
  border-radius: 2px 2px 0 0;
  background: #4D6BFE;
}
.xray-note {
  color: var(--dsw-alias-label-tertiary, #999);
  font-size: 11px;
  margin-top: 8px;
}
.xray-section-row {
  padding: 2px 0;
}
.xray-section-row summary {
  cursor: pointer;
}
.xray-pressure-badge {
  display: inline-block;
  border-radius: 999px;
  padding: 1px 10px;
  font-size: 11px;
  font-weight: 600;
  border: 1px solid transparent;
}
.xray-pressure-normal {
  color: var(--dsw-alias-label-secondary, #555);
  background: var(--dsw-alias-interactive-bg-hover, #eee);
}
.xray-pressure-elevated {
  color: #8a6d1a;
  background: rgba(230, 180, 40, .18);
  border-color: rgba(230, 180, 40, .5);
}
.xray-pressure-high {
  color: #8a4b00;
  background: rgba(240, 120, 20, .18);
  border-color: rgba(240, 120, 20, .5);
}
.xray-pressure-critical {
  color: #a00;
  background: rgba(220, 40, 40, .16);
  border-color: rgba(220, 40, 40, .6);
}
.xray-history .bar {
  flex: 1;
  border: 0;
  padding: 0;
  background: #4D6BFE;
  cursor: pointer;
  min-width: 6px;
}
.xray-history .bar.selected {
  outline: 2px solid var(--dsw-alias-border-inverted, rgba(0,0,0,.5));
}
.xray-history-list {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin: 6px 0;
}
.xray-history-item {
  display: inline-flex;
  gap: 6px;
  align-items: center;
  border: 1px solid var(--dsw-alias-border-l3, rgba(128,128,128,.4));
  background: transparent;
  border-radius: 6px;
  padding: 2px 8px;
  cursor: pointer;
  font-variant-numeric: tabular-nums;
}
.xray-history-item.selected {
  background: var(--dsw-alias-interactive-bg-hover, #eee);
}
.xray-history-delta {
  color: var(--dsw-alias-label-tertiary, #888);
}
.xray-diff {
  border: 1px solid var(--dsw-alias-border-l3, rgba(128,128,128,.4));
  border-radius: 8px;
  padding: 6px 8px;
  margin-top: 6px;
}
.xray-diff h4 {
  margin: 0 0 4px;
}
.xray-delta-row {
  padding: 2px 0;
}
.xray-delta-main {
  display: flex;
  justify-content: space-between;
  gap: 8px;
}
.xray-delta-note {
  color: var(--dsw-alias-label-tertiary, #888);
  font-size: 11px;
}
.xray-tool-name {
  border: 0;
  background: transparent;
  cursor: pointer;
  padding: 0;
  color: var(--dsw-alias-label-primary, inherit);
  font: inherit;
}
.xray-tool-actions {
  display: inline-flex;
  gap: 4px;
  margin-left: 8px;
}
.xray-tool-actions button,
.xray-toolbar button {
  border: 1px solid var(--dsw-alias-border-l3, rgba(128,128,128,.4));
  background: transparent;
  border-radius: 6px;
  padding: 2px 8px;
  cursor: pointer;
}
.xray-schema-row pre {
  max-height: 240px;
  overflow: auto;
  background: var(--dsw-alias-interactive-bg-hover, #f6f6f6);
  border-radius: 6px;
  padding: 6px;
  margin: 2px 0;
}
`

let adopted = false

export function adoptStyles(): void {
  if (adopted || typeof document === 'undefined') return
  adopted = true
  const tag = document.createElement('style')
  tag.setAttribute('data-plugin', 'dsh-context-xray')
  tag.id = 'dsh-context-xray-style'
  tag.textContent = css
  document.head.append(tag)
}