// 步骤 3：预览编辑 / Step 3: Preview and edit

import { useState, useEffect } from 'react';
import type { ParsedCsvTransaction } from '@shared/import-templates/types.js';
import { useCategoryStore } from '@renderer/stores/category-store.js';

interface PreviewEditStepProps {
  transactions: ParsedCsvTransaction[];
  onSelectedChange: (selectedTempIds: Set<string>) => void;
  onCategoryChange: (tempId: string, categoryId: string) => void;
}

export function PreviewEditStep({ transactions, onSelectedChange, onCategoryChange }: PreviewEditStepProps) {
  const categories = useCategoryStore((s) => s.categories);
  const [selectedTempIds, setSelectedTempIds] = useState<Set<string>>(
    new Set(transactions.filter(t => !t.isDuplicate).map(t => t.tempId))
  );

  const duplicateCount = transactions.filter(t => t.isDuplicate).length;
  const newCount = transactions.length - duplicateCount;

  const toggleSelect = (tempId: string) => {
    const next = new Set(selectedTempIds);
    if (next.has(tempId)) next.delete(tempId);
    else next.add(tempId);
    setSelectedTempIds(next);
  };

  const selectOnlyNew = () => setSelectedTempIds(new Set(transactions.filter(t => !t.isDuplicate).map(t => t.tempId)));

  useEffect(() => {
    onSelectedChange(selectedTempIds);
  }, [selectedTempIds, onSelectedChange]);

  const formatDate = (ts: number) => new Date(ts).toLocaleString('zh-CN');
  const formatAmount = (cents: number) => `¥${(cents / 100).toFixed(2)}`;

  return (
    <div className="space-y-3">
      <h3 className="text-base font-semibold text-gray-900">预览编辑</h3>
      <div className="flex gap-4 text-sm">
        <span>总数: {transactions.length}</span>
        <span className="text-green-600">新增: {newCount}</span>
        <span className="text-red-600">重复: {duplicateCount}</span>
        <span>已选: {selectedTempIds.size}</span>
      </div>
      <div className="flex gap-2 text-sm">
        <button onClick={selectOnlyNew} className="text-blue-600">仅选新增</button>
      </div>
      <div className="max-h-96 overflow-auto border border-gray-200 rounded-lg">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 sticky top-0">
            <tr>
              <th className="p-2 text-left">导入</th>
              <th className="p-2 text-left">日期</th>
              <th className="p-2 text-left">摘要</th>
              <th className="p-2 text-right">金额</th>
              <th className="p-2 text-left">类型</th>
              <th className="p-2 text-left">分类</th>
              <th className="p-2 text-left">重复</th>
            </tr>
          </thead>
          <tbody>
            {transactions.map(tx => (
              <tr key={tx.tempId} className={tx.isDuplicate ? 'bg-red-50' : ''}>
                <td className="p-2">
                  <input
                    type="checkbox"
                    checked={selectedTempIds.has(tx.tempId)}
                    onChange={() => toggleSelect(tx.tempId)}
                  />
                </td>
                <td className="p-2">{formatDate(tx.transactionDate)}</td>
                <td className="p-2">{tx.description}</td>
                <td className="p-2 text-right">{formatAmount(tx.amount)}</td>
                <td className="p-2">{tx.transactionType === 'income' ? '收入' : tx.transactionType === 'expense' ? '支出' : '转账'}</td>
                <td className="p-2">
                  <select
                    value={tx.finalCategoryId}
                    onChange={(e) => onCategoryChange(tx.tempId, e.target.value)}
                    className="border border-gray-300 rounded px-1 py-0.5"
                  >
                    {categories.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </td>
                <td className="p-2">{tx.isDuplicate ? <span className="text-red-600">重复</span> : ''}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
