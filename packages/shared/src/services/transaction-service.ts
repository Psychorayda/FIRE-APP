import type { Database as DatabaseType } from 'better-sqlite3';
import { v4 as uuidv4 } from 'uuid';
import { nowMs } from '../utils/time.js';
import { getTransaction } from '../models/transaction.js';
import type { Transaction, TransactionType } from '../types/index.js';

export interface CreateTransactionInput {
  user_id: string;
  account_id: string;
  to_account_id?: string | null;
  category_id?: string | null;
  recurring_id?: string | null;
  transaction_type: TransactionType;
  amount: number;
  transaction_date: number;
  description?: string | null;
}

export interface EditTransactionInput {
  account_id?: string;
  to_account_id?: string | null;
  category_id?: string | null;
  transaction_type?: TransactionType;
  amount?: number;
  transaction_date?: number;
  description?: string | null;
}

function balanceDelta(type: TransactionType, amount: number): number {
  switch (type) {
    case 'income':
    case 'initial_balance':
      return amount;
    case 'expense':
      return -amount;
    case 'transfer':
      return -amount;
    default:
      return 0;
  }
}

export function createTransaction(db: DatabaseType, input: CreateTransactionInput): Transaction {
  if (input.transaction_type === 'transfer') {
    if (!input.to_account_id) { throw new Error('转账交易必须指定 to_account_id'); }
    if (input.to_account_id === input.account_id) { throw new Error('不能转账给自己'); }
  }

  const id = uuidv4();
  const now = nowMs();
  const tx: Transaction = {
    id, user_id: input.user_id, account_id: input.account_id,
    to_account_id: input.to_account_id ?? null, category_id: input.category_id ?? null,
    recurring_id: input.recurring_id ?? null, transaction_type: input.transaction_type,
    amount: input.amount, transaction_date: input.transaction_date,
    description: input.description ?? null, sync_version: 0, updated_at: now, deleted_flag: 0,
  };

  const insertTx = db.prepare(`INSERT INTO transactions (id, user_id, account_id, to_account_id, category_id, recurring_id, transaction_type, amount, transaction_date, description, sync_version, updated_at, deleted_flag) VALUES (@id, @user_id, @account_id, @to_account_id, @category_id, @recurring_id, @transaction_type, @amount, @transaction_date, @description, @sync_version, @updated_at, @deleted_flag)`);
  const updateBalance = db.prepare(`UPDATE accounts SET current_balance = current_balance + ?, last_updated = ? WHERE id = ?`);
  const delta = balanceDelta(tx.transaction_type, tx.amount);

  db.transaction(() => {
    insertTx.run(tx);
    updateBalance.run(delta, now, tx.account_id);
    if (tx.transaction_type === 'transfer' && tx.to_account_id) {
      updateBalance.run(tx.amount, now, tx.to_account_id);
    }
  })();

  return tx;
}

export function editTransaction(db: DatabaseType, id: string, input: EditTransactionInput): Transaction {
  const oldTx = getTransaction(db, id);
  if (!oldTx) { throw new Error(`Transaction not found: ${id}`); }

  const newType = input.transaction_type ?? oldTx.transaction_type;
  const newAmount = input.amount ?? oldTx.amount;
  const newAccountId = input.account_id ?? oldTx.account_id;
  const newToAccountId = input.to_account_id !== undefined ? input.to_account_id : oldTx.to_account_id;

  if (newType === 'transfer') {
    if (!newToAccountId) { throw new Error('转账交易必须指定 to_account_id'); }
    if (newToAccountId === newAccountId) { throw new Error('不能转账给自己'); }
  }

  const now = nowMs();
  const oldDelta = balanceDelta(oldTx.transaction_type, oldTx.amount);
  const newDelta = balanceDelta(newType, newAmount);

  const updateTx = db.prepare(`UPDATE transactions SET account_id = ?, to_account_id = ?, category_id = ?, transaction_type = ?, amount = ?, transaction_date = ?, description = ?, sync_version = ?, updated_at = ? WHERE id = ?`);
  const updateBalance = db.prepare(`UPDATE accounts SET current_balance = current_balance + ?, last_updated = ? WHERE id = ?`);

  db.transaction(() => {
    // 1. 反向调整旧交易余额
    updateBalance.run(-oldDelta, now, oldTx.account_id);
    if (oldTx.transaction_type === 'transfer' && oldTx.to_account_id) {
      updateBalance.run(-oldTx.amount, now, oldTx.to_account_id);
    }
    // 2. 正向应用新交易余额
    updateBalance.run(newDelta, now, newAccountId);
    if (newType === 'transfer' && newToAccountId) {
      updateBalance.run(newAmount, now, newToAccountId);
    }
    // 3. 更新交易记录
    updateTx.run(newAccountId, newToAccountId, input.category_id !== undefined ? input.category_id : oldTx.category_id, newType, newAmount, input.transaction_date ?? oldTx.transaction_date, input.description !== undefined ? input.description : oldTx.description, oldTx.sync_version + 1, now, id);
  })();

  return getTransaction(db, id)!;
}

export function deleteTransaction(db: DatabaseType, id: string): void {
  const tx = getTransaction(db, id);
  if (!tx) { throw new Error(`Transaction not found: ${id}`); }

  const now = nowMs();
  const delta = balanceDelta(tx.transaction_type, tx.amount);
  const updateBalance = db.prepare(`UPDATE accounts SET current_balance = current_balance + ?, last_updated = ? WHERE id = ?`);
  const softDelete = db.prepare(`UPDATE transactions SET deleted_flag = 1, sync_version = ?, updated_at = ? WHERE id = ?`);

  db.transaction(() => {
    updateBalance.run(-delta, now, tx.account_id);
    if (tx.transaction_type === 'transfer' && tx.to_account_id) {
      updateBalance.run(-tx.amount, now, tx.to_account_id);
    }
    softDelete.run(tx.sync_version + 1, now, id);
  })();
}
