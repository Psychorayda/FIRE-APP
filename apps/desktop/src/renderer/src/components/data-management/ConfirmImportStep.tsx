// 步骤 4：确认导入 / Step 4: Confirm import

import type { ParsedCsvTransaction } from '@shared/import-templates/types.js';

interface ConfirmImportStepProps {
  transactions: ParsedCsvTransaction[];
  selectedCount: number;
  currentBalance: number;
  accountName: string;
}

export function ConfirmImportStep({
  transactions, selectedCount, currentBalance, accountName,
}: ConfirmImportStepProps) {
  // 估算余额变化：选中交易按收入/支出累加
  const totalDelta = transactions
    .reduce((sum, t) => {
      if (t.transactionType === 'income') return sum + Math.abs(t.amount);
      if (t.transactionType === 'expense') return sum - Math.abs(t.amount);
      return sum;
    }, 0);
  const newBalance = currentBalance + totalDelta;
  const formatYuan = (cents: number) => `¥${(cents / 100).toFixed(2)}`;

  return (
    <div className="space-y-4">
      <h3 className="text-base font-semibold text-gray-900">确认导入</h3>
      <div className="bg-blue-50 rounded-lg p-4 space-y-2">
        <div className="flex justify-between">
          <span>将导入：</span>
          <span className="font-medium">{selectedCount} 条交易</span>
        </div>
        <div className="flex justify-between">
          <span>跳过：</span>
          <span className="font-medium">{transactions.length - selectedCount} 条</span>
        </div>
      </div>
      <div className="bg-gray-50 rounded-lg p-4 space-y-2">
        <div className="font-medium text-gray-900">{accountName} 余额变化预览</div>
        <div className="flex justify-between text-sm">
          <span>当前余额</span>
          <span>{formatYuan(currentBalance)}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span>导入后余额</span>
          <span className={totalDelta >= 0 ? 'text-green-600 font-medium' : 'text-red-600 font-medium'}>
            {formatYuan(newBalance)}
          </span>
        </div>
      </div>
    </div>
  );
}
