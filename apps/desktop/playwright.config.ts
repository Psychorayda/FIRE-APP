// Playwright Electron E2E 配置 / Playwright Electron E2E config
// 启动打包 exe 验证 Onboarding 与重启持久化

import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  timeout: 90_000,            // 单测 90s（含 exe 启动，Windows exe 首次启动较慢）
  expect: { timeout: 15_000 }, // Electron 渲染进程交互断言
  fullyParallel: false,       // 串行：共享 userData，不能并行
  retries: 0,                 // E2E 不重试，避免假绿
  reporter: [['html'], ['list']],
  use: {
    trace: 'retain-on-failure', // 失败时保留 trace 供调试
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
});
