// IpcDataAccess: DataAccessPort 的 IPC 实现
// IpcDataAccess: IPC implementation of DataAccessPort

import type { DataAccessPort } from './data-access-port.js';
import type { CreateUserInput, UpdateUserInput } from '@shared/models/user.js';
import type { CreateAccountInput } from '@shared/models/account.js';
import type { CreateCategoryInput } from '@shared/models/category.js';
import type { CreateRecurringInput } from '@shared/models/recurring.js';
import type { CreateScenarioInput } from '@shared/models/scenario.js';
import type { CreateTransactionInput, EditTransactionInput } from '@shared/services/transaction-service.js';
import type {
  User, Account, Category, Transaction, RecurringTransaction,
  NetWorthSnapshot, FireScenario, CategoryType,
} from '@shared/types/index.js';
import type { ProjectionResult } from '@shared/services/fire-calc.js';

/**
 * DataAccessPort 的 IPC 实现
 * IPC implementation of DataAccessPort
 * 所有方法通过 window.dataAccess 调用 preload 暴露的 IPC 通道
 */
export class IpcDataAccess implements DataAccessPort {
  // ===== 数据库管理 =====
  initDatabase() { return window.dataAccess.initDatabase(); }
  closeDatabase() { return window.dataAccess.closeDatabase(); }

  // ===== User =====
  createUser(input: CreateUserInput) { return window.dataAccess.user.create(input); }
  getUser(id: string) { return window.dataAccess.user.get(id); }
  updateUser(id: string, input: UpdateUserInput) { return window.dataAccess.user.update(id, input); }
  getFirstUser() { return window.dataAccess.user.getFirst(); }

  // ===== Account =====
  createAccount(input: CreateAccountInput) { return window.dataAccess.account.create(input); }
  getAccount(id: string) { return window.dataAccess.account.get(id); }
  getAccounts(userId: string) { return window.dataAccess.account.list(userId); }
  updateAccountBalance(id: string, newBalance: number) { return window.dataAccess.account.updateBalance(id, newBalance); }
  getInvestableBalance(userId: string) { return window.dataAccess.account.investableBalance(userId); }
  getNetWorth(userId: string) { return window.dataAccess.account.netWorth(userId); }
  hasTransactions(accountId: string) { return window.dataAccess.account.hasTransactions(accountId); }
  softDeleteAccount(id: string) { return window.dataAccess.account.softDelete(id); }

  // ===== Category =====
  createCategory(input: CreateCategoryInput) { return window.dataAccess.category.create(input); }
  getCategory(id: string) { return window.dataAccess.category.get(id); }
  getCategories(userId: string, type?: CategoryType) { return window.dataAccess.category.list(userId, type); }
  seedCategories(userId: string) { return window.dataAccess.category.seed(userId); }

  // ===== Transaction =====
  getTransaction(id: string) { return window.dataAccess.tx.get(id); }
  getTransactionById(id: string) { return window.dataAccess.tx.getById(id); }
  getTransactionsByUser(userId: string) { return window.dataAccess.tx.listByUser(userId); }
  createTransaction(input: CreateTransactionInput) { return window.dataAccess.tx.create(input); }
  editTransaction(id: string, input: EditTransactionInput) { return window.dataAccess.tx.edit(id, input); }
  deleteTransaction(id: string) { return window.dataAccess.tx.delete(id); }

  // ===== Recurring =====
  createRecurring(input: CreateRecurringInput) { return window.dataAccess.recurring.create(input); }
  getActiveRecurring(userId: string) { return window.dataAccess.recurring.listActive(userId); }
  updateRecurring(id: string, updates: Partial<RecurringTransaction>) { return window.dataAccess.recurring.update(id, updates); }
  processRecurringTransactions(userId: string) { return window.dataAccess.recurring.process(userId); }

  // ===== Scenario =====
  createScenario(input: CreateScenarioInput) { return window.dataAccess.scenario.create(input); }
  getScenario(id: string) { return window.dataAccess.scenario.get(id); }
  getScenarios(userId: string) { return window.dataAccess.scenario.list(userId); }
  updateScenario(id: string, updates: Partial<FireScenario>) { return window.dataAccess.scenario.update(id, updates); }

  // ===== Snapshot =====
  getSnapshots(userId: string) { return window.dataAccess.snapshot.list(userId); }
  getSnapshotByMonth(userId: string, yearMonth: string) { return window.dataAccess.snapshot.getByMonth(userId, yearMonth); }
  generateMonthlySnapshot(userId: string) { return window.dataAccess.snapshot.generateMonthly(userId); }

  // ===== FireCalc =====
  runProjection(scenario: FireScenario) { return window.dataAccess.fireCalc.runProjection(scenario); }
}
