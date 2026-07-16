// TransactionFilters 组件测试 / TransactionFilters component tests

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Account, Category } from '@shared/types/index.js';
import { TransactionFilters } from '@renderer/components/transactions/TransactionFilters.js';
import type { TransactionFilters as Filters } from '@renderer/components/transactions/transaction-constants.js';

const accounts: Account[] = [
  { id: 'acc-1', user_id: 'user-1', name: '招行活期', asset_class: 'liquid', account_type: 'checking', current_balance: 100000, note: null, sync_version: 0, updated_at: 0, deleted_flag: 0 },
  { id: 'acc-2', user_id: 'user-1', name: '支付宝', asset_class: 'liquid', account_type: 'checking', current_balance: 50000, note: null, sync_version: 0, updated_at: 0, deleted_flag: 0 },
];

const categories: Category[] = [
  { id: 'cat-1', user_id: 'user-1', parent_id: null, name: '餐饮', type: 'expense', icon: null, color: null, linked_fire_concept: null, display_order: 0, is_system: 1, sync_version: 0, updated_at: 0, deleted_flag: 0 },
  { id: 'cat-2', user_id: 'user-1', parent_id: null, name: '工资', type: 'income', icon: null, color: null, linked_fire_concept: null, display_order: 1, is_system: 1, sync_version: 0, updated_at: 0, deleted_flag: 0 },
];

const EMPTY_FILTERS: Filters = { type: '', account_id: '', category_id: '', dateFrom: '', dateTo: '' };

describe('TransactionFilters', () => {
  it('渲染 5 个筛选项（3 个 Select + 2 个日期 Input）', () => {
    render(
      <TransactionFilters
        filters={EMPTY_FILTERS}
        accounts={accounts}
        categories={categories}
        onFiltersChange={vi.fn()}
        onReset={vi.fn()}
      />,
    );

    // 3 个 select
    const selects = screen.getAllByRole('combobox');
    expect(selects).toHaveLength(3);

    // 2 个 date input
    const dateInputs = document.querySelectorAll('input[type="date"]');
    expect(dateInputs).toHaveLength(2);

    // 全部类型 / 全部账户 / 全部分类
    expect(screen.getByText('全部类型')).toBeInTheDocument();
    expect(screen.getByText('全部账户')).toBeInTheDocument();
    expect(screen.getByText('全部分类')).toBeInTheDocument();
  });

  it('改变 type Select 触发 onFiltersChange', async () => {
    const user = userEvent.setup();
    const onFiltersChange = vi.fn();
    render(
      <TransactionFilters
        filters={EMPTY_FILTERS}
        accounts={accounts}
        categories={categories}
        onFiltersChange={onFiltersChange}
        onReset={vi.fn()}
      />,
    );

    const selects = screen.getAllByRole('combobox');
    // 第一个 select 是 type
    await user.selectOptions(selects[0], 'expense');

    expect(onFiltersChange).toHaveBeenCalledWith({ ...EMPTY_FILTERS, type: 'expense' });
  });

  it('改变 account Select 触发 onFiltersChange', async () => {
    const user = userEvent.setup();
    const onFiltersChange = vi.fn();
    render(
      <TransactionFilters
        filters={EMPTY_FILTERS}
        accounts={accounts}
        categories={categories}
        onFiltersChange={onFiltersChange}
        onReset={vi.fn()}
      />,
    );

    const selects = screen.getAllByRole('combobox');
    // 第二个 select 是 account
    await user.selectOptions(selects[1], 'acc-1');

    expect(onFiltersChange).toHaveBeenCalledWith({ ...EMPTY_FILTERS, account_id: 'acc-1' });
  });

  it('点击重置按钮触发 onReset', async () => {
    const user = userEvent.setup();
    const onReset = vi.fn();
    render(
      <TransactionFilters
        filters={EMPTY_FILTERS}
        accounts={accounts}
        categories={categories}
        onFiltersChange={vi.fn()}
        onReset={onReset}
      />,
    );

    const resetButton = screen.getByText('重置');
    await user.click(resetButton);

    expect(onReset).toHaveBeenCalledTimes(1);
  });

  it('accounts 正确映射为选项', () => {
    render(
      <TransactionFilters
        filters={EMPTY_FILTERS}
        accounts={accounts}
        categories={categories}
        onFiltersChange={vi.fn()}
        onReset={vi.fn()}
      />,
    );

    expect(screen.getByText('招行活期')).toBeInTheDocument();
    expect(screen.getByText('支付宝')).toBeInTheDocument();
  });

  it('categories 正确映射为选项', () => {
    render(
      <TransactionFilters
        filters={EMPTY_FILTERS}
        accounts={accounts}
        categories={categories}
        onFiltersChange={vi.fn()}
        onReset={vi.fn()}
      />,
    );

    expect(screen.getByText('餐饮')).toBeInTheDocument();
    expect(screen.getByText('工资')).toBeInTheDocument();
  });
});
