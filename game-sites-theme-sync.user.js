// ==UserScript==
// @name         游戏网站深浅色主题跟随系统 (3DM & 游民)
// @namespace    https://github.com/clen3zz/
// @version      2.3
// @description  3DMGAME、游民星空等游戏网站深浅色主题自动跟随系统脚本。
// @author       clen3zz
// @match        https://www.3dmgame.com/*
// @match        https://www.gamersky.com/*
// @grant        none
// @run-at       document-idle
// @updateURL    https://raw.githubusercontent.com/clen3zz/game-sites-theme-sync/main/game-sites-theme-sync.user.js
// @downloadURL  https://raw.githubusercontent.com/clen3zz/game-sites-theme-sync/main/game-sites-theme-sync.user.js
// ==/UserScript==

(function () {
  'use strict';

  const mq = matchMedia('(prefers-color-scheme: dark)');
  let syncing = false;
  let ticking = false;

  // ---- 站点适配器 ----
  const adapters = [
    {
      test: () => location.hostname.includes('3dmgame.com'),
      readTheme() {
        // 读 body.nightbody 或 localStorage.theme
        const ls = safeLSGet('theme'); // 'dark' | 'light' | null
        if (document.body) {
          if (document.body.classList.contains('nightbody')) return true;
          if (ls === 'dark') return true;
          if (ls === 'light') return false;
        }
        return null;
      },
      apply(isDark) {
        // 仅在变化时写入
        const cur = this.readTheme();
        if (cur !== null && cur === isDark) return;

        safeLSSet('theme', isDark ? 'dark' : 'light');
        ensureHtmlColorScheme(isDark);

        if (document.body) {
          document.body.classList.toggle('nightbody', isDark);
        } else {
          onBodyReady(() => document.body.classList.toggle('nightbody', isDark));
        }
      },
      antiFlipSelectors: ['body']
    },
    {
      test: () => location.hostname.includes('gamersky.com'),
      readTheme() {
        // html.dark / body.hei|bai / localStorage.GS_D_N_Mode = 'd'|'n'
        const ls = safeLSGet('GS_D_N_Mode'); // 'd'|'n'
        const html = document.documentElement;
        if (html.classList.contains('dark')) return true;
        if (document.body) {
          if (document.body.classList.contains('hei')) return true;
          if (document.body.classList.contains('bai')) return false;
        }
        if (ls === 'd') return true;
        if (ls === 'n') return false;
        return null;
      },
      apply(isDark) {
        const cur = this.readTheme();
        if (cur !== null && cur === isDark) return;

        safeLSSet('GS_D_N_Mode', isDark ? 'd' : 'n');
        ensureHtmlColorScheme(isDark);

        const html = document.documentElement;
        html.classList.toggle('dark', isDark);

        const applyBody = () => {
          if (!document.body) return;
          if (isDark) {
            document.body.classList.remove('bai');
            document.body.classList.add('hei');
          } else {
            document.body.classList.remove('hei');
            document.body.classList.add('bai');
          }
        };
        if (document.body) applyBody(); else onBodyReady(applyBody);
      },
      antiFlipSelectors: ['html', 'body']
    }
  ];

  const adapter = adapters.find(a => a.test());
  if (!adapter) return;

  // —— 启动：document-start 就给 html 布置 color-scheme，降低首屏闪烁
  ensureHtmlColorScheme(mq.matches);

  // 首次同步（DOMContentLoaded 或更早，如果已可读就立即）
  ready(syncToSystem);

  // 系统变更：节流处理
  (mq.addEventListener ? mq.addEventListener('change', onSystemChange) : mq.addListener(onSystemChange));

  // 页面完全加载后再保守同步一次（站点脚本跑完之后）
  addEventListener('load', () => syncToSystem());

  // bfcache 恢复（前进后退）时再对齐一次
  addEventListener('pageshow', (e) => { if (e.persisted) syncToSystem(); });

  // ========= 核心 =========
  async function syncToSystem() {
    if (syncing) return;
    syncing = true;
    try {
      const wantDark = mq.matches;
      // 已一致 → 零动作
      const cur = adapter.readTheme();
      if (cur !== null && cur === wantDark) return;

      // 应用
      adapter.apply(wantDark);

      // 短时抗反改：站点脚本若 1s 内把 class 改回，立即再同步一次（最多 2 次）
      antiFlipGuard(adapter, wantDark, 2, 1000);
    } catch {}
    finally { syncing = false; }
  }

  function onSystemChange() {
    if (ticking) return;
    ticking = true;
    queueMicrotask(() => { syncToSystem(); ticking = false; });
  }

  // ========= 小工具 =========
  function ensureHtmlColorScheme(isDark) {
    try {
      const html = document.documentElement;
      // 只在变化时改，避免多余回流
      const cur = html.style.colorScheme || '';
      const want = isDark ? 'dark' : 'light';
      if (!cur.includes(want)) {
        html.style.colorScheme = want; // 原生表单、滚动条也会跟随
      }
    } catch {}
  }

  function antiFlipGuard(ad, wantDark, maxTimes = 2, windowMs = 1000) {
    if (!ad.antiFlipSelectors?.length) return;
    let times = 0;
    const endAt = Date.now() + windowMs;

    const obs = new MutationObserver(() => {
      if (Date.now() > endAt || times >= maxTimes) { obs.disconnect(); return; }
      const cur = ad.readTheme();
      if (cur !== null && cur !== wantDark) {
        times++;
        ad.apply(wantDark);
      }
    });

    const nodes = ad.antiFlipSelectors
      .map(sel => document.querySelector(sel))
      .filter(Boolean);

    nodes.forEach(n => obs.observe(n, { attributes: true, attributeFilter: ['class'] }));
    setTimeout(() => obs.disconnect(), windowMs + 50);
  }

  function safeLSGet(key) {
    try { return localStorage.getItem(key); } catch { return null; }
  }
  function safeLSSet(key, val) {
    try {
      const old = localStorage.getItem(key);
      if (old !== val) localStorage.setItem(key, val);
    } catch {}
  }

  function onBodyReady(fn) {
    if (document.body) { fn(); return; }
    const mo = new MutationObserver(() => {
      if (document.body) { mo.disconnect(); fn(); }
    });
    mo.observe(document.documentElement, { childList: true, subtree: true });
  }

  function ready(fn) {
    if (document.readyState === 'complete' || document.readyState === 'interactive') fn();
    else addEventListener('DOMContentLoaded', fn, { once: true });
  }
})();
