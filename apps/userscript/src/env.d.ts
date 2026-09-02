/** Tampermonkey 环境声明（userscript 端） */
declare const GM_getValue: (key: string, def?: unknown) => unknown;
declare const GM_setValue: (key: string, value: unknown) => void;
declare const unsafeWindow: Window & Record<string, any>;
