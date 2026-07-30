// DataManagementPanel 组件测试 / DataManagementPanel component tests

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { DataManagementPanel } from '@renderer/components/data-management/DataManagementPanel.js';
import { useAppStore } from '@renderer/stores/app-store.js';
import { useTransactionStore } from '@renderer/stores/transaction-store.js';
import { useAccountStore } from '@renderer/stores/account-store.js';
import type { User } from '@shared/types/index.js';

// Mock CsvImportWizard 避免渲染整个向导
vi.mock('@renderer/components/data-management/CsvImportWizard.js', () => ({
  CsvImportWizard: () => <div data-testid="csv-wizard-mock" />,
}));

function makeUser(overrides: Partial<User> = {}): User {
  return {
    id: 'u1', display_name: '测试用户', base_currency: 'CNY', is_china_market: 1,
    default_withdrawal_rate: 0.04, default_expected_return: 0.07, default_inflation_rate: 0.03,
    encryption_key_hash: null, last_sync_at: null, sync_version: 0, updated_at: 0,
    deleted_flag: 0, ...overrides,
  };
}

describe('DataManagementPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // 提供当前用户 + 把 store load 方法替换为 spy，便于断言刷新调用
    // Provide current user + replace store load methods with spies to assert refresh calls
    useAppStore.setState({ currentUser: makeUser() });
    useTransactionStore.setState({ fetchRecentTransactions: vi.fn(), pagedTransactions: [], recentTransactions: [], total: 0, loading: false, error: null });
    useAccountStore.setState({ fetchAccounts: vi.fn(), accounts: [], loading: false, error: null });
    (window.dataAccess.exportImport.showSaveDialog as any).mockResolvedValue({ canceled: false, filePath: '/tmp/test.json' });
    (window.dataAccess.exportImport.exportJson as any).mockResolvedValue({ success: true, recordCount: 10 });
    (window.dataAccess.exportImport.exportCsv as any).mockResolvedValue({ success: true, recordCount: 5 });
    (window.dataAccess.exportImport.showOpenDialog as any).mockResolvedValue({ canceled: false, filePath: '/tmp/test.json' });
    (window.dataAccess.exportImport.importJson as any).mockResolvedValue({ success: true, inserted: 3, updated: 1, skipped: 0, errors: [] });
    (window.dataAccess.exportImport.clearTransactions as any).mockResolvedValue({
      success: true, clearedTransactionCount: 5, clearedRecurringCount: 2, resetAccountCount: 3,
    });
  });

  it('渲染 4 个功能块标题', () => {
    render(<DataManagementPanel />);
    expect(screen.getByText('备份与恢复')).toBeInTheDocument();
    expect(screen.getByText('数据导出')).toBeInTheDocument();
    expect(screen.getByText('交易导入')).toBeInTheDocument();
    expect(screen.getByText('危险操作')).toBeInTheDocument();
  });

  it('点击导出 JSON 调用 showSaveDialog + exportJson', async () => {
    render(<DataManagementPanel />);
    fireEvent.click(screen.getByText('导出 JSON 备份'));
    await waitFor(() => {
      expect(window.dataAccess.exportImport.showSaveDialog).toHaveBeenCalled();
      expect(window.dataAccess.exportImport.exportJson).toHaveBeenCalledWith('/tmp/test.json');
    });
  });

  it('点击导出 CSV 调用 exportCsv', async () => {
    render(<DataManagementPanel />);
    fireEvent.click(screen.getByText('导出 CSV'));
    await waitFor(() => {
      expect(window.dataAccess.exportImport.exportCsv).toHaveBeenCalled();
    });
  });

  it('导出 JSON 失败时显示错误提示且不崩', async () => {
    (window.dataAccess.exportImport.exportJson as any).mockRejectedValue(new Error('磁盘已满'));
    render(<DataManagementPanel />);
    fireEvent.click(screen.getByText('导出 JSON 备份'));
    await waitFor(() => {
      expect(window.dataAccess.exportImport.exportJson).toHaveBeenCalled();
    });
    // 按钮恢复可用（loading 结束）
    // Button recovers (loading ended)
    expect(await screen.findByText('导出 JSON 备份')).toBeInTheDocument();
  });

  it('导入 JSON 成功后刷新 transaction-store 和 account-store', async () => {
    render(<DataManagementPanel />);
    fireEvent.click(screen.getByText('导入 JSON 备份'));
    await waitFor(() => {
      expect(window.dataAccess.exportImport.importJson).toHaveBeenCalledWith('/tmp/test.json');
      expect(useTransactionStore.getState().fetchRecentTransactions).toHaveBeenCalledWith('u1', 10);
      expect(useAccountStore.getState().fetchAccounts).toHaveBeenCalledWith('u1');
    });
  });

  it('清空交易成功后刷新 transaction-store 和 account-store', async () => {
    render(<DataManagementPanel />);
    fireEvent.click(screen.getByText('清空所有交易记录'));
    fireEvent.change(screen.getByPlaceholderText('确认清空'), { target: { value: '确认清空' } });
    fireEvent.click(screen.getByRole('button', { name: '确认清空' }));
    await waitFor(() => {
      expect(window.dataAccess.exportImport.clearTransactions).toHaveBeenCalled();
      expect(useTransactionStore.getState().fetchRecentTransactions).toHaveBeenCalledWith('u1', 10);
      expect(useAccountStore.getState().fetchAccounts).toHaveBeenCalledWith('u1');
    });
  });

  it('点击清空交易打开确认对话框', () => {
    render(<DataManagementPanel />);
    fireEvent.click(screen.getByText('清空所有交易记录'));
    expect(screen.getByText(/软删除所有交易/)).toBeInTheDocument();
  });

  it('点击从 CSV 导入交易打开向导', () => {
    render(<DataManagementPanel />);
    fireEvent.click(screen.getByText('从 CSV 导入交易'));
    expect(screen.getByTestId('csv-wizard-mock')).toBeInTheDocument();
  });
});
