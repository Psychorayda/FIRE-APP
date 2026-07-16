// DataAccessPort 接口：渲染进程的数据访问抽象层
// DataAccessPort interface: data access abstraction for the renderer process
// 桌面端通过 IPC 实现，移动端可通过 react-native-quick-sqlite 实现

import type {
  User, Account, Category, Transaction, RecurringTransaction,
  NetWorthSnapshot, FireScenario, CategoryType,
} from '@shared/types/index.js';
import type { CreateUserInput, UpdateUserInput } from '@shared/models/user.js';
import type { CreateAccountInput, EditAccountInput } from '@shared/models/account.js';
import type { CreateCategoryInput } from '@shared/models/category.js';
import type { CreateRecurringInput } from '@shared/models/recurring.js';
import type { CreateScenarioInput } from '@shared/models/scenario.js';
import type { CreateTransactionInput, EditTransactionInput } from '@shared/services/transaction-service.js';
import type { ProjectionResult } from '@shared/services/fire-calc.js';

/**
 * 数据访问端口接口
 * Data access port interface
 *
 * 渲染进程通过此接口访问所有数据操作。
 * 桌面端使用 IpcDataAccess 实现（通过 IPC 调用主进程）。
 * 移动端预留使用 QuickSqliteDataAccess 实现（直接操作本地 SQLite）。
 */
export interface DataAccessPort {
  // ===== 数据库管理 / Database management =====
  initDatabase(): Promise<void>;
  closeDatabase(): Promise<void>;

  // ===== User =====
  createUser(input: CreateUserInput): Promise<User>;
  getUser(id: string): Promise<User | null>;
  updateUser(id: string, input: UpdateUserInput): Promise<User>;
  getFirstUser(): Promise<User | null>;

  // ===== Account =====
  createAccount(input: CreateAccountInput): Promise<Account>;
  getAccount(id: string): Promise<Account | null>;
  getAccounts(userId: string): Promise<Account[]>;
  updateAccount(id: string, input: EditAccountInput): Promise<Account>;
  updateAccountBalance(id: string, newBalance: number): Promise<void>;
  getInvestableBalance(userId: string): Promise<number>;
  getNetWorth(userId: string): Promise<number>;
  hasTransactions(accountId: string): Promise<boolean>;
  softDeleteAccount(id: string): Promise<void>;

  // ===== Category =====
  createCategory(input: CreateCategoryInput): Promise<Category>;
  getCategory(id: string): Promise<Category | null>;
  getCategories(userId: string, type?: CategoryType): Promise<Category[]>;
  seedCategories(userId: string): Promise<void>;

  // ===== Transaction =====
  getTransaction(id: string): Promise<Transaction | null>;
  getTransactionById(id: string): Promise<Transaction | null>;
  getTransactionsByUser(userId: string): Promise<Transaction[]>;
  createTransaction(input: CreateTransactionInput): Promise<Transaction>;
  editTransaction(id: string, input: EditTransactionInput): Promise<Transaction>;
  deleteTransaction(id: string): Promise<void>;

  // ===== Recurring Transaction =====
  createRecurring(input: CreateRecurringInput): Promise<RecurringTransaction>;
  getActiveRecurring(userId: string): Promise<RecurringTransaction[]>;
  updateRecurring(id: string, updates: Partial<RecurringTransaction>): Promise<void>;
  processRecurringTransactions(userId: string): Promise<Transaction[]>;

  // ===== Scenario =====
  createScenario(input: CreateScenarioInput): Promise<FireScenario>;
  getScenario(id: string): Promise<FireScenario | null>;
  getScenarios(userId: string): Promise<FireScenario[]>;
  updateScenario(id: string, updates: Partial<FireScenario>): Promise<FireScenario>;

  // ===== Snapshot =====
  getSnapshots(userId: string): Promise<NetWorthSnapshot[]>;
  getSnapshotByMonth(userId: string, yearMonth: string): Promise<NetWorthSnapshot | null>;
  generateMonthlySnapshot(userId: string): Promise<NetWorthSnapshot | null>;

  // ===== FireCalc =====
  runProjection(scenario: FireScenario): Promise<ProjectionResult>;
}
