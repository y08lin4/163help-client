import type { CoreEventMap } from './types.js';

type Listener<T> = (payload: T) => void;

/** 极简事件总线：core → UI 单向流，避免互相引用 */
export class EventBus {
  private listeners = new Map<string, Set<Listener<unknown>>>();

  on<K extends keyof CoreEventMap>(event: K, fn: Listener<CoreEventMap[K]>): () => void {
    let set = this.listeners.get(event as string);
    if (!set) { set = new Set(); this.listeners.set(event as string, set); }
    set.add(fn as Listener<unknown>);
    return () => this.off(event, fn);
  }

  off<K extends keyof CoreEventMap>(event: K, fn: Listener<CoreEventMap[K]>): void {
    this.listeners.get(event as string)?.delete(fn as Listener<unknown>);
  }

  emit<K extends keyof CoreEventMap>(event: K, payload: CoreEventMap[K]): void {
    const set = this.listeners.get(event as string);
    if (!set) return;
    for (const fn of [...set]) {
      try { (fn as Listener<CoreEventMap[K]>)(payload); } catch { /* UI 监听器异常不拖垮 core */ }
    }
  }

  clear(): void { this.listeners.clear(); }
}
