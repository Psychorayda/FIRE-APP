// CsvImportWizard 组件测试 / CsvImportWizard component tests

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { CsvImportWizard } from '@renderer/components/data-management/CsvImportWizard.js';
import { useAccountStore } from '@renderer/stores/account-store.js';
import { useTransactionStore } from '@renderer/stores/transaction-store.js';
import { useAppStore } from '@renderer/stores/app-store.js';
import { useCategoryStore } from '@renderer/stores/category-store.js';
import type { Account, Category, User } from '@shared/types/index.js';

function makeAccount(overrides: Partial<Account> = {}): Account {
  return {
    id: 'acc-1', name: '招行储蓄卡', asset_class: 'liquid', account_type: 'checking',
    current_balance: 100000, user_id: 'u1', last_updated: 0, display_order: 0,
    note: null, sync_version: 0, updated_at: 0, deleted_flag: 0, ...overrides,
  };
}

function makeUser(overrides: Partial<User> = {}): User {
  return {
    id: 'u1', display_name: '测试用户', base_currency: 'CNY', is_china_market: 1,
    default_withdrawal_rate: 0.04, default_expected_return: 0.07, default_inflation_rate: 0.03,
    encryption_key_hash: null, last_sync_at: null, sync_version: 0, updated_at: 0,
    deleted_flag: 0, ...overrides,
  };
}

function makeCategory(overrides: Partial<Category> = {}): Category {
  return {
    id: 'cat-food', user_id: 'u1', parent_id: null, name: '食品', type: 'expense',
    icon: null, color: null, linked_fire_concept: null, display_order: 0,
    is_system: 1, sync_version: 0, updated_at: 0, deleted_flag: 0, ...overrides,
  };
}

const mockAccounts = [makeAccount()];
const mockCategories = [
  makeCategory({ id: 'cat-food', name: '食品' }),
  makeCategory({ id: 'cat-transport', name: '交通' }),
];

const mockParsedTransactions = [
  { tempId: 't1', transactionDate: 1700000000000, amount: -5000, transactionType: 'expense', description: '美团外卖', counterparty: '美团', productDescription: '美团外卖', mappedCategoryId: '', inferredCategoryId: '', finalCategoryId: 'cat-food', dedupHash: 'h1', isDuplicate: false, sourceLine: 0 },
  { tempId: 't2', transactionDate: 1700000001000, amount: -2000, transactionType: 'expense', description: '滴滴打车', counterparty: '滴滴', productDescription: '滴滴打车', mappedCategoryId: '', inferredCategoryId: '', finalCategoryId: 'cat-transport', dedupHash: 'h2', isDuplicate: true, sourceLine: 1 },
];

/**
 * 走完 Step 1 → 2 → 3 流程，返回到预览页
 * Walk through Step 1 → 2 → 3 flow, landing on preview page
 */
async function walkToStep3() {
  const { container } = render(<CsvImportWizard onClose={vi.fn()} />);
  // Step 1: 选择模板
  fireEvent.click(screen.getByText('支付宝账单'));
  fireEvent.click(screen.getByText('下一步'));
  // Step 2: 选文件（异步）+ 选账户
  fireEvent.click(screen.getByText('选择文件'));
  await waitFor(() => {
    expect(screen.getByDisplayValue('/tmp/test.csv')).toBeInTheDocument();
  });
  const accountSelect = container.querySelector('select')!;
  fireEvent.change(accountSelect, { target: { value: 'acc-1' } });
  fireEvent.click(screen.getByText('下一步'));
  // Step 3: 等待解析完成
  await waitFor(() => {
    expect(screen.getByText('美团外卖')).toBeInTheDocument();
  });
  return { container };
}

describe('CsvImportWizard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // 提供当前用户 + 把 store load 方法替换为 spy，便于断言导入后刷新调用
    // Provide current user + replace store load methods with spies to assert refresh after import
    useAppStore.setState({ currentUser: makeUser() });
    useAccountStore.setState({ accounts: mockAccounts, loading: false, error: null, fetchAccounts: vi.fn() });
    useTransactionStore.setState({ fetchRecentTransactions: vi.fn(), pagedTransactions: [], recentTransactions: [], total: 0, loading: false, error: null });
    useCategoryStore.setState({ categories: mockCategories, loading: false, error: null });
    (window.dataAccess.exportImport.parseCsv as any).mockResolvedValue(mockParsedTransactions);
    (window.dataAccess.exportImport.showOpenDialog as any).mockResolvedValue({ canceled: false, filePath: '/tmp/test.csv' });
    (window.dataAccess.exportImport.detectTemplate as any).mockResolvedValue('alipay');
    (window.dataAccess.exportImport.markDuplicates as any).mockImplementation((_accId: string, txs: any[]) => Promise.resolve(txs));
    (window.dataAccess.exportImport.importCsvTransactions as any).mockResolvedValue({
      success: true, inserted: 1, updated: 0, skipped: 1, errors: [],
    });
  });

  it('Step 1 渲染模板列表', () => {
    render(<CsvImportWizard onClose={vi.fn()} />);
    expect(screen.getByText('支付宝账单')).toBeInTheDocument();
    expect(screen.getByText('微信支付账单')).toBeInTheDocument();
    expect(screen.getByText('招商银行借记卡')).toBeInTheDocument();
  });

  it('选择模板后进入 Step 2', () => {
    render(<CsvImportWizard onClose={vi.fn()} />);
    fireEvent.click(screen.getByText('支付宝账单'));
    fireEvent.click(screen.getByText('下一步'));
    expect(screen.getByText('选择文件和目标账户')).toBeInTheDocument();
  });

  it('Step 2 选文件 + 选账户后进入 Step 3', async () => {
    await walkToStep3();
    expect(window.dataAccess.exportImport.parseCsv).toHaveBeenCalled();
  });

  it('Step 3 显示交易表格，重复项标注', async () => {
    await walkToStep3();
    // 统计栏显示“重复: 1”，表头与行内标记也含“重复”，故用带计数的精确文本
    expect(screen.getByText('重复: 1')).toBeInTheDocument();
  });

  it('Step 4 确认页显示余额变化预览', async () => {
    await walkToStep3();
    fireEvent.click(screen.getByText('下一步'));
    expect(screen.getByText(/余额变化/)).toBeInTheDocument();
  });

  it('Step 5 完成页显示导入统计并刷新 stores', async () => {
    await walkToStep3();
    fireEvent.click(screen.getByText('下一步'));
    // 标题与按钮均含“确认导入”，用 role 精确定位按钮
    fireEvent.click(screen.getByRole('button', { name: '确认导入' }));
    await waitFor(() => {
      expect(window.dataAccess.exportImport.importCsvTransactions).toHaveBeenCalled();
      // 导入成功后刷新 transaction-store 和 account-store
      // Refresh transaction-store and account-store after successful import
      expect(useTransactionStore.getState().fetchRecentTransactions).toHaveBeenCalledWith('u1', 10);
      expect(useAccountStore.getState().fetchAccounts).toHaveBeenCalledWith('u1');
    });
    // 结果页用“成功插入”标签 + “{n} 条”计数两个 span 呈现
    expect(screen.getByText('成功插入')).toBeInTheDocument();
    // mock 返回 inserted=1、skipped=1，故“1 条”出现两次
    expect(screen.getAllByText('1 条')).toHaveLength(2);
  });
});
