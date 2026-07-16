// 渲染进程 IPC 类型声明 / Renderer IPC type declarations
// 声明 window.dataAccess 的类型，供渲染进程使用

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

export interface DataAccessAPI {
  // 数据库管理 / Database
  initDatabase(): Promise<void>;
  closeDatabase(): Promise<void>;

  // 用户 / User
  user: {
    create(input: CreateUserInput): Promise<User>;
    get(id: string): Promise<User | null>;
    update(id: string, input: UpdateUserInput): Promise<User>;
    getFirst(): Promise<User | null>;
  };

  // 账户 / Account
  account: {
    create(input: CreateAccountInput): Promise<Account>;
    get(id: string): Promise<Account | null>;
    list(userId: string): Promise<Account[]>;
    update(id: string, input: EditAccountInput): Promise<Account>;
    updateBalance(id: string, newBalance: number): Promise<void>;
    investableBalance(userId: string): Promise<number>;
    netWorth(userId: string): Promise<number>;
    hasTransactions(accountId: string): Promise<boolean>;
    softDelete(id: string): Promise<void>;
  };

  // 分类 / Category
  category: {
    create(input: CreateCategoryInput): Promise<Category>;
    get(id: string): Promise<Category | null>;
    list(userId: string, type?: CategoryType): Promise<Category[]>;
    seed(userId: string): Promise<void>;
  };

  // 交易 / Transaction
  tx: {
    get(id: string): Promise<Transaction | null>;
    getById(id: string): Promise<Transaction | null>;
    listByUser(userId: string): Promise<Transaction[]>;
    create(input: CreateTransactionInput): Promise<Transaction>;
    edit(id: string, input: EditTransactionInput): Promise<Transaction>;
    delete(id: string): Promise<void>;
  };

  // 经常性交易 / Recurring
  recurring: {
    create(input: CreateRecurringInput): Promise<RecurringTransaction>;
    listActive(userId: string): Promise<RecurringTransaction[]>;
    update(id: string, updates: Partial<RecurringTransaction>): Promise<void>;
    process(userId: string): Promise<Transaction[]>;
  };

  // 场景 / Scenario
  scenario: {
    create(input: CreateScenarioInput): Promise<FireScenario>;
    get(id: string): Promise<FireScenario | null>;
    list(userId: string): Promise<FireScenario[]>;
    update(id: string, updates: Partial<FireScenario>): Promise<FireScenario>;
  };

  // 快照 / Snapshot
  snapshot: {
    list(userId: string): Promise<NetWorthSnapshot[]>;
    getByMonth(userId: string, yearMonth: string): Promise<NetWorthSnapshot | null>;
    generateMonthly(userId: string): Promise<NetWorthSnapshot | null>;
  };

  // FIRE 计算 / FireCalc
  fireCalc: {
    runProjection(scenario: FireScenario): Promise<ProjectionResult>;
  };
}

declare global {
  interface Window {
    dataAccess: DataAccessAPI;
  }
}
