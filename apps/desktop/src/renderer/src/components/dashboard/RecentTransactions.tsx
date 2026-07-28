// 近期交易表 / Recent transactions table
// 精简版交易列表：4 列（类型、日期、账户、金额），无排序无操作
// Simplified transaction list: 4 columns (type, date, account, amount), no sort/actions

import type { Transaction, Account } from '@shared/types/index.js';
import { Card } from '../base/Card.js';
import { Table, type TableColumn } from '../base/Table.js';
import { EmptyState } from '../auxiliary/EmptyState.js';
import {
  TRANSACTION_TYPE_CONFIG,
  formatAmount,
  formatDate,
} from '../transactions/transaction-constants.js';

interface RecentTransactionsProps {
  transactions: Transaction[];
  accounts: Account[];
}

// 辅助：查找账户名 / Helper: find account name
function getAccountName(accounts: Account[], id: string | null): string {
  if (!id) return '—';
  return accounts.find((a) => a.id === id)?.name ?? '—';
}

export function RecentTransactions({ transactions, accounts }: RecentTransactionsProps) {
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
    // 日期 / Date
    {
      key: 'date',
      title: '日期',
      render: (r) => <span className="text-gray-600">{formatDate(r.transaction_date)}</span>,
    },
    // 账户：transfer 显示 source → target / Account: transfer shows source → target
    {
      key: 'account',
      title: '账户',
      render: (r) => {
        if (r.transaction_type === 'transfer') {
          return (
            <span className="text-gray-600">
              {getAccountName(accounts, r.account_id)} → {getAccountName(accounts, r.to_account_id)}
            </span>
          );
        }
        return <span className="text-gray-600">{getAccountName(accounts, r.account_id)}</span>;
      },
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
            {config.sign}{formatAmount(r.amount)}
          </span>
        );
      },
    },
  ];

  return (
    <Card title="近期交易">
      {transactions.length === 0 ? (
        <EmptyState title="暂无交易记录" description="点击「交易记录」开始记录" />
      ) : (
        <Table columns={columns} data={transactions} />
      )}
    </Card>
  );
}
