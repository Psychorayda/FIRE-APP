// Onboarding 5 步完整流程 E2E / Onboarding 5-step full flow E2E

import { test, expect } from '@playwright/test';
import { ensureExePath, cleanUserData, launchApp, completeOnboarding } from './helpers';
import type { ElectronApplication, Page } from '@playwright/test';

let exePath: string;
let electronApp: ElectronApplication;
let page: Page;

test.beforeAll(async () => {
  exePath = await ensureExePath();
});

test.beforeEach(async () => {
  // 每个测试前清理 userData，确保从干净状态开始
  cleanUserData();
  ({ electronApp, page } = await launchApp(exePath));
});

test.afterEach(async () => {
  if (electronApp) {
    try { await electronApp.close(); } catch {}
  }
});

test.describe('Onboarding 完整流程', () => {
  test('完成 5 步 Onboarding 并进入主页', async () => {
    // 完成全部 5 步
    await completeOnboarding(page, '张三');

    // 断言：已进入主页（URL 为 #/）
    await expect(page).toHaveURL(/#\/$/);

    // 断言：主页侧边栏可见（仪表盘等导航项）
    await expect(page.getByText('仪表盘', { exact: true })).toBeVisible();
    await expect(page.getByText('账户管理', { exact: true })).toBeVisible();
    await expect(page.getByText('交易记录', { exact: true })).toBeVisible();

    // 断言：不再显示 Onboarding 元素
    await expect(page.getByText('开始使用', { exact: true })).not.toBeVisible();
    await expect(page.getByText('完成创建', { exact: true })).not.toBeVisible();
  });

  test('Step 2 显示名称校验：空值不允许进入下一步', async () => {
    await page.waitForURL(/#\/onboarding/, { timeout: 30_000 });

    // Step 1 → Step 2
    await page.getByText('开始使用', { exact: true }).click();

    // 不输入名称直接点"下一步"
    await page.getByText('下一步', { exact: true }).click();

    // 断言：显示错误提示，仍停留在 Step 2
    await expect(page.getByText('请输入显示名称', { exact: true })).toBeVisible();
    // 仍在 Step 2（标题可见）
    await expect(page.getByText('输入显示名称', { exact: true })).toBeVisible();
  });

  test('Step 2 显示名称校验：超过 20 字符不允许进入下一步', async () => {
    await page.waitForURL(/#\/onboarding/, { timeout: 30_000 });

    await page.getByText('开始使用', { exact: true }).click();

    // 输入 21 个字符
    await page.getByPlaceholder('例如：张三').fill('这是一个超过二十个字符的显示名称测试用例');
    await page.getByText('下一步', { exact: true }).click();

    await expect(page.getByText('显示名称不能超过 20 字符', { exact: true })).toBeVisible();
  });

  test('Step 3 可切换市场并影响利率默认值', async () => {
    await page.waitForURL(/#\/onboarding/, { timeout: 30_000 });

    // Step 1 → 2 → 3
    await page.getByText('开始使用', { exact: true }).click();
    await page.getByPlaceholder('例如：张三').fill('市场测试');
    await page.getByText('下一步', { exact: true }).click();

    // 默认选中中国市场，切换到全球市场
    await page.getByText('全球市场', { exact: true }).click();

    // 进入 Step 4
    await page.getByText('下一步', { exact: true }).click();

    // 断言：Step 4 标题可见，全球市场默认提现率应为 400 bps
    await expect(page.getByText('确认默认利率偏好', { exact: true })).toBeVisible();
    // Step 5 确认页会显示"4%"（400 bps = 4.00%）
    await page.getByText('下一步', { exact: true }).click();
    await expect(page.getByText('4%', { exact: true })).toBeVisible();
  });

  test('Step 4 利率校验：提现率超出范围提示错误', async () => {
    await page.waitForURL(/#\/onboarding/, { timeout: 30_000 });

    await page.getByText('开始使用', { exact: true }).click();
    await page.getByPlaceholder('例如：张三').fill('利率测试');
    await page.getByText('下一步', { exact: true }).click();
    await page.getByText('下一步', { exact: true }).click();

    // Step 4: 修改提现率为非法值（100 < 200）
    // Input 组件用 label 关联，用 getByLabel 定位
    const withdrawalInput = page.getByLabel('默认提现率');
    await withdrawalInput.fill('100');
    await page.getByText('下一步', { exact: true }).click();

    await expect(page.getByText('提现率范围为 200-600 基点', { exact: true })).toBeVisible();
  });
});
