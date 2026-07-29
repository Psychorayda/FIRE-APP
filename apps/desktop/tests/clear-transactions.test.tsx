// ClearTransactionsDialog 组件测试 / ClearTransactionsDialog component tests

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ClearTransactionsDialog } from '@renderer/components/data-management/ClearTransactionsDialog.js';

describe('ClearTransactionsDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (window.dataAccess.exportImport.clearTransactions as any).mockResolvedValue({
      success: true, clearedTransactionCount: 5, clearedRecurringCount: 2, resetAccountCount: 3,
    });
  });

  it('打开时显示警告和输入框', () => {
    render(<ClearTransactionsDialog open={true} onClose={vi.fn()} onCleared={vi.fn()} />);
    expect(screen.getByText(/软删除所有交易/)).toBeInTheDocument();
    expect(screen.getByPlaceholderText('确认清空')).toBeInTheDocument();
  });

  it('未输入"确认清空"时确认按钮禁用', () => {
    render(<ClearTransactionsDialog open={true} onClose={vi.fn()} onCleared={vi.fn()} />);
    const button = screen.getByRole('button', { name: '确认清空' });
    expect(button).toBeDisabled();
  });

  it('输入"确认清空"后按钮启用', () => {
    render(<ClearTransactionsDialog open={true} onClose={vi.fn()} onCleared={vi.fn()} />);
    fireEvent.change(screen.getByPlaceholderText('确认清空'), { target: { value: '确认清空' } });
    expect(screen.getByRole('button', { name: '确认清空' })).not.toBeDisabled();
  });

  it('点击确认调用 clearTransactions 并触发 onCleared', async () => {
    const onCleared = vi.fn();
    render(<ClearTransactionsDialog open={true} onClose={vi.fn()} onCleared={onCleared} />);
    fireEvent.change(screen.getByPlaceholderText('确认清空'), { target: { value: '确认清空' } });
    fireEvent.click(screen.getByRole('button', { name: '确认清空' }));
    await waitFor(() => {
      expect(window.dataAccess.exportImport.clearTransactions).toHaveBeenCalled();
      expect(onCleared).toHaveBeenCalled();
    });
  });

  it('点击取消关闭对话框', () => {
    const onClose = vi.fn();
    render(<ClearTransactionsDialog open={true} onClose={onClose} onCleared={vi.fn()} />);
    fireEvent.click(screen.getByText('取消'));
    expect(onClose).toHaveBeenCalled();
  });
});
