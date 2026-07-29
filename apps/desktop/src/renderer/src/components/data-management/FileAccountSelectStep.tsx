// 步骤 2：选择文件和目标账户 / Step 2: Select file and target account

import { useAccountStore } from '@renderer/stores/account-store.js';
import { Select } from '@renderer/components/base/Select.js';

interface FileAccountSelectStepProps {
  filePath: string;
  accountId: string;
  onFilePathChange: (path: string) => void;
  onAccountIdChange: (id: string) => void;
}

export function FileAccountSelectStep({
  filePath, accountId, onFilePathChange, onAccountIdChange,
}: FileAccountSelectStepProps) {
  const accounts = useAccountStore((s) => s.accounts);

  const handleSelectFile = async () => {
    const result = await window.dataAccess.exportImport.showOpenDialog(['csv']);
    if (!result.canceled && result.filePath) {
      onFilePathChange(result.filePath);
    }
  };

  return (
    <div className="space-y-4">
      <h3 className="text-base font-semibold text-gray-900">选择文件和目标账户</h3>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">CSV 文件</label>
        <div className="flex gap-2">
          <input
            type="text"
            value={filePath}
            readOnly
            placeholder="未选择文件"
            className="flex-1 rounded-md border border-gray-300 px-3 py-2 bg-gray-50"
          />
          <button onClick={handleSelectFile} className="px-4 py-2 rounded-md bg-blue-600 text-white text-sm">
            选择文件
          </button>
        </div>
      </div>
      <Select
        label="目标账户"
        value={accountId}
        placeholder="请选择账户"
        onChange={(v) => onAccountIdChange(v)}
        options={accounts.map(a => ({ value: a.id, label: a.name }))}
      />
      <p className="text-xs text-gray-500">所有导入的交易将关联到此账户</p>
    </div>
  );
}
