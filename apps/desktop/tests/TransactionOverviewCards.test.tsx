// TransactionOverviewCards 组件测试 / TransactionOverviewCards component tests

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { Transaction } from '@shared/types/index.js';
import { TransactionOverviewCards } from '@renderer/components/transactions/TransactionOverviewCards.js';

function makeTx(overrides: Partial<Transaction>): Transaction {
  return {
    id: 'tx-1',
    user_id: 'user-1',
    account_id: 'acc-1',
    to_account_id: null,
    category_id: null,
    recurring_id: null,
    transaction_type: 'income',
    amount: 10000,
    transaction_date: new Date('2026-07-15').getTime(),
    description: null,
    sync_version: 0,
    updated_at: 0,
    deleted_flag: 0,
    ...overrides,
  };
}

describe('TransactionOverviewCards', () => {
  it('渲染 3 张卡，显示正确的金额', () => {
    const txs = [
      makeTx({ id: 'tx-1', transaction_type: 'income', amount: 10000 }),
      makeTx({ id: 'tx-2', transaction_type: 'expense', amount: 3000 }),
    ];
    render(<TransactionOverviewCards transactions={txs} />);

    // 3 张卡：收入、支出、结余
    expect(screen.getByText('收入')).toBeInTheDocument();
    expect(screen.getByText('支出')).toBeInTheDocument();
    expect(screen.getByText('结余')).toBeInTheDocument();

    // 收入 10000 分 = 100.00 元
    expect(screen.getByText('收入').closest('.bg-white')!).toHaveTextContent('100.00');
    // 支出 3000 分 = 30.00 元
    expect(screen.getByText('支出').closest('.bg-white')!).toHaveTextContent('30.00');
    // 结余 = 100 - 30 = 70.00 元
    expect(screen.getByText('结余').closest('.bg-white')!).toHaveTextContent('70.00');
  });

  it('transactions 为空数组时正常渲染（显示 ¥0.00）', () => {
    render(<TransactionOverviewCards transactions={[]} />);

    expect(screen.getByText('收入')).toBeInTheDocument();
    expect(screen.getByText('支出')).toBeInTheDocument();
    expect(screen.getByText('结余')).toBeInTheDocument();

    // 全部显示 0.00
    expect(screen.getByText('收入').closest('.bg-white')!).toHaveTextContent('0.00');
    expect(screen.getByText('支出').closest('.bg-white')!).toHaveTextContent('0.00');
    expect(screen.getByText('结余').closest('.bg-white')!).toHaveTextContent('0.00');
  });

  it('负数结余显示红色（text-red-600 class）', () => {
    const txs = [
      makeTx({ id: 'tx-1', transaction_type: 'income', amount: 5000 }),
      makeTx({ id: 'tx-2', transaction_type: 'expense', amount: 10000 }),
    ];
    const { container } = render(<TransactionOverviewCards transactions={txs} />);

    // 结余 = 50 - 100 = -50 元 → 负数 → 应有 text-red-600 class
    const balanceLabel = screen.getByText('结余');
    const balanceCard = balanceLabel.closest('.bg-white')!;
    const balanceValue = balanceCard.querySelector('.text-xl')!;
    expect(balanceValue.className).toContain('text-red-600');
  });

  it('正数结余不显示红色', () => {
    const txs = [
      makeTx({ id: 'tx-1', transaction_type: 'income', amount: 10000 }),
    ];
    render(<TransactionOverviewCards transactions={txs} />);

    const balanceLabel = screen.getByText('结余');
    const balanceCard = balanceLabel.closest('.bg-white')!;
    const balanceValue = balanceCard.querySelector('.text-xl')!;
    expect(balanceValue.className).not.toContain('text-red-600');
  });
});
