// DataManagementPanel 组件测试 / DataManagementPanel component tests

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { DataManagementPanel } from '@renderer/components/data-management/DataManagementPanel.js';

// Mock CsvImportWizard 避免渲染整个向导
vi.mock('@renderer/components/data-management/CsvImportWizard.js', () => ({
  CsvImportWizard: () => <div data-testid="csv-wizard-mock" />,
}));

describe('DataManagementPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (window.dataAccess.exportImport.showSaveDialog as any).mockResolvedValue({ canceled: false, filePath: '/tmp/test.json' });
    (window.dataAccess.exportImport.exportJson as any).mockResolvedValue({ success: true, recordCount: 10 });
    (window.dataAccess.exportImport.exportCsv as any).mockResolvedValue({ success: true, recordCount: 5 });
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
