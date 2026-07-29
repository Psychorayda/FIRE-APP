// 步骤 5：导入结果 / Step 5: Import result

interface ImportResultStepProps {
  inserted: number;
  skipped: number;
  errors: string[];
  onClose: () => void;
}

export function ImportResultStep({ inserted, skipped, errors, onClose }: ImportResultStepProps) {
  return (
    <div className="space-y-4">
      <h3 className="text-base font-semibold text-gray-900">导入完成</h3>
      <div className="bg-green-50 rounded-lg p-4 space-y-1">
        <div className="flex justify-between">
          <span>成功插入</span>
          <span className="font-medium text-green-700">{inserted} 条</span>
        </div>
        <div className="flex justify-between">
          <span>跳过</span>
          <span className="font-medium">{skipped} 条</span>
        </div>
      </div>
      {errors.length > 0 && (
        <div className="bg-red-50 rounded-lg p-4">
          <div className="font-medium text-red-700 mb-2">失败列表 ({errors.length})</div>
          <ul className="text-sm text-red-600 max-h-40 overflow-auto">
            {errors.map((err, idx) => <li key={idx}>{err}</li>)}
          </ul>
        </div>
      )}
      <button onClick={onClose} className="w-full px-4 py-2 rounded-md bg-blue-600 text-white">
        完成
      </button>
    </div>
  );
}
