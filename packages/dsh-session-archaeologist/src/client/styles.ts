/** Injected styles for the search panel. Scoped under .archaeologist-root. */
export function adoptStyles(): void {
  if (typeof document === 'undefined') return
  if (document.getElementById('archaeologist-styles')) return
  const style = document.createElement('style')
  style.id = 'archaeologist-styles'
  style.textContent = `
.archaeologist-root button,
.archaeologist-root input {
  font: inherit;
}
.archaeologist-root {
  position: relative;
  min-width: 320px;
  max-width: 720px;
  background: var(--dsh-bg, #15171c);
  color: var(--dsh-fg, #e5e7eb);
  border: 1px solid var(--dsh-border, #333);
  border-radius: 8px;
  padding: 10px;
  z-index: 9999;
  box-shadow: 0 8px 30px rgba(0,0,0,.4);
}
.archaeologist-root .archaeologist-toolbar {
  display: flex;
  gap: 6px;
  align-items: center;
  margin-bottom: 8px;
}
.archaeologist-root .archaeologist-toolbar h3 {
  margin: 0;
  font-size: 14px;
  flex: 1;
}
.archaeologist-root button {
  cursor: pointer;
  border: 1px solid var(--dsh-border, #444);
  background: var(--dsh-button-bg, #23262d);
  color: inherit;
  border-radius: 4px;
  padding: 3px 8px;
  font-size: 12px;
}
.archaeologist-root button:hover {
  background: var(--dsh-button-hover-bg, #2c313a);
}
.archaeologist-root .archaeologist-search-row {
  display: flex;
  gap: 6px;
}
.archaeologist-root input[type="text"] {
  flex: 1;
  background: var(--dsh-input-bg, #20242b);
  border: 1px solid var(--dsh-border, #444);
  color: inherit;
  border-radius: 4px;
  padding: 5px 8px;
}
.archaeologist-root select,
.archaeologist-root input[type="date"] {
  background: var(--dsh-input-bg, #20242b);
  border: 1px solid var(--dsh-border, #444);
  color: inherit;
  border-radius: 4px;
  padding: 3px 6px;
  font-size: 12px;
}
.archaeologist-root .archaeologist-filters {
  display: flex;
  gap: 8px;
  align-items: center;
  flex-wrap: wrap;
  margin: 6px 0;
  font-size: 12px;
}
.archaeologist-root .archaeologist-filters label {
  display: inline-flex;
  align-items: center;
  gap: 3px;
}
.archaeologist-root .archaeologist-selectionbar {
  display: flex;
  gap: 8px;
  align-items: center;
  margin: 6px 0;
  padding: 4px 6px;
  border: 1px solid var(--dsh-border, #333);
  border-radius: 4px;
}
.archaeologist-root .archaeologist-context {
  font-size: 11px;
  color: var(--dsh-muted, #9aa0a6);
  word-break: break-word;
  white-space: normal;
}
.archaeologist-root .archaeologist-quick {
  display: flex;
  gap: 4px;
  margin: 6px 0;
  flex-wrap: wrap;
}
.archaeologist-root .archaeologist-note {
  font-size: 12px;
  color: var(--dsh-muted, #9aa0a6);
}
.archaeologist-root .archaeologist-error {
  color: #ff6b6b;
  font-size: 12px;
}
.archaeologist-root .archaeologist-results {
  max-height: 60vh;
  overflow: auto;
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: 8px;
}
.archaeologist-root .archaeologist-result {
  border: 1px solid var(--dsh-border, #333);
  border-radius: 6px;
  padding: 6px;
}
.archaeologist-root .archaeologist-result-head {
  display: flex;
  gap: 6px;
  align-items: baseline;
  flex-wrap: wrap;
}
.archaeologist-root .archaeologist-title {
  font-weight: 600;
  font-size: 13px;
}
.archaeologist-root .archaeologist-meta {
  font-size: 11px;
  color: var(--dsh-muted, #9aa0a6);
}
.archaeologist-root .archaeologist-snippet {
  font-size: 12px;
  margin: 4px 0;
  white-space: pre-wrap;
  word-break: break-word;
}
.archaeologist-root .archaeologist-badges {
  display: flex;
  gap: 4px;
  flex-wrap: wrap;
  font-size: 11px;
}
.archaeologist-root .archaeologist-badge {
  background: var(--dsh-badge-bg, #262b33);
  border-radius: 4px;
  padding: 1px 5px;
  max-width: 220px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.archaeologist-root .archaeologist-timeline {
  border-top: 1px dashed var(--dsh-border, #333);
  margin-top: 8px;
  padding-top: 6px;
  font-size: 12px;
}
.archaeologist-root .archaeologist-timeline pre {
  white-space: pre-wrap;
  font-size: 11px;
  background: var(--dsh-input-bg, #20242b);
  padding: 6px;
  border-radius: 4px;
}
.archaeologist-root .archaeologist-copy {
  margin-left: auto;
}
`
  document.head.appendChild(style)
}