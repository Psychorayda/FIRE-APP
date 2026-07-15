import type { Database as DatabaseType } from 'better-sqlite3';
import { basisPointsToDecimal } from '../utils/money.js';
import { getInvestableBalance } from '../models/account.js';
import type { FireScenario } from '../types/index.js';

export interface MonthlyProjectionPoint {
  month: number; age: number; balance: number; contribution: number;
  growth: number; cumulative_contribution: number; cumulative_growth: number;
  phase: 'accumulation' | 'retirement';
}

export interface ProjectionResult {
  fire_number: number; adjusted_fire_number: number;
  retirement_portfolio: number; progress: number;
  monthly_projection: MonthlyProjectionPoint[];
}

export function calculateFireNumber(annualExpenses: number, withdrawalRateBp: number): number {
  return Math.floor(annualExpenses * (10000 / withdrawalRateBp));
}

export function calculateAdjustedFireNumber(annualExpenses: number, withdrawalRateBp: number, postRetirementMonthlyIncome: number): number {
  const baseFireNumber = calculateFireNumber(annualExpenses, withdrawalRateBp);
  if (postRetirementMonthlyIncome === 0) { return baseFireNumber; }
  const annualOtherIncome = postRetirementMonthlyIncome * 12;
  const deduction = Math.floor(annualOtherIncome / (withdrawalRateBp / 10000));
  return Math.max(0, baseFireNumber - deduction);
}

export function calculateAccumulation(pv: number, pmt: number, annualReturnBp: number, months: number): number {
  const r = basisPointsToDecimal(annualReturnBp) / 12;
  if (r === 0) { return pv + pmt * months; }
  const growthFactor = Math.pow(1 + r, months);
  const fv = pv * growthFactor + pmt * ((growthFactor - 1) / r);
  return Math.round(fv);
}

export function calculateProgress(currentValue: number, fireNumber: number): number {
  if (fireNumber <= 0) return 0;
  return Math.min(100, Math.round((currentValue / fireNumber) * 1000) / 10);
}

export function runProjection(db: DatabaseType, scenario: FireScenario): ProjectionResult {
  let currentValue = scenario.current_portfolio_value;
  if (scenario.auto_sync_assets === 1) {
    currentValue = getInvestableBalance(db, scenario.user_id);
  }

  const fireNumber = calculateFireNumber(scenario.annual_expenses, scenario.withdrawal_rate);
  const adjustedFireNumber = calculateAdjustedFireNumber(scenario.annual_expenses, scenario.withdrawal_rate, scenario.post_retirement_monthly_income);
  const accumulationMonths = (scenario.retirement_age - scenario.current_age) * 12;

  const monthlyProjection: MonthlyProjectionPoint[] = [];
  let balance = currentValue;
  let cumulativeContribution = 0;
  let cumulativeGrowth = 0;
  const monthlyReturnRate = basisPointsToDecimal(scenario.expected_return_rate) / 12;

  // 积累阶段
  for (let m = 0; m < accumulationMonths; m++) {
    const monthGrowth = Math.round(balance * monthlyReturnRate);
    balance += monthGrowth + scenario.monthly_savings;
    cumulativeContribution += scenario.monthly_savings;
    cumulativeGrowth += monthGrowth;
    monthlyProjection.push({
      month: m + 1, age: scenario.current_age + (m + 1) / 12, balance,
      contribution: scenario.monthly_savings, growth: monthGrowth,
      cumulative_contribution: cumulativeContribution, cumulative_growth: cumulativeGrowth,
      phase: 'accumulation',
    });
  }

  const retirementPortfolio = balance;

  // 提现阶段
  const retirementMonths = scenario.retirement_years * 12;
  const monthlyWithdrawal = Math.round(scenario.annual_expenses / 12);
  const monthlyOtherIncome = scenario.post_retirement_monthly_income;
  const monthlyInflation = basisPointsToDecimal(scenario.inflation_rate) / 12;
  let currentWithdrawal = monthlyWithdrawal;

  for (let m = 0; m < retirementMonths; m++) {
    const monthGrowth = Math.round(balance * monthlyReturnRate);
    const netWithdrawal = Math.max(0, currentWithdrawal - monthlyOtherIncome);
    balance += monthGrowth - netWithdrawal;
    if (balance < 0) balance = 0;
    cumulativeGrowth += monthGrowth;
    monthlyProjection.push({
      month: accumulationMonths + m + 1, age: scenario.retirement_age + (m + 1) / 12,
      balance, contribution: 0, growth: monthGrowth,
      cumulative_contribution: cumulativeContribution, cumulative_growth: cumulativeGrowth,
      phase: 'retirement',
    });
    currentWithdrawal = Math.round(currentWithdrawal * (1 + monthlyInflation));
  }

  const progress = calculateProgress(currentValue, adjustedFireNumber);
  return { fire_number: fireNumber, adjusted_fire_number: adjustedFireNumber, retirement_portfolio: retirementPortfolio, progress, monthly_projection: monthlyProjection };
}
