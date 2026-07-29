// CSV 交易导入向导 / CSV transaction import wizard (5 steps)

import { useState, useCallback } from 'react';
import { Modal } from '@renderer/components/base/Modal.js';
import { Button } from '@renderer/components/base/Button.js';
import { TemplateSelectStep } from './TemplateSelectStep.js';
import { FileAccountSelectStep } from './FileAccountSelectStep.js';
import { PreviewEditStep } from './PreviewEditStep.js';
import { ConfirmImportStep } from './ConfirmImportStep.js';
import { ImportResultStep } from './ImportResultStep.js';
import { useAccountStore } from '@renderer/stores/account-store.js';
import { useToastStore } from '@renderer/stores/toast-store.js';
import type { ParsedCsvTransaction } from '@shared/import-templates/types.js';

type Step = 1 | 2 | 3 | 4 | 5;

interface CsvImportWizardProps {
  onClose: () => void;
}

export function CsvImportWizard({ onClose }: CsvImportWizardProps) {
  const [step, setStep] = useState<Step>(1);
  const [templateId, setTemplateId] = useState('');
  const [filePath, setFilePath] = useState('');
  const [accountId, setAccountId] = useState('');
  const [transactions, setTransactions] = useState<ParsedCsvTransaction[]>([]);
  const [parsing, setParsing] = useState(false);
  const [selectedTempIds, setSelectedTempIds] = useState<Set<string>>(new Set());
  const [result, setResult] = useState<{ inserted: number; skipped: number; errors: string[] } | null>(null);
  const accounts = useAccountStore((s) => s.accounts);
  const showError = useToastStore((s) => s.showError);

  const targetAccount = accounts.find(a => a.id === accountId);
  const selectedTxs = transactions.filter(t => selectedTempIds.has(t.tempId));

  const handleNextFromStep2 = async () => {
    if (!filePath || !accountId) {
      showError('请选择文件和目标账户');
      return;
    }
    setParsing(true);
    try {
      const parsed = await window.dataAccess.exportImport.parseCsv(templateId, filePath);
      const marked = await window.dataAccess.exportImport.markDuplicates(accountId, parsed);
      setTransactions(marked);
      setSelectedTempIds(new Set(marked.filter(t => !t.isDuplicate).map(t => t.tempId)));
      setStep(3);
    } catch (e) {
      showError(`解析失败: ${(e as Error).message}`);
    } finally {
      setParsing(false);
    }
  };

  const handleConfirmImport = async () => {
    try {
      const importResult = await window.dataAccess.exportImport.importCsvTransactions({
        templateId, filePath, accountId, transactions: selectedTxs,
      });
      setResult({ inserted: importResult.inserted, skipped: importResult.skipped, errors: importResult.errors });
      setStep(5);
    } catch (e) {
      showError(`导入失败: ${(e as Error).message}`);
    }
  };

  const handleSelectedChange = useCallback((ids: Set<string>) => {
    setSelectedTempIds(ids);
  }, []);

  const handleCategoryChange = (tempId: string, categoryId: string) => {
    setTransactions(prev => prev.map(t => t.tempId === tempId ? { ...t, finalCategoryId: categoryId } : t));
  };

  const canNext = step === 1 ? !!templateId
    : step === 2 ? !!filePath && !!accountId && !parsing
    : step === 3 ? selectedTxs.length > 0
    : false;

  return (
    <Modal open={true} onClose={onClose} title="CSV 交易导入向导" width={720}>
      <div className="space-y-4">
        {/* 进度指示器 */}
        <div className="flex justify-between text-sm text-gray-500">
          {[1, 2, 3, 4, 5].map(n => (
            <span key={n} className={step >= n ? 'text-blue-600 font-medium' : ''}>
              {n}. {n === 1 ? '选模板' : n === 2 ? '选文件' : n === 3 ? '预览' : n === 4 ? '确认' : '完成'}
            </span>
          ))}
        </div>

        {/* 步骤内容 */}
        {step === 1 && <TemplateSelectStep selectedTemplateId={templateId} onSelect={setTemplateId} />}
        {step === 2 && (
          <FileAccountSelectStep
            filePath={filePath} accountId={accountId}
            onFilePathChange={setFilePath} onAccountIdChange={setAccountId}
          />
        )}
        {step === 3 && (
          <PreviewEditStep
            transactions={transactions}
            onSelectedChange={handleSelectedChange}
            onCategoryChange={handleCategoryChange}
          />
        )}
        {step === 4 && (
          <ConfirmImportStep
            transactions={selectedTxs}
            selectedCount={selectedTxs.length}
            currentBalance={targetAccount?.current_balance ?? 0}
            accountName={targetAccount?.name ?? ''}
          />
        )}
        {step === 5 && result && (
          <ImportResultStep
            inserted={result.inserted} skipped={result.skipped} errors={result.errors} onClose={onClose}
          />
        )}

        {/* 导航按钮 */}
        {step < 5 && (
          <div className="flex justify-between pt-4 border-t border-gray-200">
            <Button variant="secondary" size="md" onClick={() => step === 1 ? onClose() : setStep((step - 1) as Step)}>
              {step === 1 ? '取消' : '上一步'}
            </Button>
            {step === 3 && (
              <Button variant="primary" size="md" onClick={() => setStep(4)} disabled={!canNext}>下一步</Button>
            )}
            {step === 2 && (
              <Button variant="primary" size="md" onClick={handleNextFromStep2} disabled={!canNext} loading={parsing}>
                {parsing ? '解析中...' : '下一步'}
              </Button>
            )}
            {step === 1 && (
              <Button variant="primary" size="md" onClick={() => setStep(2)} disabled={!canNext}>下一步</Button>
            )}
            {step === 4 && (
              <Button variant="primary" size="md" onClick={handleConfirmImport}>确认导入</Button>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
}
