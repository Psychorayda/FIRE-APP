// 账户管理页 / Accounts page
// 组合概览卡片、列表表格、表单弹窗、删除确认，完成账户 CRUD

import { useEffect, useState } from 'react';
import type { Account } from '@shared/types/index.js';
import type { CreateAccountInput, EditAccountInput } from '@shared/models/account.js';
import { useAccountStore } from '../stores/account-store.js';
import { useAppStore } from '../stores/app-store.js';
import { useToastStore } from '../stores/toast-store.js';
import { PageHeader } from '../components/layout/PageHeader.js';
import { Button } from '../components/base/Button.js';
import { ConfirmDialog } from '../components/base/ConfirmDialog.js';
import { AccountOverviewCards } from '../components/accounts/AccountOverviewCards.js';
import { AccountListTable } from '../components/accounts/AccountListTable.js';
import { AccountFormModal } from '../components/accounts/AccountFormModal.js';

export function AccountsPage() {
  const { accounts, loading, error, fetchAccounts, createAccount, updateAccount, softDeleteAccount } = useAccountStore();
  const { currentUser } = useAppStore();
  const { showSuccess, showError } = useToastStore();

  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create');
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Account | null>(null);

  // 初始加载账户列表
  useEffect(() => {
    if (currentUser) fetchAccounts(currentUser.id);
  }, [currentUser, fetchAccounts]);

  // 监听 store error，自动弹出错误 Toast
  useEffect(() => {
    if (error) showError(error);
  }, [error, showError]);

  const openCreateModal = () => {
    setModalMode('create');
    setEditingAccount(null);
    setModalOpen(true);
  };

  const openEditModal = (account: Account) => {
    setModalMode('edit');
    setEditingAccount(account);
    setModalOpen(true);
  };

  const closeModal = () => setModalOpen(false);

  const openConfirm = (account: Account) => {
    setDeleteTarget(account);
    setConfirmOpen(true);
  };

  const closeConfirm = () => {
    setConfirmOpen(false);
    setDeleteTarget(null);
  };

  // 表单提交：create 调 createAccount，edit 调 updateAccount
  // store 方法内部捕获错误并写入 state.error（不抛出），故用 getState().error 判定成功/失败
  const handleSubmit = async (input: CreateAccountInput | EditAccountInput) => {
    if (!currentUser) return;
    if (modalMode === 'create') {
      await createAccount(input as CreateAccountInput, currentUser.id);
    } else if (editingAccount) {
      await updateAccount(editingAccount.id, input as EditAccountInput, currentUser.id);
    }
    if (!useAccountStore.getState().error) {
      setModalOpen(false);
      showSuccess(modalMode === 'create' ? '账户创建成功' : '账户更新成功');
    }
  };

  const handleDelete = async () => {
    if (!currentUser || !deleteTarget) return;
    const targetName = deleteTarget.name;
    setConfirmOpen(false);
    await softDeleteAccount(deleteTarget.id, currentUser.id);
    if (!useAccountStore.getState().error) {
      showSuccess(`账户「${targetName}」已删除`);
    }
    setDeleteTarget(null);
  };

  return (
    <div>
      <PageHeader
        title="账户管理"
        extra={<Button variant="primary" size="md" onClick={openCreateModal}>+ 新增账户</Button>}
      />
      <div className="p-8 space-y-6">
        {accounts.length > 0 && (
          <AccountOverviewCards accounts={accounts} />
        )}
        <AccountListTable
          accounts={accounts}
          loading={loading}
          onEdit={openEditModal}
          onDelete={openConfirm}
        />
      </div>
      <AccountFormModal
        open={modalOpen}
        mode={modalMode}
        account={editingAccount ?? undefined}
        userId={currentUser?.id}
        loading={loading}
        onSubmit={handleSubmit}
        onClose={closeModal}
      />
      <ConfirmDialog
        open={confirmOpen}
        title="删除账户"
        message={`确定删除账户「${deleteTarget?.name ?? ''}」吗？此操作不可撤销。`}
        variant="danger"
        confirmText="删除"
        cancelText="取消"
        onConfirm={handleDelete}
        onCancel={closeConfirm}
      />
    </div>
  );
}
