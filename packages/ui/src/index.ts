import { MhPanel } from './mh-panel.js';

const TOKENS = String.raw$tokens;

export { MhPanel };

/** 一行式挂载（设计令牌已内联） */
export function mountPanel(el = document.body) {
  MhPanel.define();
  const panel = document.createElement('mh-panel');
  el.appendChild(panel);
  return panel;
}