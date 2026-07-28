// TransactionListTable 组件测试 / TransactionListTable component tests

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Transaction, Account, Category } from '@shared/types/index.js';
import { TransactionListTable } from '@renderer/components/transactions/TransactionListTable.js';

function makeTx(overrides: Partial<Transaction>): Transaction {
  return {
    id: 'tx-1',
    user_id: 'user-1',
    account_id: 'acc-1',
    to_account_id: null,
    category_id: null,
    recurring_id: null,
    transaction_type: 'expense',
    amount: 10000,
    transaction_date: new Date('2026-07-15').getTime(),
    description: '午餐',
    sync_version: 0,
    updated_at: 0,
    deleted_flag: 0,
    ...overrides,
  };
}

const accounts: Account[] = [
  { id: 'acc-1', user_id: 'user-1', name: '招行活期', asset_class: 'liquid', account_type: 'checking', current_balance: 100000, note: null, sync_version: 0, updated_at: 0, deleted_flag: 0 },
  { id: 'acc-2', user_id: 'user-1', name: '支付宝', asset_class: 'liquid', account_type: 'checking', current_balance: 50000, note: null, sync_version: 0, updated_at: 0, deleted_flag: 0 },
];

const categories: Category[] = [
  { id: 'cat-1', user_id: 'user-1', parent_id: null, name: '餐饮', type: 'expense', icon: null, color: null, linked_fire_concept: null, display_order: 0, is_system: 1, sync_version: 0, updated_at: 0, deleted_flag: 0 },
];

describe('TransactionListTable', () => {
  it('渲染交易行（类型标签、日期、金额）', () => {
    const txs = [makeTx({ id: 'tx-1', transaction_type: 'expense', amount: 5000, description: '午餐' })];
    render(
      <TransactionListTable
        transactions={txs}
        loading={false}
        accounts={accounts}
        categories={categories}
        hasActiveFilters={false}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
      />,
    );

    expect(screen.getByText('支出')).toBeInTheDocument();
    expect(screen.getByText('2026-07-15')).toBeInTheDocument();
    expect(screen.getByText('午餐')).toBeInTheDocument();
    // 金额 5000 分 = 50.00 元，支出带负号
    expect(screen.getByText(/50\.00/)).toBeInTheDocument();
  });

  it('transfer 显示 source → target', () => {
    const txs = [makeTx({
      id: 'tx-1',
      transaction_type: 'transfer',
      account_id: 'acc-1',
      to_account_id: 'acc-2',
      amount: 20000,
      description: null,
    })];
    render(
      <TransactionListTable
        transactions={txs}
        loading={false}
        accounts={accounts}
        categories={categories}
        hasActiveFilters={false}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
      />,
    );

    expect(screen.getByText('招行活期 → 支付宝')).toBeInTheDocument();
  });

  it('排序 Select 切换触发重排', async () => {
    const user = userEvent.setup();
    const txs = [
      makeTx({ id: 'tx-a', amount: 3000, transaction_date: new Date('2026-07-10').getTime() }),
      makeTx({ id: 'tx-b', amount: 10000, transaction_date: new Date('2026-07-15').getTime() }),
    ];
    render(
      <TransactionListTable
        transactions={txs}
        loading={false}
        accounts={accounts}
        categories={categories}
        hasActiveFilters={false}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
      />,
    );

    // 默认 date-desc：tx-b (Jul 15) 在前
    const sortSelect = screen.getByDisplayValue('日期降序');
    await user.selectOptions(sortSelect, 'amount-asc');

    // amount-asc：tx-a (3000) 在前
    // 验证第一行的日期是 07-10
    const rows = screen.getAllByRole('row');
    // rows[0] 是表头，rows[1] 是第一条数据
    expect(rows[1]).toHaveTextContent('2026-07-10');
  });

  it('空状态：无筛选时显示"暂无交易记录"', () => {
    render(
      <TransactionListTable
        transactions={[]}
        loading={false}
        accounts={accounts}
        categories={categories}
        hasActiveFilters={false}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
      />,
    );

    expect(screen.getByText('暂无交易记录')).toBeInTheDocument();
  });

  it('空状态：有筛选时显示"无匹配交易"', () => {
    render(
      <TransactionListTable
        transactions={[]}
        loading={false}
        accounts={accounts}
        categories={categories}
        hasActiveFilters={true}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
      />,
    );

    expect(screen.getByText('无匹配交易')).toBeInTheDocument();
  });

  it('编辑/删除按钮回调', async () => {
    const user = userEvent.setup();
    const onEdit = vi.fn();
    const onDelete = vi.fn();
    const txs = [makeTx({ id: 'tx-1' })];
    render(
      <TransactionListTable
        transactions={txs}
        loading={false}
        accounts={accounts}
        categories={categories}
        hasActiveFilters={false}
        onEdit={onEdit}
        onDelete={onDelete}
      />,
    );

    await user.click(screen.getByText('编辑'));
    expect(onEdit).toHaveBeenCalledWith(txs[0]);

    await user.click(screen.getByText('删除'));
    expect(onDelete).toHaveBeenCalledWith(txs[0]);
  });

  it('有分类时显示分类名称', () => {
    const txs = [makeTx({ id: 'tx-1', category_id: 'cat-1' })];
    render(
      <TransactionListTable
        transactions={txs}
        loading={false}
        accounts={accounts}
        categories={categories}
        hasActiveFilters={false}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
      />,
    );

    expect(screen.getByText('餐饮')).toBeInTheDocument();
  });

  it('无分类时显示 —', () => {
    const txs = [makeTx({ id: 'tx-1', category_id: null, transaction_type: 'transfer' })];
    render(
      <TransactionListTable
        transactions={txs}
        loading={false}
        accounts={accounts}
        categories={categories}
        hasActiveFilters={false}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
      />,
    );

    // transfer 没有 category_id → 显示 —
    expect(screen.getByText('—')).toBeInTheDocument();
  });
});
