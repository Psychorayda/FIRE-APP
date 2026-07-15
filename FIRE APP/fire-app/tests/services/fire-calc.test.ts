import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createDatabase, closeDatabase } from '../../src/db/connection.js';
import { initSchema } from '../../src/db/schema.js';
import { createUser } from '../../src/models/user.js';
import { createAccount } from '../../src/models/account.js';
import { createScenario, getScenario, getScenarios } from '../../src/models/scenario.js';
import {
  calculateFireNumber,
  calculateAdjustedFireNumber,
  calculateAccumulation,
  calculateProgress,
  runProjection,
} from '../../src/services/fire-calc.js';
import type { Database as DatabaseType } from 'better-sqlite3';

describe('fire calculation engine', () => {
  let db: DatabaseType;
  let userId: string;

  beforeEach(() => {
    db = createDatabase(':memory:');
    initSchema(db);
    userId = 'test-user-id';
    createUser(db, { id: userId, display_name: '测试' });
  });

  afterEach(() => { closeDatabase(db); });

  it('calculateFireNumber: 年支出50000 × 3.5% → ~1428571', () => {
    const fireNumber = calculateFireNumber(5000000, 350);
    expect(fireNumber).toBe(142857142);
  });

  it('calculateFireNumber: 年支出50000 × 4% → 1250000', () => {
    const fireNumber = calculateFireNumber(5000000, 400);
    expect(fireNumber).toBe(125000000);
  });

  it('calculateAdjustedFireNumber: 扣除退休后月收入3000的抵减', () => {
    const adjusted = calculateAdjustedFireNumber(5000000, 350, 300000);
    expect(adjusted).toBe(40000000);
  });

  it('calculateAdjustedFireNumber: 无退休后收入 → 等于基础FIRE Number', () => {
    const adjusted = calculateAdjustedFireNumber(5000000, 350, 0);
    expect(adjusted).toBe(142857142);
  });

  it('calculateAccumulation: PV=500000 + PMT=3000/月, 10年, 5%年化', () => {
    const fv = calculateAccumulation(50000000, 300000, 500, 120);
    expect(fv).toBeGreaterThan(128000000);
    expect(fv).toBeLessThan(130000000);
  });

  it('calculateAccumulation: PV=0, 纯定投', () => {
    const fv = calculateAccumulation(0, 300000, 700, 120);
    expect(fv).toBeGreaterThan(50000000);
    expect(fv).toBeLessThan(55000000);
  });

  it('calculateProgress: 当前50万 / FIRE目标142.8万 → ~35%', () => {
    const progress = calculateProgress(50000000, 142857142);
    expect(progress).toBeCloseTo(35.0, 0);
  });

  it('calculateProgress: 已达成 → 100%', () => {
    const progress = calculateProgress(150000000, 142857142);
    expect(progress).toBe(100);
  });

  it('runProjection: 完整FIRE投影', () => {
    const scenario = createScenario(db, {
      user_id: userId, name: '标准计划', current_age: 30, retirement_age: 50,
      current_portfolio_value: 50000000, auto_sync_assets: 0,
      monthly_savings: 300000, annual_expenses: 5000000,
      expected_return_rate: 700, withdrawal_rate: 350, post_retirement_monthly_income: 0,
    });
    const result = runProjection(db, scenario);
    expect(result.fire_number).toBe(142857142);
    expect(result.adjusted_fire_number).toBe(142857142);
    expect(result.retirement_portfolio).toBeGreaterThan(0);
    expect(result.progress).toBeGreaterThan(0);
    expect(result.progress).toBeLessThan(100);
    expect(result.monthly_projection).toBeDefined();
    expect(result.monthly_projection.length).toBe(600); // 240积累 + 360退休
  });

  it('runProjection: auto_sync_assets=1 → 从accounts汇总', () => {
    createAccount(db, { user_id: userId, name: '活期', asset_class: 'liquid', account_type: 'checking', initial_balance: 100000 });
    createAccount(db, { user_id: userId, name: '基金', asset_class: 'invested', account_type: 'fund', initial_balance: 400000 });
    const scenario = createScenario(db, {
      user_id: userId, name: '自动同步', current_age: 35, retirement_age: 55,
      current_portfolio_value: 0, auto_sync_assets: 1, monthly_savings: 500000,
      annual_expenses: 6000000, expected_return_rate: 700, withdrawal_rate: 350,
    });
    const result = runProjection(db, scenario);
    expect(result.monthly_projection[0].balance).toBeGreaterThanOrEqual(500000);
  });

  it('runProjection: 退休后收入抵减FIRE Number', () => {
    const scenario = createScenario(db, {
      user_id: userId, name: '有养老金', current_age: 40, retirement_age: 55,
      current_portfolio_value: 100000000, monthly_savings: 200000, annual_expenses: 5000000,
      expected_return_rate: 700, withdrawal_rate: 350, post_retirement_monthly_income: 300000,
    });
    const result = runProjection(db, scenario);
    expect(result.adjusted_fire_number).toBeLessThan(result.fire_number);
  });

  it('getScenarios: 返回用户所有场景', () => {
    createScenario(db, { user_id: userId, name: '保守', current_age: 30, retirement_age: 55, annual_expenses: 4000000, expected_return_rate: 500, withdrawal_rate: 300 });
    createScenario(db, { user_id: userId, name: '标准', current_age: 30, retirement_age: 50, annual_expenses: 5000000, expected_return_rate: 700, withdrawal_rate: 350 });
    const scenarios = getScenarios(db, userId);
    expect(scenarios).toHaveLength(2);
  });

  it('getScenario: 读取单个场景', () => {
    const created = createScenario(db, { user_id: userId, name: '测试', current_age: 30, retirement_age: 50, annual_expenses: 5000000, expected_return_rate: 700, withdrawal_rate: 350 });
    const scenario = getScenario(db, created.id);
    expect(scenario).not.toBeNull();
    expect(scenario!.name).toBe('测试');
  });
});
