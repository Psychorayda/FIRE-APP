// 交易记录页 / Transactions page
// 组合概览卡片、筛选、列表表格、表单弹窗、删除确认，完成交易 CRUD
// 服务端分页：筛选/分页下推到 SQL，前端只持有当前页
// Server-side pagination: filters/paging pushed to SQL, renderer holds current page only

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
  hasActiveFilters,
} from '../components/transactions/transaction-constants.js';

// 空筛选状态 / Empty filter state
const EMPTY_FILTERS: Filters = { type: '', account_id: '', category_id: '', dateFrom: '', dateTo: '' };
// 每页条数 / Page size
const PAGE_SIZE = 50;
// 一天毫秒数，用于 dateTo 含当天 / One day in ms, for dateTo inclusive
const ONE_DAY_MS = 86400000;

export function TransactionsPage() {
  const {
    pagedTransactions, total, loading, error,
    fetchTransactionPage, createTransaction, editTransaction, deleteTransaction,
  } = useTransactionStore();
  const { accounts, fetchAccounts } = useAccountStore();
  const { categories, fetchCategories } = useCategoryStore();
  const { currentUser } = useAppStore();
  const { showSuccess, showError } = useToastStore();

  const [page, setPage] = useState(0);
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create');
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Transaction | null>(null);

  const activeFilters = hasActiveFilters(filters);
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  // 当前页可见交易：服务端筛选后，category_id 由前端在当前页内过滤（SQL 未支持下推）
  // Visible transactions: server-filtered, category_id applied client-side on current page
  // (SQL does not support category filter push-down yet)
  const visibleTransactions = useMemo(() => {
    if (!filters.category_id) return pagedTransactions;
    return pagedTransactions.filter((t) => t.category_id === filters.category_id);
  }, [pagedTransactions, filters.category_id]);

  // 概览由 TransactionOverviewCards 内部基于 visibleTransactions 计算
  // Overview is computed inside TransactionOverviewCards from visibleTransactions

  // 拉取当前页交易、账户、分类
  // Fetch current page of transactions, accounts, categories
  useEffect(() => {
    if (!currentUser) return;
    fetchAccounts(currentUser.id);
    fetchCategories(currentUser.id);
  }, [currentUser, fetchAccounts, fetchCategories]);

  // 分页/筛选变化 → 服务端拉取
  // Pagination/filter change → server fetch
  useEffect(() => {
    if (!currentUser) return;
    fetchTransactionPage(currentUser.id, {
      limit: PAGE_SIZE,
      offset: page * PAGE_SIZE,
      type: (filters.type || undefined) as 'income' | 'expense' | 'transfer' | 'initial_balance' | undefined,
      accountId: filters.account_id || undefined,
      dateFrom: filters.dateFrom ? new Date(filters.dateFrom).getTime() : undefined,
      // dateTo 含当天：截止当日 23:59:59.999 / dateTo inclusive: end of day
      dateTo: filters.dateTo ? new Date(filters.dateTo).getTime() + ONE_DAY_MS - 1 : undefined,
    });
  }, [currentUser, page, filters, fetchTransactionPage]);

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

  // 筛选变化：重置到第一页 / Filter change: reset to first page
  const handleFiltersChange = (f: Filters) => {
    setPage(0);
    setFilters(f);
  };

  const handleResetFilters = () => {
    setPage(0);
    setFilters(EMPTY_FILTERS);
  };

  // 表单提交：create 调 createTransaction，edit 调 editTransaction
  // store 方法内部捕获错误并写入 state.error（不抛出），故用 getState().error 判定成功/失败
  const handleSubmit = async (input: CreateTransactionInput | EditTransactionInput) => {
    if (!currentUser) return;
    if (modalMode === 'create') {
      await createTransaction(currentUser.id, input as CreateTransactionInput);
    } else if (editingTransaction) {
      await editTransaction(currentUser.id, editingTransaction.id, input as EditTransactionInput);
    }
    if (!useTransactionStore.getState().error) {
      setModalOpen(false);
      showSuccess(modalMode === 'create' ? '交易创建成功' : '交易更新成功');
    }
  };

  const handleDelete = async () => {
    if (!currentUser || !deleteTarget) return;
    setConfirmOpen(false);
    await deleteTransaction(currentUser.id, deleteTarget.id);
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
        {/* 概览卡：基于当前页可见交易 */}
        {/* Overview cards: based on visible transactions of current page */}
        {visibleTransactions.length > 0 && (
          <TransactionOverviewCards transactions={visibleTransactions} />
        )}

        {/* 筛选 / Filters */}
        <TransactionFilters
          filters={filters}
          accounts={accounts}
          categories={categories}
          onFiltersChange={handleFiltersChange}
          onReset={handleResetFilters}
        />

        {/* 列表表格 / List table */}
        <TransactionListTable
          transactions={visibleTransactions}
          loading={loading}
          accounts={accounts}
          categories={categories}
          hasActiveFilters={activeFilters}
          onEdit={openEditModal}
          onDelete={openConfirm}
        />

        {/* 分页控件 / Pagination controls */}
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-500">共 {total} 条</span>
          <div className="flex items-center gap-3">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0 || loading}
            >
              上一页
            </Button>
            <span className="text-sm text-gray-600">
              第 {page + 1} / {totalPages} 页
            </span>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              disabled={page + 1 >= totalPages || loading}
            >
              下一页
            </Button>
          </div>
        </div>
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
