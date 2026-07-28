// TransactionFormModal 组件测试 / TransactionFormModal component tests

import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Transaction, Account, Category } from '@shared/types/index.js';
import { TransactionFormModal } from '@renderer/components/transactions/TransactionFormModal.js';

function makeTx(overrides: Partial<Transaction>): Transaction {
  return {
    id: 'tx-1',
    user_id: 'user-1',
    account_id: 'acc-1',
    to_account_id: null,
    category_id: 'cat-1',
    recurring_id: null,
    transaction_type: 'expense',
    amount: 5000,
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
  { id: 'cat-2', user_id: 'user-1', parent_id: null, name: '工资', type: 'income', icon: null, color: null, linked_fire_concept: null, display_order: 1, is_system: 1, sync_version: 0, updated_at: 0, deleted_flag: 0 },
];

describe('TransactionFormModal', () => {
  it('create 模式渲染空表单（type 默认 expense）', () => {
    render(
      <TransactionFormModal
        open={true}
        mode="create"
        userId="user-1"
        accounts={accounts}
        categories={categories}
        onSubmit={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    expect(screen.getByText('新增交易')).toBeInTheDocument();
    // type 默认 expense → 显示 "支出"
    expect(screen.getByDisplayValue('支出')).toBeInTheDocument();
    // 账户未选 → 显示 placeholder
    expect(screen.getByDisplayValue('请选择账户')).toBeInTheDocument();
  });

  it('edit 模式预填字段', async () => {
    const tx = makeTx({ id: 'tx-1', transaction_type: 'expense', account_id: 'acc-1', amount: 5000, description: '午餐' });
    render(
      <TransactionFormModal
        open={true}
        mode="edit"
        transaction={tx}
        userId="user-1"
        accounts={accounts}
        categories={categories}
        onSubmit={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    expect(screen.getByText('编辑交易')).toBeInTheDocument();
    // 等待 useEffect 预填
    await waitFor(() => {
      expect(screen.getByDisplayValue('招行活期')).toBeInTheDocument();
    });
    // 金额 5000 分 = 50.00 元
    expect(screen.getByDisplayValue('50')).toBeInTheDocument();
    // 描述
    expect(screen.getByDisplayValue('午餐')).toBeInTheDocument();
  });

  it('切换 type 到 transfer 时显示 to_account_id', async () => {
    const user = userEvent.setup();
    render(
      <TransactionFormModal
        open={true}
        mode="create"
        userId="user-1"
        accounts={accounts}
        categories={categories}
        onSubmit={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    // 初始没有目标账户选择
    expect(screen.queryByText('目标账户')).not.toBeInTheDocument();

    // 切换到 transfer
    const typeSelect = screen.getByDisplayValue('支出');
    await user.selectOptions(typeSelect, 'transfer');

    // 显示目标账户 Select
    expect(screen.getByText('目标账户')).toBeInTheDocument();
  });

  it('切换 type 从 transfer 到 expense 时隐藏 to_account_id', async () => {
    const user = userEvent.setup();
    render(
      <TransactionFormModal
        open={true}
        mode="create"
        userId="user-1"
        accounts={accounts}
        categories={categories}
        onSubmit={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    // 先切换到 transfer
    const typeSelect = screen.getByDisplayValue('支出');
    await user.selectOptions(typeSelect, 'transfer');
    expect(screen.getByText('目标账户')).toBeInTheDocument();

    // 再切换回 expense
    await user.selectOptions(typeSelect, 'expense');
    expect(screen.queryByText('目标账户')).not.toBeInTheDocument();
  });

  it('校验：amount 为空时显示错误', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(
      <TransactionFormModal
        open={true}
        mode="create"
        userId="user-1"
        accounts={accounts}
        categories={categories}
        onSubmit={onSubmit}
        onClose={vi.fn()}
      />,
    );

    // 选择账户但不填金额
    const selects = screen.getAllByRole('combobox');
    // selects[0] = type, selects[1] = account
    await user.selectOptions(selects[1], 'acc-1');

    // 填日期
    const dateInput = document.querySelector('input[type="date"]') as HTMLInputElement;
    await user.type(dateInput, '2026-07-15');

    // 提交
    await user.click(screen.getByText('确定'));

    expect(screen.getByText('请输入有效金额')).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('校验：transfer 时 to_account_id = account_id 显示错误', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(
      <TransactionFormModal
        open={true}
        mode="create"
        userId="user-1"
        accounts={accounts}
        categories={categories}
        onSubmit={onSubmit}
        onClose={vi.fn()}
      />,
    );

    // 切换到 transfer
    const typeSelect = screen.getByDisplayValue('支出');
    await user.selectOptions(typeSelect, 'transfer');

    // 选择源账户和目标账户为同一个
    const selects = screen.getAllByRole('combobox');
    // selects[0] = type, selects[1] = account, selects[2] = to_account
    await user.selectOptions(selects[1], 'acc-1');
    await user.selectOptions(selects[2], 'acc-1');

    // 填金额
    const amountInput = document.querySelector('input[type="number"]') as HTMLInputElement;
    await user.type(amountInput, '100');

    // 填日期
    const dateInput = document.querySelector('input[type="date"]') as HTMLInputElement;
    await user.type(dateInput, '2026-07-15');

    // 提交
    await user.click(screen.getByText('确定'));

    expect(screen.getByText('目标账户不能与源账户相同')).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('提交：create 构造正确 input', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(
      <TransactionFormModal
        open={true}
        mode="create"
        userId="user-1"
        accounts={accounts}
        categories={categories}
        onSubmit={onSubmit}
        onClose={vi.fn()}
      />,
    );

    // type 默认 expense
    // 选择账户
    const selects = screen.getAllByRole('combobox');
    await user.selectOptions(selects[1], 'acc-1');

    // 选择分类
    await user.selectOptions(selects[2], 'cat-1');

    // 填金额 100 元 = 10000 分
    const amountInput = document.querySelector('input[type="number"]') as HTMLInputElement;
    await user.type(amountInput, '100');

    // 填日期
    const dateInput = document.querySelector('input[type="date"]') as HTMLInputElement;
    await user.type(dateInput, '2026-07-15');

    // 填描述
    const textInput = document.querySelector('input[type="text"]') as HTMLInputElement;
    await user.type(textInput, '测试');

    // 提交
    await user.click(screen.getByText('确定'));

    expect(onSubmit).toHaveBeenCalledTimes(1);
    const input = onSubmit.mock.calls[0][0];
    expect(input).toEqual(
      expect.objectContaining({
        user_id: 'user-1',
        account_id: 'acc-1',
        to_account_id: null,
        category_id: 'cat-1',
        transaction_type: 'expense',
        amount: 10000,
        description: '测试',
      }),
    );
    // transaction_date 应为 2026-07-15 的时间戳
    expect(input.transaction_date).toBe(new Date('2026-07-15').getTime());
  });

  it('提交：edit 构造正确 input（不含 user_id，非 transfer 时 to_account_id=null）', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    const tx = makeTx({
      id: 'tx-1',
      transaction_type: 'expense',
      account_id: 'acc-1',
      to_account_id: null,
      category_id: 'cat-1',
      amount: 5000,
      description: '午餐',
    });
    render(
      <TransactionFormModal
        open={true}
        mode="edit"
        transaction={tx}
        userId="user-1"
        accounts={accounts}
        categories={categories}
        onSubmit={onSubmit}
        onClose={vi.fn()}
      />,
    );

    // 等待预填
    await waitFor(() => {
      expect(screen.getByDisplayValue('招行活期')).toBeInTheDocument();
    });

    // 提交
    await user.click(screen.getByText('确定'));

    expect(onSubmit).toHaveBeenCalledTimes(1);
    const input = onSubmit.mock.calls[0][0];
    expect(input).toEqual(
      expect.objectContaining({
        account_id: 'acc-1',
        to_account_id: null,
        category_id: 'cat-1',
        transaction_type: 'expense',
        amount: 5000,
        description: '午餐',
      }),
    );
    // edit 模式不含 user_id
    expect(input).not.toHaveProperty('user_id');
  });
});
