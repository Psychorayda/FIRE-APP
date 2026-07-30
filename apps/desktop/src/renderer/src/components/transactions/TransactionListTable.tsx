// 交易列表表格 / Transaction list table
// 展示交易列表，支持排序（内嵌 Select）与行内编辑/删除操作
// Display transaction list, support sorting (inline Select) and row edit/delete actions

import { useMemo, useState } from 'react';
import type { Transaction, Account, Category } from '@shared/types/index.js';
import { Table, type TableColumn } from '../base/Table.js';
import { Button } from '../base/Button.js';
import { Select } from '../base/Select.js';
import { EmptyState } from '../auxiliary/EmptyState.js';
import {
  TRANSACTION_TYPE_CONFIG,
  formatAmount,
  formatDate,
  sortTransactions,
} from './transaction-constants.js';
import { useCurrency } from '../../hooks/use-currency.js';

interface TransactionListTableProps {
  transactions: Transaction[];   // 已筛选未排序
  loading: boolean;
  accounts: Account[];
  categories: Category[];
  hasActiveFilters: boolean;     // 用于判断空状态文案
  onEdit: (tx: Transaction) => void;
  onDelete: (tx: Transaction) => void;
}

// 排序选项 / Sort options
const SORT_OPTIONS = [
  { label: '日期降序', value: 'date-desc' },
  { label: '日期升序', value: 'date-asc' },
  { label: '金额降序', value: 'amount-desc' },
  { label: '金额升序', value: 'amount-asc' },
];

export function TransactionListTable({
  transactions, loading, accounts, categories, hasActiveFilters, onEdit, onDelete,
}: TransactionListTableProps) {
  const [sortBy, setSortBy] = useState('date-desc');
  const currency = useCurrency();

  const sortedTxs = useMemo(() => sortTransactions(transactions, sortBy), [transactions, sortBy]);

  // 预构建 id → name Map，render 内 O(1) 查找（替代每次 find O(n)）
  // Pre-build id → name Maps for O(1) lookup in render (replaces per-row find O(n))
  const accountMap = useMemo(() => new Map(accounts.map((a) => [a.id, a.name] as const)), [accounts]);
  const categoryMap = useMemo(() => new Map(categories.map((c) => [c.id, c.name] as const)), [categories]);
  const getAccountName = (id: string | null): string => (id ? (accountMap.get(id) ?? '—') : '—');
  const getCategoryName = (id: string | null): string => (id ? (categoryMap.get(id) ?? '—') : '—');

  const columns: TableColumn<Transaction>[] = [
    // 类型：色点 + 标签 / Type: dot + tag
    {
      key: 'type',
      title: '类型',
      render: (r) => {
        const config = TRANSACTION_TYPE_CONFIG[r.transaction_type];
        return (
          <div className="flex items-center gap-2">
            <span className={`inline-block w-2 h-2 rounded-full ${config.dotClass}`} />
            <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${config.tagClass}`}>
              {config.label}
            </span>
          </div>
        );
      },
    },
    // 日期 / Date（含描述副标题）/ Date (with description subtitle)
    {
      key: 'date',
      title: '日期',
      render: (r) => (
        <div>
          <span className="text-gray-600">{formatDate(r.transaction_date)}</span>
          {r.description && <div className="text-xs text-gray-500">{r.description}</div>}
        </div>
      ),
    },
    // 账户：transfer 显示 source → target / Account: transfer shows source → target
    {
      key: 'account',
      title: '账户',
      render: (r) => {
        if (r.transaction_type === 'transfer') {
          return (
            <span className="text-gray-600">
              {getAccountName(r.account_id)} → {getAccountName(r.to_account_id)}
            </span>
          );
        }
        return <span className="text-gray-600">{getAccountName(r.account_id)}</span>;
      },
    },
    // 分类 / Category
    {
      key: 'category',
      title: '分类',
      render: (r) => (
        <span className="text-gray-600">
          {r.category_id ? getCategoryName(r.category_id) : '—'}
        </span>
      ),
    },
    // 金额：sign + formatAmount，颜色按 type / Amount: sign + formatAmount, color by type
    {
      key: 'amount',
      title: '金额',
      align: 'right',
      render: (r) => {
        const config = TRANSACTION_TYPE_CONFIG[r.transaction_type];
        const colorClass =
          r.transaction_type === 'income' || r.transaction_type === 'initial_balance'
            ? 'text-green-600'
            : r.transaction_type === 'expense'
              ? 'text-red-600'
              : 'text-blue-600';
        return (
          <span className={`font-medium ${colorClass}`}>
            {config.sign}{formatAmount(r.amount, currency)}
          </span>
        );
      },
    },
    // 操作：编辑/删除 / Actions: edit/delete
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
      {/* 排序 Select：仅有数据且非 loading 时显示 */}
      {/* Sort Select: only show when has data and not loading */}
      {sortedTxs.length > 0 && !loading && (
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-500">排序：</span>
          <div className="w-40">
            <Select options={SORT_OPTIONS} value={sortBy} onChange={setSortBy} />
          </div>
        </div>
      )}

      {/* 表格 / 空状态 / Table / Empty state */}
      {loading ? (
        <Table columns={columns} data={[]} loading={true} />
      ) : sortedTxs.length === 0 ? (
        <EmptyState
          title={hasActiveFilters ? '无匹配交易' : '暂无交易记录'}
          description={hasActiveFilters ? '试试调整筛选条件' : '点击右上角「新增交易」开始记录'}
        />
      ) : (
        <Table columns={columns} data={sortedTxs} />
      )}
    </div>
  );
}
