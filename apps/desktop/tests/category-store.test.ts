// category-store 测试 / category-store tests
// 验证自动 seed 兜底逻辑和并发安全

import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { Category } from '@shared/types/index.js';

// mock dataAccess 模块（路径相对于测试文件）
// mock dataAccess module (path relative to test file)
vi.mock('../src/renderer/src/data/data-access.js', () => ({
  dataAccess: {
    getCategories: vi.fn(),
    seedCategories: vi.fn(),
  },
}));

import { dataAccess } from '../src/renderer/src/data/data-access.js';
import { useCategoryStore } from '../src/renderer/src/stores/category-store.js';

// 构造基础分类 mock / Build base category mock
function makeCat(overrides: Partial<Category>): Category {
  return {
    id: 'cat-1',
    user_id: 'user-1',
    parent_id: null,
    name: '餐饮',
    type: 'expense',
    icon: null,
    color: null,
    linked_fire_concept: null,
    display_order: 0,
    is_system: 1,
    sync_version: 0,
    updated_at: 0,
    deleted_flag: 0,
    ...overrides,
  };
}

const cat1 = makeCat({ id: 'cat-1', name: '餐饮' });
const cat2 = makeCat({ id: 'cat-2', name: '交通' });

describe('useCategoryStore', () => {
  beforeEach(() => {
    // 重置 store 状态 / Reset store state
    useCategoryStore.setState({ categories: [], loading: false, error: null });
    vi.clearAllMocks();
  });

  it('非空 categories 不触发 seed', async () => {
    vi.mocked(dataAccess.getCategories).mockResolvedValue([cat1]);
    vi.mocked(dataAccess.seedCategories).mockResolvedValue(undefined);

    await useCategoryStore.getState().fetchCategories('user-1');

    expect(dataAccess.getCategories).toHaveBeenCalledTimes(1);
    expect(dataAccess.seedCategories).not.toHaveBeenCalled();
    expect(useCategoryStore.getState().categories).toEqual([cat1]);
    expect(useCategoryStore.getState().loading).toBe(false);
  });

  it('空 categories 触发 seed 后重新 fetch', async () => {
    vi.mocked(dataAccess.getCategories)
      .mockResolvedValueOnce([])           // 第一次返回空
      .mockResolvedValueOnce([cat1, cat2]); // seed 后重新 fetch 返回 2 条
    vi.mocked(dataAccess.seedCategories).mockResolvedValue(undefined);

    await useCategoryStore.getState().fetchCategories('user-1');

    expect(dataAccess.getCategories).toHaveBeenCalledTimes(2);
    expect(dataAccess.seedCategories).toHaveBeenCalledTimes(1);
    expect(dataAccess.seedCategories).toHaveBeenCalledWith('user-1');
    expect(useCategoryStore.getState().categories).toHaveLength(2);
    expect(useCategoryStore.getState().loading).toBe(false);
  });

  it('并发安全：同时两次 fetchCategories，seed 只调用 1 次', async () => {
    vi.mocked(dataAccess.getCategories)
      .mockResolvedValueOnce([])                // call 1 初始
      .mockResolvedValueOnce([])                // call 2 初始
      .mockResolvedValueOnce([cat1, cat2])      // call 1 re-fetch
      .mockResolvedValueOnce([cat1, cat2]);     // call 2 re-fetch
    vi.mocked(dataAccess.seedCategories).mockResolvedValue(undefined);

    const p1 = useCategoryStore.getState().fetchCategories('user-1');
    const p2 = useCategoryStore.getState().fetchCategories('user-1');
    await Promise.all([p1, p2]);

    expect(dataAccess.seedCategories).toHaveBeenCalledTimes(1);
    expect(useCategoryStore.getState().categories).toHaveLength(2);
  });

  it('seed 失败时 error 被设置', async () => {
    vi.mocked(dataAccess.getCategories).mockResolvedValueOnce([]);
    vi.mocked(dataAccess.seedCategories).mockRejectedValue(new Error('seed failed'));

    await useCategoryStore.getState().fetchCategories('user-1');

    expect(useCategoryStore.getState().error).toBe('seed failed');
    expect(useCategoryStore.getState().loading).toBe(false);
  });

  it('clear 重置状态', async () => {
    vi.mocked(dataAccess.getCategories).mockResolvedValue([cat1]);
    await useCategoryStore.getState().fetchCategories('user-1');
    expect(useCategoryStore.getState().categories).toHaveLength(1);

    useCategoryStore.getState().clear();
    expect(useCategoryStore.getState().categories).toEqual([]);
    expect(useCategoryStore.getState().error).toBeNull();
    expect(useCategoryStore.getState().loading).toBe(false);
  });
});
