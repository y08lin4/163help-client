export declare class MhPanel extends HTMLElement {
  static define(tag?: string): void;
  setState(s: Record<string, unknown>): void;
  toggle(open?: boolean): void;
}
export declare function mountPanel(el?: HTMLElement): MhPanel;