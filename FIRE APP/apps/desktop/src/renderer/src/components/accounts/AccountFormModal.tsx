// 账户新增/编辑表单弹窗 / Account create/edit form modal
// mode='create' 空表单；mode='edit' 预填充且余额只读

import { useEffect, useState } from 'react';
import type { Account, AssetClass, AccountType } from '@shared/types/index.js';
import type { CreateAccountInput, EditAccountInput } from '@shared/models/account.js';
import { yuanToCents, centsToYuan } from '@shared/utils/money.js';
import { Modal } from '../base/Modal.js';
import { Input } from '../base/Input.js';
import { Select } from '../base/Select.js';
import { Button } from '../base/Button.js';
import { ASSET_CLASS_OPTIONS, ACCOUNT_TYPE_OPTIONS } from './account-constants.js';

interface AccountFormModalProps {
  open: boolean;
  mode: 'create' | 'edit';
  account?: Account;
  userId?: string;        // create 模式必填，用于构造完整 CreateAccountInput
  loading?: boolean;      // 提交中状态，控制提交按钮 disabled 防重复提交
  onSubmit: (input: CreateAccountInput | EditAccountInput) => void;
  onClose: () => void;
}

export function AccountFormModal({ open, mode, account, userId, loading, onSubmit, onClose }: AccountFormModalProps) {
  const [name, setName] = useState('');
  const [assetClass, setAssetClass] = useState<AssetClass>('liquid');
  const [accountType, setAccountType] = useState<AccountType>('checking');
  const [initialBalance, setInitialBalance] = useState('0');
  const [note, setNote] = useState('');
  const [errors, setErrors] = useState<{ name?: string; initialBalance?: string }>({});

  // 打开时根据 mode 初始化表单值
  useEffect(() => {
    if (!open) return;
    if (mode === 'edit' && account) {
      setName(account.name);
      setAssetClass(account.asset_class);
      setAccountType(account.account_type);
      setInitialBalance(String(centsToYuan(account.current_balance)));
      setNote(account.note ?? '');
    } else {
      setName('');
      setAssetClass('liquid');
      setAccountType('checking');
      setInitialBalance('0');
      setNote('');
    }
    setErrors({});
  }, [open, mode, account]);

  const handleSubmit = () => {
    const errs: { name?: string; initialBalance?: string } = {};
    if (!name.trim()) errs.name = '请输入账户名称';
    if (mode === 'create') {
      if (initialBalance === '' || isNaN(Number(initialBalance))) {
        errs.initialBalance = '请输入有效金额';
      }
    }
    setErrors(errs);
    if (Object.keys(errs).length > 0) return;

    if (mode === 'create') {
      const input: CreateAccountInput = {
        user_id: userId ?? '',
        name: name.trim(),
        asset_class: assetClass,
        account_type: accountType,
        initial_balance: yuanToCents(Number(initialBalance) || 0),
        note: note.trim() || null,
      };
      onSubmit(input);
    } else {
      const input: EditAccountInput = {
        name: name.trim(),
        asset_class: assetClass,
        account_type: accountType,
        note: note.trim() || null,
      };
      onSubmit(input);
    }
  };

  return (
    <Modal
      open={open}
      title={mode === 'create' ? '新增账户' : '编辑账户'}
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
        <Input
          label="账户名称"
          type="text"
          value={name}
          required
          error={errors.name}
          placeholder="例如：招商银行活期"
          onChange={setName}
        />
        <div className="grid grid-cols-2 gap-4">
          <Select
            label="资产分类"
            options={ASSET_CLASS_OPTIONS}
            value={assetClass}
            required
            onChange={(v) => setAssetClass(v as AssetClass)}
          />
          <Select
            label="账户类型"
            options={ACCOUNT_TYPE_OPTIONS}
            value={accountType}
            required
            onChange={(v) => setAccountType(v as AccountType)}
          />
        </div>
        <Input
          label="初始余额"
          type="number"
          value={initialBalance}
          prefix="¥"
          error={errors.initialBalance}
          disabled={mode === 'edit'}
          onChange={setInitialBalance}
        />
        <Input
          label="备注"
          type="text"
          value={note}
          placeholder="可选，账户备注说明"
          onChange={setNote}
        />
      </div>
    </Modal>
  );
}
