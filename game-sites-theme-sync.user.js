// ==UserScript==
// @name         游戏网站深浅色主题跟随系统 (3DM & 游民)
// @namespace    https://github.com/clen3zz/
// @version      2.4
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

    // ==========================================
    // 核心逻辑控制器
    // ==========================================
    const Controller = {
        adapter: null,
        observer: null,

        init() {
            // 1. 查找适配器
            this.adapter = adapters.find(a => a.test());
            if (!this.adapter) return;

            // 2. 立即执行数据层同步 (在页面渲染前)
            this.syncData(mq.matches);

            // 3. 监听 DOM 变化 (UI 层强制锁定)
            this.startObserver();

            // 4. 监听系统主题切换
            if (mq.addEventListener) {
                mq.addEventListener('change', e => this.handleSystemChange(e));
            } else {
                mq.addListener(e => this.handleSystemChange(e)); // 兼容旧版
            }

            // 5. 页面加载完成后再次检查 (防止页面脚本覆盖)
            window.addEventListener('load', () => this.syncUI(mq.matches));
        },

        handleSystemChange(e) {
            const isDark = e.matches;
            this.syncData(isDark);
            this.syncUI(isDark);
        },

        // 数据层同步：修改 LS 和 Cookie，让网站原生脚本读取到正确配置
        syncData(isDark) {
            this.adapter.applyData(isDark);
        },

        // UI 层同步：强制操作 DOM Class
        syncUI(isDark) {
            // 确保 HTML 标签声明了 color-scheme，避免原生组件（滚动条等）亮瞎眼
            const html = document.documentElement;
            const scheme = isDark ? 'dark' : 'light';
            if (html.style.colorScheme !== scheme) {
                html.style.colorScheme = scheme;
            }

            // 调用适配器处理 DOM
            this.adapter.applyDOM(isDark);
        },

        startObserver() {
            // 等待 body 出现
            const onBodyReady = () => {
                if (!document.body) {
                    requestAnimationFrame(onBodyReady);
                    return;
                }
                // 立即同步一次 UI
                this.syncUI(mq.matches);

                // 开启持久监听
                if (this.observer) this.observer.disconnect();
                this.observer = new MutationObserver((mutations) => {
                    // 过滤掉无关变动，只关心 class 变化
                    const relevantMutation = mutations.some(m =>
                        m.type === 'attributes' &&
                        (m.attributeName === 'class' || m.attributeName === 'className')
                    );
                    if (relevantMutation) {
                        // 如果检测到 Class 变动，检查是否符合当前系统主题，不符合则强制修正
                        // 使用 requestAnimationFrame 防止在极短时间内发生无限循环冲突
                        requestAnimationFrame(() => this.syncUI(mq.matches));
                    }
                });

                const targetNode = this.adapter.observeTarget ? this.adapter.observeTarget() : document.body;
                if (targetNode) {
                    this.observer.observe(targetNode, {
                        attributes: true,
                        attributeFilter: ['class', 'className']
                    });
                }
            };
            onBodyReady();
        }
    };

    // ==========================================
    // 站点适配器
    // ==========================================
    const adapters = [
        {
            // --- 3DMGAME 适配器 ---
            test: () => location.hostname.includes('3dmgame.com'),
            observeTarget: () => document.body,
            applyData(isDark) {
                const val = isDark ? 'dark' : 'light';
                // 1. 强制写入 LocalStorage
                try {
                    if (localStorage.getItem('theme') !== val) {
                        localStorage.setItem('theme', val);
                    }
                } catch (e) {}

                // 2. 强制写入 Cookie (3DM 部分老代码读 Cookie)
                const hostname = location.hostname.split('.').slice(-2).join('.');
                document.cookie = `theme=${val}; path=/; domain=.${hostname}; max-age=31536000`;
            },
            applyDOM(isDark) {
                if (!document.body) return;
                const hasClass = document.body.classList.contains('nightbody');
                if (isDark && !hasClass) {
                    document.body.classList.add('nightbody');
                } else if (!isDark && hasClass) {
                    document.body.classList.remove('nightbody');
                }
            }
        },
        {
            // --- 游民星空 适配器 ---
            test: () => location.hostname.includes('gamersky.com'),
            observeTarget: () => document.body,
            applyData(isDark) {
                const val = isDark ? 'd' : 'n';
                try {
                    if (localStorage.getItem('GS_D_N_Mode') !== val) {
                        localStorage.setItem('GS_D_N_Mode', val);
                    }
                } catch (e) {}
            },
            applyDOM(isDark) {
                const html = document.documentElement;
                
                // 处理 HTML 标签
                if (isDark && !html.classList.contains('dark')) html.classList.add('dark');
                if (!isDark && html.classList.contains('dark')) html.classList.remove('dark');

                // 处理 Body 标签
                if (document.body) {
                    const body = document.body;
                    if (isDark) {
                        if (body.classList.contains('bai')) body.classList.remove('bai');
                        if (!body.classList.contains('hei')) body.classList.add('hei');
                    } else {
                        if (body.classList.contains('hei')) body.classList.remove('hei');
                        if (!body.classList.contains('bai')) body.classList.add('bai');
                    }
                }
            }
        }
    ];

    // ==========================================
    // 启动
    // ==========================================
    Controller.init();

})();
