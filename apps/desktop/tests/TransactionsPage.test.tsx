// TransactionsPage 页面集成测试 / TransactionsPage integration tests

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Transaction, Account, Category } from '@shared/types/index.js';

// mock dataAccess 模块（路径相对于测试文件）
// mock dataAccess module (path relative to test file)
// 新分页 API：getTransactionsPage 取代 getTransactionsByUser
vi.mock('../src/renderer/src/data/data-access.js', () => ({
  dataAccess: {
    getTransactionsPage: vi.fn(),
    getRecentTransactions: vi.fn(),
    getMonthlyOverview: vi.fn(),
    createTransaction: vi.fn(),
    editTransaction: vi.fn(),
    deleteTransaction: vi.fn(),
    getAccounts: vi.fn(),
    getCategories: vi.fn(),
    seedCategories: vi.fn(),
  },
}));

import { dataAccess } from '../src/renderer/src/data/data-access.js';
import { useTransactionStore } from '../src/renderer/src/stores/transaction-store.js';
import { useAccountStore } from '../src/renderer/src/stores/account-store.js';
import { useCategoryStore } from '../src/renderer/src/stores/category-store.js';
import { useAppStore } from '../src/renderer/src/stores/app-store.js';
import { useToastStore } from '../src/renderer/src/stores/toast-store.js';
import { TransactionsPage } from '../src/renderer/src/pages/TransactionsPage.js';

// Mock 数据 / Mock data
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

const mockAccounts: Account[] = [
  { id: 'acc-1', user_id: 'user-1', name: '招行活期', asset_class: 'liquid', account_type: 'checking', current_balance: 100000, note: null, sync_version: 0, updated_at: 0, deleted_flag: 0 },
];

const mockCategories: Category[] = [
  { id: 'cat-1', user_id: 'user-1', parent_id: null, name: '餐饮', type: 'expense', icon: null, color: null, linked_fire_concept: null, display_order: 0, is_system: 1, sync_version: 0, updated_at: 0, deleted_flag: 0 },
];

const mockTxs: Transaction[] = [
  makeTx({ id: 'tx-1', transaction_type: 'income', amount: 10000, description: '工资', category_id: 'cat-1' }),
  makeTx({ id: 'tx-2', transaction_type: 'expense', amount: 5000, description: '午餐', category_id: 'cat-1' }),
];

// 默认分页 mock：无 type 筛选时返回全部，type=expense 时只返回支出
// Default pagination mock: return all when no type filter, only expense when type=expense
function mockPageImplementation(_userId: string, params: { type?: string }) {
  if (params.type === 'expense') {
    return Promise.resolve({ items: [mockTxs[1]], total: 1 });
  }
  if (params.type === 'income') {
    return Promise.resolve({ items: [mockTxs[0]], total: 1 });
  }
  return Promise.resolve({ items: mockTxs, total: mockTxs.length });
}

