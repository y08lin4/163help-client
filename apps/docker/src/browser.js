/**
 * Playwright 浏览器适配（docker 端）
 * - 无头 Chromium（静音、no-sandbox）
 * - 页面 = 网易云首页（注入 MUSIC_U cookie）
 * - 页内播放器 helper：__mhPlayer（fetch player/url → audio 播放 → 进度读取）
 */
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright-core';

const PAGE_HELPER = `
  window.__mhPlayer = {
    audio: null,
    async play(musicId) {
      const id = String(musicId).replace(/^song:/, '');
      const r = await fetch('/api/song/enhance/player/url?ids=' + encodeURIComponent(JSON.stringify([Number(id)])) + '&br=128000');
      const d = (await r.json()).data?.[0];
      if (!d || !d.url) return { ok: false };
      if (!this.audio) { this.audio = document.createElement('audio'); document.body.appendChild(this.audio); }
      this.audio.src = d.url;
      this.audio.playbackRate = 1;
      try { await this.audio.play(); } catch (e) { return { ok: false, err: String(e) }; }
      return { ok: true, durationMs: Math.round((Number(d.duration || 0) * 1000) || 0) };
    },
    progress() {
      const a = this.audio;
      if (!a) return { playedMs: 0, durationMs: 0 };
      return { playedMs: Math.round(a.currentTime * 1000), durationMs: Math.round((a.duration || 0) * 1000) };
    },
    setRate(r) { if (this.audio) this.audio.playbackRate = r; },
    stop() { if (this.audio) { this.audio.pause(); this.audio.src = ''; } },
  };
`;

export class DockBrowser {
  private browser: any = null;
  private page: any = null;

  constructor(
    private dataDir: string,
    private cookieHeader: string, // 用户网易云 Cookie（MUSIC_U 等）
  ) {}

  async launch() {
    const executable = process.env.PW_EXECUTABLE || undefined;
    this.browser = await chromium.launch({
      executablePath: executable || undefined,
      headless: true,
      args: ['--no-sandbox', '--disable-dev-shm-usage', '--mute-audio', '--autoplay-policy=no-user-gesture-required'],
    });
    this.page = await this.browser.newPage({ userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36' });
    await this.page.setExtraHTTPHeaders({});
    await this.page.goto('https://music.163.com/', { waitUntil: 'domcontentloaded', timeout: 60000 });
    // 注入网易云 cookie（同源）
    if (this.cookieHeader) {
      for (const pair of this.cookieHeader.split(';')) {
        const [k, ...v] = pair.trim().split('=');
        if (k && v.length) {
          await this.page.context().addCookies([{ name: k.trim(), value: v.join('=').trim(), domain: '.music.163.com', path: '/' }]);
        }
      }
      await this.page.reload({ waitUntil: 'domcontentloaded' });
    }
    await this.page.evaluate(PAGE_HELPER);
  }

  async play(musicId: string, _durationMs: number): Promise<boolean> {
    const r = await this.page.evaluate((id) => window.__mhPlayer.play(id), musicId);
    return Boolean(r?.ok);
  }

  async progress(): Promise<{ playedMs: number; durationMs: number }> {
    return await this.page.evaluate(() => window.__mhPlayer.progress());
  }

  async stop(): Promise<void> {
    await this.page.evaluate(() => window.__mhPlayer.stop()).catch(() => {});
  }

  async close(): Promise<void> {
    await this.browser?.close().catch(() => {});
  }
}
