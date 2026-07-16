// 交易新增/编辑表单弹窗 / Transaction create/edit form modal
// mode='create' 空表单；mode='edit' 预填充
// transfer 时显示 to_account_id 并校验 ≠ account_id；非 transfer 时 to_account_id 强制 null

import { useEffect, useState } from 'react';
import type { Transaction, TransactionType, Account, Category } from '@shared/types/index.js';
import type { CreateTransactionInput, EditTransactionInput } from '@shared/services/transaction-service.js';
import { yuanToCents, centsToYuan } from '@shared/utils/money.js';
import { Modal } from '../base/Modal.js';
import { Input } from '../base/Input.js';
import { Select } from '../base/Select.js';
import { Button } from '../base/Button.js';
import { TRANSACTION_TYPE_OPTIONS, formatDate } from './transaction-constants.js';

interface TransactionFormModalProps {
  open: boolean;
  mode: 'create' | 'edit';
  transaction?: Transaction;
  userId?: string;
  accounts: Account[];
  categories: Category[];
  loading?: boolean;
  onSubmit: (input: CreateTransactionInput | EditTransactionInput) => void;
  onClose: () => void;
}

interface FormErrors {
  accountId?: string;
  toAccountId?: string;
  amount?: string;
  transactionDate?: string;
}

export function TransactionFormModal({
  open, mode, transaction, userId, accounts, categories, loading, onSubmit, onClose,
}: TransactionFormModalProps) {
  const [transactionType, setTransactionType] = useState<TransactionType>('expense');
  const [accountId, setAccountId] = useState('');
  const [toAccountId, setToAccountId] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [amount, setAmount] = useState('');
  const [transactionDate, setTransactionDate] = useState('');
  const [description, setDescription] = useState('');
  const [errors, setErrors] = useState<FormErrors>({});

  // 打开时根据 mode 初始化表单值
  // Initialize form values on open based on mode
  useEffect(() => {
    if (!open) return;
    if (mode === 'edit' && transaction) {
      setTransactionType(transaction.transaction_type);
      setAccountId(transaction.account_id);
      setToAccountId(transaction.to_account_id ?? '');
      setCategoryId(transaction.category_id ?? '');
      setAmount(centsToYuan(transaction.amount).toString());
      setTransactionDate(formatDate(transaction.transaction_date));
      setDescription(transaction.description ?? '');
    } else {
      setTransactionType('expense');
      setAccountId('');
      setToAccountId('');
      setCategoryId('');
      setAmount('');
      setTransactionDate('');
      setDescription('');
    }
    setErrors({});
  }, [open, mode, transaction]);

  const isTransfer = transactionType === 'transfer';

  // 账户选项 / Account options
  const accountOptions = accounts.map((a) => ({ label: a.name, value: a.id }));
  // 分类选项：包含"不选分类" / Category options: includes "no category"
  const categoryOptions = [
    { label: '不选分类', value: '' },
    ...categories.map((c) => ({ label: c.name, value: c.id })),
  ];

  const handleSubmit = () => {
    const errs: FormErrors = {};
    if (!accountId) errs.accountId = '请选择账户';
    if (!amount || Number(amount) <= 0) errs.amount = '请输入有效金额';
    if (isTransfer) {
      if (!toAccountId) errs.toAccountId = '请选择目标账户';
      if (toAccountId && toAccountId === accountId) errs.toAccountId = '目标账户不能与源账户相同';
    }
    if (!transactionDate) errs.transactionDate = '请选择日期';
    setErrors(errs);
    if (Object.keys(errs).length > 0) return;

    // 非 transfer 时 to_account_id 强制 null
    // Force to_account_id to null for non-transfer
    const resolvedToAccountId = isTransfer ? toAccountId : null;
    const resolvedCategoryId = categoryId || null;
    const resolvedAmount = yuanToCents(Number(amount));
    const resolvedDate = new Date(transactionDate).getTime();
    const resolvedDescription = description.trim() || null;

    if (mode === 'create') {
      const input: CreateTransactionInput = {
        user_id: userId ?? '',
        account_id: accountId,
        to_account_id: resolvedToAccountId,
        category_id: resolvedCategoryId,
        transaction_type: transactionType,
        amount: resolvedAmount,
        transaction_date: resolvedDate,
        description: resolvedDescription,
      };
      onSubmit(input);
    } else {
      const input: EditTransactionInput = {
        account_id: accountId,
        to_account_id: resolvedToAccountId,
        category_id: resolvedCategoryId,
        transaction_type: transactionType,
        amount: resolvedAmount,
        transaction_date: resolvedDate,
        description: resolvedDescription,
      };
      onSubmit(input);
    }
  };

  return (
    <Modal
      open={open}
      title={mode === 'create' ? '新增交易' : '编辑交易'}
      onClose={onClose}
      width={520}
      footer={
        <>
          <Button variant="secondary" size="md" onClick={onClose} disabled={loading}>取消</Button>
          <Button variant="primary" size="md" loading={loading} onClick={handleSubmit}>确定</Button>
        </>
      }
    >
      <div className="space-y-4">
        {/* 交易类型 / Transaction type */}
        <Select
          label="交易类型"
          options={TRANSACTION_TYPE_OPTIONS}
          value={transactionType}
          required
          onChange={(v) => setTransactionType(v as TransactionType)}
        />

        {/* 账户 / Account */}
        <Select
          label="账户"
          options={accountOptions}
          value={accountId}
          required
          error={errors.accountId}
          placeholder="请选择账户"
          onChange={setAccountId}
        />

        {/* 目标账户：仅 transfer 时显示 / Target account: only show for transfer */}
        {isTransfer && (
          <Select
            label="目标账户"
            options={accountOptions}
            value={toAccountId}
            required
            error={errors.toAccountId}
            placeholder="请选择目标账户"
            onChange={setToAccountId}
          />
        )}

        {/* 分类（可选） / Category (optional) */}
        <Select
          label="分类"
          options={categoryOptions}
          value={categoryId}
          onChange={setCategoryId}
        />

        {/* 金额 / Amount */}
        <Input
          label="金额"
          type="number"
          value={amount}
          required
          prefix="¥"
          error={errors.amount}
          placeholder="请输入金额"
          onChange={setAmount}
        />

        {/* 日期 / Date */}
        <Input
          label="日期"
          type="date"
          value={transactionDate}
          required
          error={errors.transactionDate}
          onChange={setTransactionDate}
        />

        {/* 描述（可选） / Description (optional) */}
        <Input
          label="描述"
          type="text"
          value={description}
          placeholder="可选，交易备注"
          onChange={setDescription}
        />
      </div>
    </Modal>
  );
}
