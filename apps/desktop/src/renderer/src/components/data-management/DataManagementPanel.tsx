// 数据管理面板 / Data management panel
// 集成备份/恢复、数据导出、交易导入、危险操作四个功能块

import { useState } from 'react';
import { Button } from '@renderer/components/base/Button.js';
import { Select } from '@renderer/components/base/Select.js';
import { useToastStore } from '@renderer/stores/toast-store.js';
import { useAppStore } from '@renderer/stores/app-store.js';
import { useTransactionStore } from '@renderer/stores/transaction-store.js';
import { useAccountStore } from '@renderer/stores/account-store.js';
import { ClearTransactionsDialog } from './ClearTransactionsDialog.js';
import { CsvImportWizard } from './CsvImportWizard.js';

const TABLE_OPTIONS = [
  { value: 'transactions', label: '交易记录' },
  { value: 'accounts', label: '账户' },
  { value: 'categories', label: '分类' },
  { value: 'recurring_transactions', label: '经常性交易' },
  { value: 'net_worth_snapshots', label: '净资产快照' },
  { value: 'fire_scenarios', label: 'FIRE 场景' },
  { value: 'users', label: '用户' },
];

function timestamp(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
}

export function DataManagementPanel() {
  const showSuccess = useToastStore((s) => s.showSuccess);
  const showError = useToastStore((s) => s.showError);
  const currentUser = useAppStore((s) => s.currentUser);
  const fetchRecentTransactions = useTransactionStore((s) => s.fetchRecentTransactions);
  const fetchAccounts = useAccountStore((s) => s.fetchAccounts);
  const [csvWizardOpen, setCsvWizardOpen] = useState(false);
  const [clearDialogOpen, setClearDialogOpen] = useState(false);
  const [selectedTable, setSelectedTable] = useState('transactions');
  const [exportingJson, setExportingJson] = useState(false);
  const [exportingCsv, setExportingCsv] = useState(false);
  const [importingJson, setImportingJson] = useState(false);

  // 导入/清空会改变交易与账户数据，刷新相关 store 让其他页面看到最新值
  // Import/clear mutates transactions & accounts; refresh stores so other pages see fresh data
  const refreshStoresAfterDataChange = () => {
    if (!currentUser?.id) return;
    fetchRecentTransactions(currentUser.id, 10);
    fetchAccounts(currentUser.id);
  };

  const handleExportJson = async () => {
    setExportingJson(true);
    try {
      const dialogResult = await window.dataAccess.exportImport.showSaveDialog(`fire-app-export-${timestamp()}.json`, 'json');
      if (dialogResult.canceled || !dialogResult.filePath) return;
      const result = await window.dataAccess.exportImport.exportJson(dialogResult.filePath);
      if (result.success) showSuccess(`已导出 ${result.recordCount} 条记录`);
      else showError('导出失败');
    } catch (e) {
      showError(`导出失败: ${(e as Error).message}`);
    } finally {
      setExportingJson(false);
    }
  };

  const handleExportCsv = async () => {
    setExportingCsv(true);
    try {
      const dialogResult = await window.dataAccess.exportImport.showSaveDialog(`fire-app-${selectedTable}-${timestamp()}.csv`, 'csv');
      if (dialogResult.canceled || !dialogResult.filePath) return;
      const result = await window.dataAccess.exportImport.exportCsv(dialogResult.filePath, selectedTable as any);
      if (result.success) showSuccess(`已导出 ${result.recordCount} 条记录`);
      else showError('导出失败');
    } catch (e) {
      showError(`导出失败: ${(e as Error).message}`);
    } finally {
      setExportingCsv(false);
    }
  };

  const handleImportJson = async () => {
    setImportingJson(true);
    try {
      const dialogResult = await window.dataAccess.exportImport.showOpenDialog(['json']);
      if (dialogResult.canceled || !dialogResult.filePath) return;
      const result = await window.dataAccess.exportImport.importJson(dialogResult.filePath);
      if (result.success) {
        showSuccess(`导入完成：新增 ${result.inserted}，更新 ${result.updated}，跳过 ${result.skipped}`);
        refreshStoresAfterDataChange();
      } else {
        showError('导入失败');
      }
    } catch (e) {
      showError(`导入失败: ${(e as Error).message}`);
    } finally {
      setImportingJson(false);
    }
  };

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold text-gray-900">数据管理</h2>

      <div className="bg-white rounded-md border border-gray-200 p-6">
        <h3 className="text-base font-semibold text-gray-900 mb-3">备份与恢复</h3>
        <p className="text-sm text-gray-600 mb-4">JSON 全量备份用于跨设备迁移和完整数据恢复</p>
        <div className="flex gap-3">
          <Button variant="primary" size="md" onClick={handleExportJson} loading={exportingJson}>
            {exportingJson ? '导出中...' : '导出 JSON 备份'}
          </Button>
          <Button variant="secondary" size="md" onClick={handleImportJson} loading={importingJson}>
            {importingJson ? '导入中...' : '导入 JSON 备份'}
          </Button>
        </div>
      </div>

      <div className="bg-white rounded-md border border-gray-200 p-6">
        <h3 className="text-base font-semibold text-gray-900 mb-3">数据导出</h3>
        <p className="text-sm text-gray-600 mb-4">导出单张表为 CSV 文件（UTF-8 with BOM，可在 Excel 中查看）</p>
        <div className="flex gap-3 items-end">
          <div className="flex-1">
            <Select
              label="表名"
              value={selectedTable}
              options={TABLE_OPTIONS}
              onChange={(v) => setSelectedTable(v)}
            />
          </div>
          <Button variant="primary" size="md" onClick={handleExportCsv} loading={exportingCsv}>
            {exportingCsv ? '导出中...' : '导出 CSV'}
          </Button>
        </div>
      </div>

      <div className="bg-white rounded-md border border-gray-200 p-6">
        <h3 className="text-base font-semibold text-gray-900 mb-3">交易导入</h3>
        <p className="text-sm text-gray-600 mb-4">从支付宝、微信支付、7 家银行流水 CSV 文件导入交易</p>
        <Button variant="primary" size="md" onClick={() => setCsvWizardOpen(true)}>从 CSV 导入交易</Button>
        {csvWizardOpen && <CsvImportWizard onClose={() => setCsvWizardOpen(false)} />}
      </div>

      <div className="bg-white rounded-md border border-red-300 p-6">
        <h3 className="text-base font-semibold text-red-700 mb-3">危险操作</h3>
        <p className="text-sm text-gray-600 mb-4">清空所有交易记录、经常性交易模板并归零账户余额。此操作不可恢复。</p>
        <Button variant="danger" size="md" onClick={() => setClearDialogOpen(true)}>清空所有交易记录</Button>
        <ClearTransactionsDialog
          open={clearDialogOpen}
          onClose={() => setClearDialogOpen(false)}
          onCleared={refreshStoresAfterDataChange}
        />
      </div>
    </div>
  );
}
