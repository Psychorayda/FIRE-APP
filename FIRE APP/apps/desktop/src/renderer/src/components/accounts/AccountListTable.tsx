// 账户列表表格 / Account list table
// 展示账户列表，支持排序（Select 控制）与行内编辑/删除操作

import { useMemo, useState } from 'react';
import type { Account } from '@shared/types/index.js';
import { Table, type TableColumn } from '../base/Table.js';
import { Button } from '../base/Button.js';
import { Select } from '../base/Select.js';
import { EmptyState } from '../auxiliary/EmptyState.js';
import {
  ASSET_CLASS_CONFIG, ACCOUNT_TYPE_LABELS, formatBalance,
} from './account-constants.js';

interface AccountListTableProps {
  accounts: Account[];
  loading: boolean;
  onEdit: (account: Account) => void;
  onDelete: (account: Account) => void;
}

const SORT_OPTIONS = [
  { label: '默认顺序', value: 'default' },
  { label: '名称升序', value: 'name-asc' },
  { label: '名称降序', value: 'name-desc' },
  { label: '余额升序', value: 'balance-asc' },
  { label: '余额降序', value: 'balance-desc' },
];

export function AccountListTable({ accounts, loading, onEdit, onDelete }: AccountListTableProps) {
  const [sortBy, setSortBy] = useState('default');

  const sortedAccounts = useMemo(() => {
    const copy = [...accounts];
    switch (sortBy) {
      case 'name-asc': return copy.sort((a, b) => a.name.localeCompare(b.name));
      case 'name-desc': return copy.sort((a, b) => b.name.localeCompare(a.name));
      case 'balance-asc': return copy.sort((a, b) => a.current_balance - b.current_balance);
      case 'balance-desc': return copy.sort((a, b) => b.current_balance - a.current_balance);
      default: return copy; // 默认顺序：沿用 store 返回的 display_order, name 排序
    }
  }, [accounts, sortBy]);

  const columns: TableColumn<Account>[] = [
    {
      key: 'color',
      title: '',
      width: '40px',
      render: (r) => (
        <span className={`inline-block w-2 h-2 rounded-full ${ASSET_CLASS_CONFIG[r.asset_class].dotClass}`} />
      ),
    },
    {
      key: 'name',
      title: '账户名称',
      render: (r) => (
        <div>
          <div className="font-medium text-gray-900">{r.name}</div>
          {r.note && <div className="text-xs text-gray-400 mt-0.5">{r.note}</div>}
        </div>
      ),
    },
    {
      key: 'asset_class',
      title: '资产分类',
      render: (r) => (
        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${ASSET_CLASS_CONFIG[r.asset_class].tagClass}`}>
          {ASSET_CLASS_CONFIG[r.asset_class].label}
        </span>
      ),
    },
    {
      key: 'account_type',
      title: '账户类型',
      render: (r) => <span className="text-gray-600">{ACCOUNT_TYPE_LABELS[r.account_type]}</span>,
    },
    {
      key: 'current_balance',
      title: '当前余额',
      align: 'right',
      render: (r) => (
        <span className={r.current_balance < 0 ? 'text-red-600 font-medium' : 'text-gray-900'}>
          {formatBalance(r.current_balance)}
        </span>
      ),
    },
    {
      key: 'actions',
      title: '操作',
      align: 'right',
      render: (r) => (
        <div className="flex items-center justify-end gap-2">
          <Button variant="secondary" size="sm" onClick={() => onEdit(r)}>编辑</Button>
          <Button variant="danger" size="sm" onClick={() => onDelete(r)}>删除</Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-3">
      {sortedAccounts.length > 0 && !loading && (
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-500">排序：</span>
          <div className="w-40">
            <Select options={SORT_OPTIONS} value={sortBy} onChange={setSortBy} />
          </div>
        </div>
      )}
      {loading ? (
        <Table columns={columns} data={[]} loading={true} />
      ) : sortedAccounts.length === 0 ? (
        <EmptyState title="暂无账户" description="点击右上角「新增账户」开始管理你的资产" />
      ) : (
        <Table columns={columns} data={sortedAccounts} />
      )}
    </div>
  );
}
