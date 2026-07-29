// SettingsPage 组件 + 集成测试 / SettingsPage component + integration tests

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import type { User, Category } from '@shared/types/index.js';
import { SettingsPage } from '@renderer/pages/SettingsPage.js';
import { useAppStore } from '@renderer/stores/app-store.js';
import { useToastStore } from '@renderer/stores/toast-store.js';

// 测试数据工厂 / Test data factories
function makeUser(overrides: Partial<User>): User {
  return {
    id: 'user-1',
    display_name: '张三',
    base_currency: 'CNY',
    is_china_market: 1,
    default_withdrawal_rate: 350,
    default_expected_return: 700,
    default_inflation_rate: 300,
    encryption_key_hash: null,
    last_sync_at: null,
    sync_version: 0,
    updated_at: 0,
    deleted_flag: 0,
    ...overrides,
  };
}

function makeCategory(overrides: Partial<Category>): Category {
  return {
    id: 'cat-1',
    user_id: 'user-1',
    parent_id: null,
    name: '住房',
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

// 18 个系统分类 mock / 18 system categories mock
function makeSystemCategories(): Category[] {
  const expenseNames = ['住房', '食品', '交通', '保险', '医疗', '娱乐', '购物', '个人护理', '教育', '债务还款', '其他支出'];
  const incomeNames = ['工资薪金', '自由职业', '投资收益', '租金收入', '退税', '社保养老金', '其他收入'];
  return [
    ...expenseNames.map((name, i) => makeCategory({ id: `e${i}`, name, type: 'expense', display_order: i })),
    ...incomeNames.map((name, i) => makeCategory({ id: `i${i}`, name, type: 'income', display_order: i })),
  ];
}

describe('SettingsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useToastStore.setState({ toasts: [] });
    useAppStore.setState({ currentUser: null });
    // 默认 mock：组件经 IpcDataAccess 委托到 window.dataAccess.* 命名空间
    // updateUser -> window.dataAccess.user.update
    // getCategories -> window.dataAccess.category.list
    // resetSystemCategories -> window.dataAccess.category.resetSystem
    (window.dataAccess.category.list as any).mockResolvedValue(makeSystemCategories());
    (window.dataAccess.user.update as any).mockResolvedValue(undefined);
    (window.dataAccess.category.resetSystem as any).mockResolvedValue(undefined);
  });

  describe('用户偏好区', () => {
    it('加载用户偏好到表单', async () => {
      useAppStore.setState({ currentUser: makeUser({ display_name: '李四' }) });

      render(<SettingsPage />);

      expect(await screen.findByDisplayValue('李四')).toBeInTheDocument();
      expect(screen.getByDisplayValue('CNY')).toBeDisabled();
      expect(screen.getByDisplayValue('3.5')).toBeInTheDocument();
    });

    it('校验失败阻止保存', async () => {
      useAppStore.setState({ currentUser: makeUser({}) });

      render(<SettingsPage />);
      await screen.findByDisplayValue('张三');

      fireEvent.change(screen.getByDisplayValue('张三'), { target: { value: '' } });
      fireEvent.click(screen.getByText('保存'));

      expect(screen.getByText('请输入显示名称')).toBeInTheDocument();
      expect(window.dataAccess.user.update).not.toHaveBeenCalled();
    });

    it('保存触发 updateUser + setCurrentUser', async () => {
      useAppStore.setState({ currentUser: makeUser({}) });
      const updatedUser = makeUser({ display_name: '王五', sync_version: 1 });
      (window.dataAccess.user.update as any).mockResolvedValue(updatedUser);

      render(<SettingsPage />);
      await screen.findByDisplayValue('张三');

      fireEvent.change(screen.getByDisplayValue('张三'), { target: { value: '王五' } });
      fireEvent.click(screen.getByText('保存'));

      await waitFor(() => {
        expect(window.dataAccess.user.update).toHaveBeenCalledWith('user-1', expect.objectContaining({ display_name: '王五' }));
      });
      await waitFor(() => {
        expect(useAppStore.getState().currentUser?.display_name).toBe('王五');
      });
    });

    it('重置按钮恢复表单到上次保存值', async () => {
      useAppStore.setState({ currentUser: makeUser({ display_name: '张三' }) });

      render(<SettingsPage />);
      await screen.findByDisplayValue('张三');

      fireEvent.change(screen.getByDisplayValue('张三'), { target: { value: '改了' } });
      fireEvent.click(screen.getByText('重置'));

      expect(screen.getByDisplayValue('张三')).toBeInTheDocument();
    });

    it('中国市场切换联动提现率（从 400 → 350）', async () => {
      useAppStore.setState({ currentUser: makeUser({ is_china_market: 0, default_withdrawal_rate: 400, base_currency: 'USD' }) });

      render(<SettingsPage />);
      await screen.findByDisplayValue('4');

      fireEvent.click(screen.getByLabelText('中国市场 (CNY)'));

      expect(await screen.findByDisplayValue('3.5')).toBeInTheDocument();
    });
  });

  describe('内置分类区', () => {
    it('渲染 11 支出 + 7 收入分类', async () => {
      useAppStore.setState({ currentUser: makeUser({}) });

      render(<SettingsPage />);

      await waitFor(() => {
        expect(screen.getByText('支出分类 (11)')).toBeInTheDocument();
        expect(screen.getByText('收入分类 (7)')).toBeInTheDocument();
      });
      expect(screen.getByText('住房')).toBeInTheDocument();
      expect(screen.getByText('工资薪金')).toBeInTheDocument();
    });

    it('重置分类弹出确认对话框', async () => {
      useAppStore.setState({ currentUser: makeUser({}) });

      render(<SettingsPage />);
      await screen.findByText('住房');

      fireEvent.click(screen.getByText('重置为默认'));
      expect(screen.getByText('确认重置内置分类')).toBeInTheDocument();
    });

    it('确认重置触发 resetSystemCategories + 重新加载', async () => {
      useAppStore.setState({ currentUser: makeUser({}) });

      render(<SettingsPage />);
      await screen.findByText('住房');

      fireEvent.click(screen.getByText('重置为默认'));
      fireEvent.click(screen.getByText('确认重置'));

      await waitFor(() => {
        expect(window.dataAccess.category.resetSystem).toHaveBeenCalledWith('user-1');
      });
      await waitFor(() => {
        expect(screen.queryByText('确认重置内置分类')).not.toBeInTheDocument();
      });
    });

    it('取消重置不触发 resetSystemCategories', async () => {
      useAppStore.setState({ currentUser: makeUser({}) });

      render(<SettingsPage />);
      await screen.findByText('住房');

      fireEvent.click(screen.getByText('重置为默认'));
      fireEvent.click(screen.getByText('取消'));

      expect(window.dataAccess.category.resetSystem).not.toHaveBeenCalled();
      expect(screen.queryByText('确认重置内置分类')).not.toBeInTheDocument();
    });
  });
});
