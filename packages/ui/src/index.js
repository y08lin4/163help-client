import { MhPanel } from './mh-panel.js';
import tokens from './tokens.css';

export { MhPanel };

/** 一行式挂载：new MhPanel(tokens) 注册 + <mh-panel>（带设计令牌） */
export function mountPanel(el: HTMLElement = document.body): MhPanel {
  MhPanel.define();
  const panel = document.createElement('mh-panel') as MhPanel;
  (panel as unknown as { tokens: string }).tokens = tokens;
  el.appendChild(panel);
  return panel;
}
