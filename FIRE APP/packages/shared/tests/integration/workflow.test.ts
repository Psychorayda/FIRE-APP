import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createDatabase, closeDatabase } from '../../src/db/connection.js';
import { initSchema } from '../../src/db/schema.js';
import { createUser } from '../../src/models/user.js';
import { seedCategories } from '../../src/models/category.js';
import { createAccount, getAccount, getNetWorth, getInvestableBalance } from '../../src/models/account.js';
import { createTransaction } from '../../src/services/transaction-service.js';
import { processRecurringTransactions } from '../../src/services/recurring-service.js';
import { generateMonthlySnapshot, getSnapshots } from '../../src/services/snapshot-service.js';
import { createScenario } from '../../src/models/scenario.js';
import { runProjection } from '../../src/services/fire-calc.js';
import { nowMs, addMonths } from '../../src/utils/time.js';
import type { Database as DatabaseType } from 'better-sqlite3';

describe('integration: FIRE APP 端到端工作流', () => {
  let db: DatabaseType;
  let userId: string;

  beforeEach(() => {
    db = createDatabase(':memory:');
    initSchema(db);
    userId = 'integration-user';
    createUser(db, { id: userId, display_name: '集成测试用户' });
    seedCategories(db, userId);
  });

  afterEach(() => { closeDatabase(db); });

  it('完整工作流: 建账 → 记账 → 快照 → FIRE计算', () => {
    // 1. 创建账户
    const checking = createAccount(db, {
      user_id: userId, name: '招商活期', asset_class: 'liquid', account_type: 'checking',
      initial_balance: 500000,
    });
    const fund = createAccount(db, {
      user_id: userId, name: '沪深300定投', asset_class: 'invested', account_type: 'fund',
      initial_balance: 200000,
    });
    const creditCard = createAccount(db, {
      user_id: userId, name: '信用卡', asset_class: 'liability', account_type: 'credit_card',
      initial_balance: -100000,
    });

    // 2. 验证初始余额
    expect(getAccount(db, checking.id)!.current_balance).toBe(500000);
    expect(getAccount(db, fund.id)!.current_balance).toBe(200000);
    expect(getAccount(db, creditCard.id)!.current_balance).toBe(-100000);

    // 3. 记录收入（种子分类已在 seedCategories 调用时创建）
    const incomeCat = db.prepare(
      "SELECT * FROM categories WHERE user_id = ? AND name = '工资薪金'"
    ).get(userId) as { id: string };
    const expenseCat = db.prepare(
      "SELECT * FROM categories WHERE user_id = ? AND name = '食品'"
    ).get(userId) as { id: string };

    createTransaction(db, {
      user_id: userId, account_id: checking.id, category_id: incomeCat.id,
      transaction_type: 'income', amount: 1500000, transaction_date: nowMs(),
    });

    // 4. 记录支出
    createTransaction(db, {
      user_id: userId, account_id: checking.id, category_id: expenseCat.id,
      transaction_type: 'expense', amount: 300000, transaction_date: nowMs(),
    });

    // 5. 转账定投
    createTransaction(db, {
      user_id: userId, account_id: checking.id, to_account_id: fund.id,
      transaction_type: 'transfer', amount: 500000, transaction_date: nowMs(),
    });

    // 6. 验证余额
    const checkingBalance = getAccount(db, checking.id)!.current_balance;
    const fundBalance = getAccount(db, fund.id)!.current_balance;
    expect(checkingBalance).toBe(1200000); // 500000 + 1500000 - 300000 - 500000
    expect(fundBalance).toBe(700000); // 200000 + 500000

    // 7. 验证净资产
    const netWorth = getNetWorth(db, userId);
    expect(netWorth).toBe(1800000); // 1200000 + 700000 + 0 - 100000

    // 8. 验证可投资资产
    const investable = getInvestableBalance(db, userId);
    expect(investable).toBe(1900000); // 1200000 + 700000

    // 9. 生成月度快照
    const snapshot = generateMonthlySnapshot(db, userId);
    expect(snapshot).not.toBeNull();
    expect(snapshot!.total_liquid).toBe(1200000);
    expect(snapshot!.total_invested).toBe(700000);
    expect(snapshot!.total_liability).toBe(-100000);
    expect(snapshot!.net_worth).toBe(1800000);

    // 10. 创建FIRE场景并计算
    const scenario = createScenario(db, {
      user_id: userId, name: '标准计划', current_age: 30, retirement_age: 50,
      auto_sync_assets: 1, monthly_savings: 500000, annual_expenses: 6000000,
      expected_return_rate: 700, withdrawal_rate: 350, post_retirement_monthly_income: 300000,
    });

    const result = runProjection(db, scenario);
    expect(result.fire_number).toBe(171428571); // 6000000 × (10000/350) floor
    expect(result.adjusted_fire_number).toBeLessThan(result.fire_number);
    expect(result.progress).toBeGreaterThan(0);
    expect(result.monthly_projection.length).toBe(600); // 240积累 + 360退休
  });

  it('经常性交易工作流: 创建模板 → 补生成 → 余额更新', () => {
    const checking = createAccount(db, {
      user_id: userId, name: '活期', asset_class: 'liquid', account_type: 'checking',
      initial_balance: 1000000,
    });
    const fund = createAccount(db, {
      user_id: userId, name: '基金', asset_class: 'invested', account_type: 'fund',
    });

    const incomeCat = db.prepare(
      "SELECT * FROM categories WHERE user_id = ? AND name = '工资薪金'"
    ).get(userId) as { id: string };

    const threeMonthsAgo = addMonths(nowMs(), -3);
    db.prepare(`
      INSERT INTO recurring_transactions (id, user_id, account_id, to_account_id, category_id,
        transaction_type, amount, frequency, interval, start_date, end_date, next_due_date,
        last_generated_date, description, is_active, auto_create, sync_version, updated_at, deleted_flag)
      VALUES ('recur1', ?, ?, ?, ?, 'income', 1000000, 'monthly', 1, ?, NULL, ?, NULL,
        '月工资', 1, 1, 0, ?, 0)
    `).run(userId, checking.id, null, incomeCat.id, threeMonthsAgo, threeMonthsAgo, nowMs());

    const generated = processRecurringTransactions(db, userId);
    expect(generated.length).toBeGreaterThanOrEqual(3);

    const balance = getAccount(db, checking.id)!.current_balance;
    expect(balance).toBe(1000000 + 1000000 * generated.length);
  });

  it('快照历史工作流: 多月快照按日期降序', () => {
    createAccount(db, {
      user_id: userId, name: '活期', asset_class: 'liquid', account_type: 'checking',
      initial_balance: 100000,
    });

    const months = ['2026-01', '2026-02', '2026-03'];
    months.forEach((ym, i) => {
      db.prepare(`
        INSERT INTO net_worth_snapshots (id, user_id, snapshot_date, snapshot_year_month,
          total_liquid, total_invested, total_use_asset, total_liability, net_worth,
          sync_version, updated_at, deleted_flag)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, 0)
      `).run(`snap-${ym}`, userId, (i + 1) * 1000000, ym, 100000, 0, 0, 0, 100000, (i + 1) * 1000000);
    });

    generateMonthlySnapshot(db, userId);

    const snapshots = getSnapshots(db, userId);
    expect(snapshots.length).toBe(4);
    expect(snapshots[0].snapshot_date).toBeGreaterThan(snapshots[1].snapshot_date);
  });
});
