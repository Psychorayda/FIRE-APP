import type { Database as DatabaseType } from 'better-sqlite3';
import { v4 as uuidv4 } from 'uuid';
import { nowMs } from '../utils/time.js';
import type { FireScenario } from '../types/index.js';

export interface CreateScenarioInput {
  user_id: string; name: string; description?: string | null;
  current_age: number; retirement_age: number;
  current_portfolio_value?: number; auto_sync_assets?: number;
  monthly_savings?: number; annual_expenses: number;
  expected_return_rate: number; inflation_rate?: number;
  withdrawal_rate: number; retirement_years?: number;
  post_retirement_monthly_income?: number; is_china_market?: number;
}

export function createScenario(db: DatabaseType, input: CreateScenarioInput): FireScenario {
  const id = uuidv4();
  const now = nowMs();
  const scenario: FireScenario = {
    id, user_id: input.user_id, name: input.name, description: input.description ?? null,
    current_age: input.current_age, retirement_age: input.retirement_age,
    current_portfolio_value: input.current_portfolio_value ?? 0,
    auto_sync_assets: input.auto_sync_assets ?? 1,
    monthly_savings: input.monthly_savings ?? 0,
    annual_expenses: input.annual_expenses,
    expected_return_rate: input.expected_return_rate,
    inflation_rate: input.inflation_rate ?? 300,
    withdrawal_rate: input.withdrawal_rate,
    retirement_years: input.retirement_years ?? 30,
    post_retirement_monthly_income: input.post_retirement_monthly_income ?? 0,
    is_china_market: input.is_china_market ?? 1, is_active: 1,
    sync_version: 0, updated_at: now, deleted_flag: 0,
  };
  db.prepare(`INSERT INTO fire_scenarios (id, user_id, name, description, current_age, retirement_age, current_portfolio_value, auto_sync_assets, monthly_savings, annual_expenses, expected_return_rate, inflation_rate, withdrawal_rate, retirement_years, post_retirement_monthly_income, is_china_market, is_active, sync_version, updated_at, deleted_flag) VALUES (@id, @user_id, @name, @description, @current_age, @retirement_age, @current_portfolio_value, @auto_sync_assets, @monthly_savings, @annual_expenses, @expected_return_rate, @inflation_rate, @withdrawal_rate, @retirement_years, @post_retirement_monthly_income, @is_china_market, @is_active, @sync_version, @updated_at, @deleted_flag)`).run(scenario);
  return scenario;
}

export function getScenario(db: DatabaseType, id: string): FireScenario | null {
  const row = db.prepare('SELECT * FROM fire_scenarios WHERE id = ? AND deleted_flag = 0').get(id) as FireScenario | undefined;
  return row ?? null;
}

export function getScenarios(db: DatabaseType, userId: string): FireScenario[] {
  return db.prepare('SELECT * FROM fire_scenarios WHERE user_id = ? AND deleted_flag = 0 ORDER BY updated_at DESC').all(userId) as FireScenario[];
}

export function updateScenario(db: DatabaseType, id: string, updates: Partial<FireScenario>): FireScenario {
  const current = getScenario(db, id);
  if (!current) { throw new Error(`Scenario not found: ${id}`); }
  const updated: FireScenario = { ...current, ...updates, id: current.id, user_id: current.user_id, sync_version: current.sync_version + 1, updated_at: nowMs() };
  db.prepare(`UPDATE fire_scenarios SET name = @name, description = @description, current_age = @current_age, retirement_age = @retirement_age, current_portfolio_value = @current_portfolio_value, auto_sync_assets = @auto_sync_assets, monthly_savings = @monthly_savings, annual_expenses = @annual_expenses, expected_return_rate = @expected_return_rate, inflation_rate = @inflation_rate, withdrawal_rate = @withdrawal_rate, retirement_years = @retirement_years, post_retirement_monthly_income = @post_retirement_monthly_income, is_china_market = @is_china_market, is_active = @is_active, sync_version = @sync_version, updated_at = @updated_at WHERE id = @id`).run(updated);
  return updated;
}
