/** Tampermonkey 环境声明（userscript 端） */
declare const GM_getValue: (key: string, def?: unknown) => unknown;
declare const GM_setValue: (key: string, value: unknown) => void;
declare const unsafeWindow: Window & Record<string, any>;

/* @163help/ui（纯 js 包）类型声明 */
declare module '@163help/ui' {
  export function mountPanel(el?: HTMLElement): any;
  export class MhPanel extends HTMLElement {
    setState(s: Record<string, unknown>): void;
    toggle(open?: boolean): void;
  }
}
