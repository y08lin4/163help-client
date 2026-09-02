/**
 * API 签名（与 server HMAC 方案对齐）。
 * 关键：nonce 每次请求全新生成（修复「重试复用 nonce → 403 疑似重放」）。
 * 浏览器环境：hmacFn 由各端注入（crypto.subtle 实现 / node crypto 实现），core 不直接依赖运行时 API。
 */

export type HmacFn = (secret: string, data: string) => Promise<string>;
export type NonceFn = () => string;

export interface SignHeaders {
  a: string; // nonce
  t: string; // unix 秒
  s: string; // hmac
}

/** 无法签名（无 token）时返回 null，调用方降级不签名 */
export async function buildSignHeaders(
  method: string,
  fullUrl: string,
  rawBody: string,
  token: string,
  hmacFn: HmacFn,
  nonceFn: NonceFn,
): Promise<SignHeaders | null> {
  if (!token) return null;
  const ts = Math.floor(Date.now() / 1000).toString();
  const nonce = nonceFn(); // 每次全新，绝不复用
  const bodyHash = rawBody ? await hmacFn(token, rawBody) : '';
  const norm = `${method}\n${fullUrl}\n${ts}\n${nonce}\n${bodyHash}`;
  // 签名密钥 = 会话 access token；客户端密钥（mh_ck_）用 token 的 SHA-256 派生
  const secret = token.startsWith('mh_ck_') ? await hmacFn(token, '') : token;
  return { a: nonce, t: ts, s: await hmacFn(secret, norm) };
}

export const hexBytes = (bytes: Uint8Array): string =>
  Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('');

/** crypto.subtle 实现的 HMAC-SHA256（浏览器/Node18+ 通用） */
export async function subtleHmac(secret: string, data: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(data));
  return hexBytes(new Uint8Array(sig));
}

/** 浏览器 nonce：crypto.getRandomValues（16 字节 hex） */
export function browserNonce(): string {
  const b = new Uint8Array(16);
  crypto.getRandomValues(b);
  return hexBytes(b);
}
