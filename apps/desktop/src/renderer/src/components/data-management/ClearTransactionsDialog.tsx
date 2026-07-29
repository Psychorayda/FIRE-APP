// 清空交易确认对话框 / Clear transactions confirmation dialog

import { useState } from 'react';
import { Modal } from '@renderer/components/base/Modal.js';
import { Button } from '@renderer/components/base/Button.js';
import { useToastStore } from '@renderer/stores/toast-store.js';

const CONFIRM_TEXT = '确认清空';

interface ClearTransactionsDialogProps {
  open: boolean;
  onClose: () => void;
  onCleared: () => void;
}

export function ClearTransactionsDialog({ open, onClose, onCleared }: ClearTransactionsDialogProps) {
  const [confirmInput, setConfirmInput] = useState('');
  const [clearing, setClearing] = useState(false);
  const showSuccess = useToastStore((s) => s.showSuccess);
  const showError = useToastStore((s) => s.showError);
  const canConfirm = confirmInput === CONFIRM_TEXT && !clearing;

  const handleConfirm = async () => {
    if (!canConfirm) return;
    setClearing(true);
    try {
      const result = await window.dataAccess.exportImport.clearTransactions();
      if (result.success) {
        showSuccess(`已清空 ${result.clearedTransactionCount} 条交易、${result.clearedRecurringCount} 个模板、${result.resetAccountCount} 个账户余额归零`);
        onCleared();
        onClose();
      } else {
        showError(result.error ?? '清空失败');
      }
    } catch (e) {
      showError((e as Error).message);
    } finally {
      setClearing(false);
      setConfirmInput('');
    }
  };

  const handleClose = () => {
    setConfirmInput('');
    onClose();
  };

  return (
    <Modal open={open} onClose={handleClose} title="清空所有交易记录" width={440}>
      <div className="space-y-4">
        <div className="rounded-lg border border-red-300 bg-red-50 p-4 text-sm text-red-800">
          <p className="font-medium">警告：此操作不可恢复</p>
          <p className="mt-1">将软删除所有交易、经常性交易模板并归零所有账户余额。分类和快照不受影响。</p>
        </div>
        <div>
          <label className="block text-sm text-gray-600">
            请输入 <span className="font-bold text-red-600">{CONFIRM_TEXT}</span> 以确认：
          </label>
          <input
            type="text"
            value={confirmInput}
            onChange={(e) => setConfirmInput(e.target.value)}
            placeholder={CONFIRM_TEXT}
            className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2"
          />
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" size="md" onClick={handleClose} disabled={clearing}>取消</Button>
          <Button variant="danger" size="md" onClick={handleConfirm} disabled={!canConfirm} loading={clearing}>
            {clearing ? '清空中...' : CONFIRM_TEXT}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
