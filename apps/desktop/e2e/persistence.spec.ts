// 重启持久化验证 E2E / Restart persistence verification E2E
// T0 BUG 核心验证：Onboarding 完成后重启，账户数据应保留

import { test, expect } from '@playwright/test';
import { ensureExePath, cleanUserData, launchApp, completeOnboarding } from './helpers';
import type { ElectronApplication, Page } from '@playwright/test';

const TEST_USER_NAME = '持久化测试用户';

let exePath: string;

test.beforeAll(async () => {
  exePath = await ensureExePath();
});

test.describe('重启持久化验证（T0 核心）', () => {
  test('正常关闭后重启，账户仍在', async () => {
    // 1. 清理 + 启动 + 完成 Onboarding
    cleanUserData();
    let { electronApp, page } = await launchApp(exePath);
    await completeOnboarding(page, TEST_USER_NAME);

    // 断言已进入主页
    await expect(page).toHaveURL(/#\/$/);
    await expect(page.getByText('仪表盘', { exact: true })).toBeVisible();

    // 2. 正常关闭（触发 before-quit → closeAppDatabase → WAL checkpoint）
    await electronApp.close();

    // 3. 重新启动同一 exe（userData 未清理，数据应保留）
    ({ electronApp, page } = await launchApp(exePath));

    // 4. 断言：不再显示 Onboarding，直接进主页
    await page.waitForURL(/#\/$/, { timeout: 30_000 });
    await expect(page.getByText('仪表盘', { exact: true })).toBeVisible();
    await expect(page.getByText('开始使用', { exact: true })).not.toBeVisible();

    // 5. 断言：账户数据仍在（侧边栏导航可见说明已初始化）
    await expect(page.getByText('账户管理', { exact: true })).toBeVisible();

    await electronApp.close();
  });

  test('强杀进程后重启，账户仍在（验证 WAL replay）', async () => {
    // 1. 清理 + 启动 + 完成 Onboarding
    cleanUserData();
    let { electronApp, page } = await launchApp(exePath);
    await completeOnboarding(page, TEST_USER_NAME);

    await expect(page).toHaveURL(/#\/$/);

    // 2. 强杀进程（模拟任务管理器结束，不触发 before-quit）
    //    WAL 未 checkpoint，下次启动 SQLite 自动 replay 恢复
    const pid = electronApp.process()?.pid;
    expect(pid).toBeTruthy();
    process.kill(pid!);
    // 等待进程退出
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // 3. 重新启动
    ({ electronApp, page } = await launchApp(exePath));

    // 4. 断言：直接进主页，账户仍在
    await page.waitForURL(/#\/$/, { timeout: 30_000 });
    await expect(page.getByText('仪表盘', { exact: true })).toBeVisible();
    await expect(page.getByText('开始使用', { exact: true })).not.toBeVisible();

    await electronApp.close();
  });

  test('多次重启数据不丢（回归验证）', async () => {
    cleanUserData();
    let { electronApp, page } = await launchApp(exePath);
    await completeOnboarding(page, TEST_USER_NAME);
    await expect(page).toHaveURL(/#\/$/);
    await electronApp.close();

    // 循环 3 次：重启 → 断言账户仍在 → 关闭
    for (let i = 1; i <= 3; i++) {
      ({ electronApp, page } = await launchApp(exePath));
      await page.waitForURL(/#\/$/, { timeout: 30_000 });
      await expect(page.getByText('仪表盘', { exact: true })).toBeVisible();
      await expect(page.getByText('开始使用', { exact: true })).not.toBeVisible();
      await electronApp.close();
    }
  });

  test('重启后 DB 文件存在（持久化到磁盘）', async () => {
    const { existsSync, statSync } = await import('node:fs');
    const { join } = await import('node:path');
    const { getUserDataDir } = await import('./helpers');

    cleanUserData();
    let { electronApp, page } = await launchApp(exePath);
    await completeOnboarding(page, TEST_USER_NAME);
    await electronApp.close();

    // 断言：DB 文件存在且大小 > 0
    const dbPath = join(getUserDataDir(), 'data', 'fire.db');
    expect(existsSync(dbPath)).toBe(true);
    const stat = statSync(dbPath);
    expect(stat.size).toBeGreaterThan(0);
    console.log(`[E2E] DB 文件大小: ${stat.size} bytes`);

    // 重启后 DB 文件仍存在
    ({ electronApp, page } = await launchApp(exePath));
    await page.waitForURL(/#\/$/, { timeout: 30_000 });
    expect(existsSync(dbPath)).toBe(true);
    await electronApp.close();
  });
});
