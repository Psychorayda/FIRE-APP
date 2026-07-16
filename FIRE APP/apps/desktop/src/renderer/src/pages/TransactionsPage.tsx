// 交易记录页 / Transactions page
// 组合概览卡片、筛选、列表表格、表单弹窗、删除确认，完成交易 CRUD
// 复刻 AccountsPage 模式：store 错误处理 + useEffect 加载 + getState().error 判定成功

import { useEffect, useMemo, useState } from 'react';
import type { Transaction } from '@shared/types/index.js';
import type { CreateTransactionInput, EditTransactionInput } from '@shared/services/transaction-service.js';
import { useTransactionStore } from '../stores/transaction-store.js';
import { useAccountStore } from '../stores/account-store.js';
import { useCategoryStore } from '../stores/category-store.js';
import { useAppStore } from '../stores/app-store.js';
import { useToastStore } from '../stores/toast-store.js';
import { PageHeader } from '../components/layout/PageHeader.js';
import { Button } from '../components/base/Button.js';
import { ConfirmDialog } from '../components/base/ConfirmDialog.js';
import { TransactionOverviewCards } from '../components/transactions/TransactionOverviewCards.js';
import { TransactionFilters } from '../components/transactions/TransactionFilters.js';
import { TransactionListTable } from '../components/transactions/TransactionListTable.js';
import { TransactionFormModal } from '../components/transactions/TransactionFormModal.js';
import {
  type TransactionFilters as Filters,
  filterTransactions, computeOverview, hasActiveFilters,
} from '../components/transactions/transaction-constants.js';

// 空筛选状态 / Empty filter state
const EMPTY_FILTERS: Filters = { type: '', account_id: '', category_id: '', dateFrom: '', dateTo: '' };

export function TransactionsPage() {
  const { transactions, loading, error, fetchTransactions, createTransaction, editTransaction, deleteTransaction } = useTransactionStore();
  const { accounts, fetchAccounts } = useAccountStore();
  const { categories, fetchCategories } = useCategoryStore();
  const { currentUser } = useAppStore();
  const { showSuccess, showError } = useToastStore();

  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create');
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Transaction | null>(null);

  // 派生：筛选后的交易 + 是否有激活筛选
  // Derived: filtered transactions + whether filters are active
  const filtered = useMemo(() => filterTransactions(transactions, filters), [transactions, filters]);
  const activeFilters = hasActiveFilters(filters);

  // 初始加载交易、账户、分类
  // Initial load: transactions, accounts, categories
  useEffect(() => {
    if (currentUser) {
      fetchTransactions(currentUser.id);
      fetchAccounts(currentUser.id);
      fetchCategories(currentUser.id);
    }
  }, [currentUser, fetchTransactions, fetchAccounts, fetchCategories]);

  // 监听 store error，自动弹出错误 Toast
  // Monitor store error, auto show error toast
  useEffect(() => {
    if (error) showError(error);
  }, [error, showError]);

  const openCreateModal = () => {
    setModalMode('create');
    setEditingTransaction(null);
    setModalOpen(true);
  };

  const openEditModal = (tx: Transaction) => {
    setModalMode('edit');
    setEditingTransaction(tx);
    setModalOpen(true);
  };

  const closeModal = () => setModalOpen(false);

  const openConfirm = (tx: Transaction) => {
    setDeleteTarget(tx);
    setConfirmOpen(true);
  };

  const closeConfirm = () => {
    setConfirmOpen(false);
    setDeleteTarget(null);
  };

  const handleResetFilters = () => setFilters(EMPTY_FILTERS);

  // 表单提交：create 调 createTransaction，edit 调 editTransaction
  // store 方法内部捕获错误并写入 state.error（不抛出），故用 getState().error 判定成功/失败
  const handleSubmit = async (input: CreateTransactionInput | EditTransactionInput) => {
    if (!currentUser) return;
    if (modalMode === 'create') {
      await createTransaction(input as CreateTransactionInput, currentUser.id);
    } else if (editingTransaction) {
      await editTransaction(editingTransaction.id, input as EditTransactionInput, currentUser.id);
    }
    if (!useTransactionStore.getState().error) {
      setModalOpen(false);
      showSuccess(modalMode === 'create' ? '交易创建成功' : '交易更新成功');
    }
  };

  const handleDelete = async () => {
    if (!currentUser || !deleteTarget) return;
    setConfirmOpen(false);
    await deleteTransaction(deleteTarget.id, currentUser.id);
    if (!useTransactionStore.getState().error) {
      showSuccess('交易已删除');
    }
    setDeleteTarget(null);
  };

  return (
    <div>
      <PageHeader
        title="交易记录"
        extra={<Button variant="primary" size="md" onClick={openCreateModal}>+ 新增交易</Button>}
      />
      <div className="p-8 space-y-6">
        {/* 概览卡：filtered.length === 0 时隐藏 */}
        {/* Overview cards: hidden when filtered.length === 0 */}
        {filtered.length > 0 && (
          <TransactionOverviewCards transactions={filtered} />
        )}

        {/* 筛选 / Filters */}
        <TransactionFilters
          filters={filters}
          accounts={accounts}
          categories={categories}
          onFiltersChange={setFilters}
          onReset={handleResetFilters}
        />

        {/* 列表表格 / List table */}
        <TransactionListTable
          transactions={filtered}
          loading={loading}
          accounts={accounts}
          categories={categories}
          hasActiveFilters={activeFilters}
          onEdit={openEditModal}
          onDelete={openConfirm}
        />
      </div>

      {/* 表单弹窗 / Form modal */}
      <TransactionFormModal
        open={modalOpen}
        mode={modalMode}
        transaction={editingTransaction ?? undefined}
        userId={currentUser?.id}
        accounts={accounts}
        categories={categories}
        loading={loading}
        onSubmit={handleSubmit}
        onClose={closeModal}
      />

      {/* 删除确认 / Delete confirm */}
      <ConfirmDialog
        open={confirmOpen}
        title="删除交易"
        message="确定删除此交易记录吗？此操作不可撤销。"
        variant="danger"
        confirmText="确认"
        cancelText="取消"
        onConfirm={handleDelete}
        onCancel={closeConfirm}
      />
    </div>
  );
}