describe('TransactionsPage', () => {
  beforeEach(() => {
    // 重置所有 store 状态（新分页字段）/ Reset all store states (new paged fields)
    useTransactionStore.setState({
      pagedTransactions: [], total: 0, recentTransactions: [],
      loading: false, error: null,
    });
    useAccountStore.setState({ accounts: [], loading: false, error: null });
    useCategoryStore.setState({ categories: [], loading: false, error: null });
    useToastStore.setState({ toasts: [] });
    useAppStore.setState({
      currentUser: { id: 'user-1', display_name: 'Test User' } as any,
      initialized: true,
      loading: false,
      error: null,
    });
    vi.clearAllMocks();
  });

  it('mount 时触发分页拉取（getTransactionsPage）+ accounts + categories', async () => {
    vi.mocked(dataAccess.getTransactionsPage).mockImplementation(mockPageImplementation);
    vi.mocked(dataAccess.getAccounts).mockResolvedValue([]);
    vi.mocked(dataAccess.getCategories).mockResolvedValue([]);

    render(<TransactionsPage />);

    await waitFor(() => {
      expect(dataAccess.getTransactionsPage).toHaveBeenCalledWith('user-1', expect.objectContaining({
        limit: 50, offset: 0,
      }));
      expect(dataAccess.getAccounts).toHaveBeenCalledWith('user-1');
      expect(dataAccess.getCategories).toHaveBeenCalledWith('user-1');
    });
  });

  it('筛选变化时概览卡和列表联动更新（服务端分页）', async () => {
    vi.mocked(dataAccess.getTransactionsPage).mockImplementation(mockPageImplementation);
    vi.mocked(dataAccess.getAccounts).mockResolvedValue(mockAccounts);
    vi.mocked(dataAccess.getCategories).mockResolvedValue(mockCategories);

    render(<TransactionsPage />);

    // 等待数据加载
    await waitFor(() => {
      expect(screen.getByText('工资')).toBeInTheDocument();
    });

    // 初始：2 条交易，概览显示收入 100.00 + 支出 50.00
    expect(screen.getByText('收入', { selector: 'span.text-gray-500' }).closest('.bg-white')!).toHaveTextContent('100.00');
    expect(screen.getByText('支出', { selector: 'span.text-gray-500' }).closest('.bg-white')!).toHaveTextContent('50.00');

    // 筛选 type=expense（服务端下推，重置到第 1 页）
    const user = userEvent.setup();
    const selects = screen.getAllByRole('combobox');
    await user.selectOptions(selects[0], 'expense');

    // 服务端只返回 1 条 expense，收入应为 0
    await waitFor(() => {
      expect(screen.getByText('收入', { selector: 'span.text-gray-500' }).closest('.bg-white')!).toHaveTextContent('0.00');
      expect(screen.getByText('支出', { selector: 'span.text-gray-500' }).closest('.bg-white')!).toHaveTextContent('50.00');
    });
    // 工资（income）不应再显示
    expect(screen.queryByText('工资')).not.toBeInTheDocument();
    // getTransactionsPage 应以 type: 'expense' 被调用
    expect(dataAccess.getTransactionsPage).toHaveBeenCalledWith('user-1', expect.objectContaining({
      type: 'expense', limit: 50, offset: 0,
    }));
  });

  it('新增交易流程（点击新增 → 弹窗 → 提交 → createTransaction 调用）', async () => {
    vi.mocked(dataAccess.getTransactionsPage).mockResolvedValue({ items: [], total: 0 });
    vi.mocked(dataAccess.getAccounts).mockResolvedValue(mockAccounts);
    vi.mocked(dataAccess.getCategories).mockResolvedValue(mockCategories);
    // createTransaction 返回完整 Transaction（store 会 upsertLocal 到列表）
    // createTransaction returns a full Transaction (store will upsertLocal into list)
    vi.mocked(dataAccess.createTransaction).mockResolvedValue(
      makeTx({ id: 'tx-new', transaction_type: 'expense', amount: 10000, description: '新交易' }),
    );

    const user = userEvent.setup();
    render(<TransactionsPage />);

    // 等待账户加载
    await waitFor(() => {
      expect(screen.getByText('暂无交易记录')).toBeInTheDocument();
    });

    // 点击新增
    await user.click(screen.getByText('+ 新增交易'));

    // 弹窗打开
    expect(screen.getByText('新增交易')).toBeInTheDocument();

    // 选择账户（限定到弹窗内，避免命中筛选区的 select）
    const dialog = screen.getByText('新增交易').closest('.relative.bg-white') as HTMLElement;
    const modalSelects = within(dialog).getAllByRole('combobox');
    // modalSelects[0] = type, modalSelects[1] = account
    await user.selectOptions(modalSelects[1], 'acc-1');

    // 填金额
    const amountInput = dialog.querySelector('input[type="number"]') as HTMLInputElement;
    await user.type(amountInput, '100');

    // 填日期
    const dateInput = dialog.querySelector('input[type="date"]') as HTMLInputElement;
    await user.type(dateInput, '2026-07-15');

    // 提交
    await user.click(screen.getByText('确定'));

    await waitFor(() => {
      expect(dataAccess.createTransaction).toHaveBeenCalledTimes(1);
    });
    const input = vi.mocked(dataAccess.createTransaction).mock.calls[0][0];
    expect(input).toEqual(
      expect.objectContaining({
        user_id: 'user-1',
        account_id: 'acc-1',
        transaction_type: 'expense',
        amount: 10000,
      }),
    );
  });

  it('编辑交易流程', async () => {
    vi.mocked(dataAccess.getTransactionsPage).mockResolvedValue({ items: mockTxs, total: mockTxs.length });
    vi.mocked(dataAccess.getAccounts).mockResolvedValue(mockAccounts);
    vi.mocked(dataAccess.getCategories).mockResolvedValue(mockCategories);
    // editTransaction 返回完整 Transaction（store 会 upsertLocal 替换列表中记录）
    // editTransaction returns a full Transaction (store will upsertLocal to replace in list)
    vi.mocked(dataAccess.editTransaction).mockResolvedValue(
      makeTx({ id: 'tx-edited', transaction_type: 'expense', amount: 5000, description: '午餐(已编辑)' }),
    );

    const user = userEvent.setup();
    render(<TransactionsPage />);

    // 等待数据加载
    await waitFor(() => {
      expect(screen.getByText('午餐')).toBeInTheDocument();
    });

    // 点击第一行的编辑按钮
    const editButtons = screen.getAllByText('编辑');
    await user.click(editButtons[0]);

    // 弹窗打开
    expect(screen.getByText('编辑交易')).toBeInTheDocument();

    // 等待预填
    await waitFor(() => {
      expect(screen.getByDisplayValue('招行活期')).toBeInTheDocument();
    });

    // 提交（edit 模式按钮文案为 "保存"）
    await user.click(screen.getByText('保存'));

    await waitFor(() => {
      expect(dataAccess.editTransaction).toHaveBeenCalledTimes(1);
    });
    // edit 不含 user_id
    const input = vi.mocked(dataAccess.editTransaction).mock.calls[0][1];
    expect(input).not.toHaveProperty('user_id');
  });

  it('删除交易流程（点击删除 → 确认 → deleteTransaction 调用 + 局部移除）', async () => {
    vi.mocked(dataAccess.getTransactionsPage).mockResolvedValue({ items: mockTxs, total: mockTxs.length });
    vi.mocked(dataAccess.getAccounts).mockResolvedValue(mockAccounts);
    vi.mocked(dataAccess.getCategories).mockResolvedValue(mockCategories);
    vi.mocked(dataAccess.deleteTransaction).mockResolvedValue({} as any);

    const user = userEvent.setup();
    render(<TransactionsPage />);

    // 等待数据加载
    await waitFor(() => {
      expect(screen.getByText('午餐')).toBeInTheDocument();
    });

    // 点击第一行的删除按钮
    const deleteButtons = screen.getAllByText('删除');
    await user.click(deleteButtons[0]);

    // 确认对话框出现
    expect(screen.getByText('删除交易')).toBeInTheDocument();

    // 点击确认
    await user.click(screen.getByText('确认'));

    await waitFor(() => {
      expect(dataAccess.deleteTransaction).toHaveBeenCalledTimes(1);
    });
    // 第一个参数是交易 id
    const txId = vi.mocked(dataAccess.deleteTransaction).mock.calls[0][0];
    expect(mockTxs.map((t) => t.id)).toContain(txId);

    // 局部更新：store 不再全量重拉，删除的记录从 pagedTransactions 中移除
    // Local update: store no longer full-refetches; deleted record removed from pagedTransactions
    await waitFor(() => {
      const remaining = useTransactionStore.getState().pagedTransactions.map((t) => t.id);
      expect(remaining).not.toContain(txId);
    });
    // 不应再次调用 getTransactionsPage（写操作后局部更新，不重拉）
    // getTransactionsPage should NOT be called again after delete (local update)
    const pageCallsBeforeDelete = vi.mocked(dataAccess.getTransactionsPage).mock.calls.length;
    await new Promise((r) => setTimeout(r, 50));
    expect(vi.mocked(dataAccess.getTransactionsPage).mock.calls.length).toBe(pageCallsBeforeDelete);
  });
});
