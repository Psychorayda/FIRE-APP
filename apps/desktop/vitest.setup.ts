// 全局测试 setup：jest-dom matchers + window.dataAccess mock
// Global test setup: jest-dom matchers + window.dataAccess mock

import '@testing-library/jest-dom';
import { vi, afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

// 显式注册 cleanup：每个测试结束后清理 document.body
// 自动 cleanup 在当前 vitest 配置下未生效，跨测试/跨文件会累积渲染组件导致 getByText 命中多个元素
// Explicit cleanup: clear document.body after each test.
// Auto-cleanup is not active under the current vitest config, so rendered components
// accumulate across tests/files and break getByText queries with multiple matches.
afterEach(() => {
  cleanup();
});

// window.dataAccess 全局 mock 工厂
// window.dataAccess global mock factory
// 覆盖所有 namespace，每个方法用 vi.fn()，返回 undefined 作为默认值
// Covers all namespaces, each method is vi.fn() returning undefined by default

const fn = () => vi.fn();

window.dataAccess = {
  initDatabase: fn(),
  closeDatabase: fn(),
  user: {
    create: fn(),
    get: fn(),
    update: fn(),
    getFirst: fn(),
  },
  account: {
    create: fn(),
    get: fn(),
    list: fn(),
    update: fn(),
    updateBalance: fn(),
    investableBalance: fn(),
    netWorth: fn(),
    hasTransactions: fn(),
    softDelete: fn(),
  },
  category: {
    create: fn(),
    get: fn(),
    list: fn(),
    seed: fn(),
  },
  tx: {
    get: fn(),
    getById: fn(),
    listByUser: fn(),
    create: fn(),
    edit: fn(),
    delete: fn(),
  },
  recurring: {
    create: fn(),
    listActive: fn(),
    update: fn(),
    process: fn(),
  },
  scenario: {
    create: fn(),
    get: fn(),
    list: fn(),
    update: fn(),
  },
  snapshot: {
    list: fn(),
    getByMonth: fn(),
    generateMonthly: fn(),
  },
  fireCalc: {
    runProjection: fn(),
  },
} as any;
