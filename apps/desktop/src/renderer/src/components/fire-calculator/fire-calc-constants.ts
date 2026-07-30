// FIRE 计算器纯函数与类型 / FIRE calculator pure functions and types
// 默认值生成、字段校验、基点/百分比转换、金额格式化、投影数据格式化
// 全部无副作用，易于单元测试

import type { User, FireScenario } from '@shared/types/index.js';
import type { CreateScenarioInput } from '@shared/models/scenario.js';
import type { MonthlyProjectionPoint } from '@shared/services/fire-calc.js';
import { centsToYuan } from '@shared/utils/money.js';
import { CURRENCY_SYMBOLS, CURRENCY_LOCALES } from '../transactions/transaction-constants.js';

// ============= 单位转换 =============

/** 基点 → 百分比（350 → 3.5） */
// basis points → percent (350 → 3.5)
export function basisPointsToPercent(bp: number): number {
  return bp / 100;
}

/** 百分比 → 基点（3.5 → 350） */
// percent → basis points (3.5 → 350)
export function percentToBasisPoints(percent: number): number {
  return Math.round(percent * 100);
}

// ============= 格式化 =============

/** 分 → 元 → 货币字符串（默认 CNY，可按 base_currency 切换 ¥ / $） */
// cents → yuan → currency string (defaults to CNY; switches ¥ / $ per base_currency)
export function formatFireAmount(cents: number, currency: string = 'CNY'): string {
  const symbol = CURRENCY_SYMBOLS[currency] ?? '¥';
  const locale = CURRENCY_LOCALES[currency] ?? 'zh-CN';
  const yuan = centsToYuan(cents);
  const formatted = new Intl.NumberFormat(locale, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Math.abs(yuan));
  return yuan < 0 ? `-${symbol}${formatted}` : `${symbol}${formatted}`;
}

/** 进度格式化（66.7 → '66.7%'） */
// progress format (66.7 → '66.7%')
export function formatProgress(percent: number): string {
  return `${percent}%`;
}

// ============= 默认值生成 =============

/** 从 User 表默认偏好生成场景输入 */
// Generate scenario input from User table defaults
export function createDefaultScenarioInput(user: User, name: string): CreateScenarioInput {
  return {
    user_id: user.id,
    name,
    description: null,
    current_age: 30,
    retirement_age: 55,
    current_portfolio_value: 0,
    auto_sync_assets: 1,
    monthly_savings: 0,
    annual_expenses: 60000 * 100, // 6 万元/年，转分 / 60k yuan/year → cents
    expected_return_rate: user.default_expected_return,
    inflation_rate: user.default_inflation_rate,
    withdrawal_rate: user.default_withdrawal_rate,
    retirement_years: 30,
    post_retirement_monthly_income: 0,
    is_china_market: user.is_china_market,
  };
}

// ============= 校验 =============

/**
 * 字段校验：返回错误信息，空字符串表示通过
 * retirement_age 校验需 current_age 上下文，通过 context 参数传入
 *
 * Field validation: returns error message, empty string means pass.
 * retirement_age validation needs current_age context via context param.
 */
export function validateScenarioField(
  field: keyof FireScenario,
  value: unknown,
  context?: Partial<Pick<FireScenario, 'current_age'>>
): string {
  const n = typeof value === 'number' ? value : Number(value);
  switch (field) {
    case 'name': {
      const s = typeof value === 'string' ? value : String(value ?? '');
      const trimmed = s.trim();
      if (trimmed.length < 1 || trimmed.length > 50) return '场景名称需在 1-50 字符之间';
      return '';
    }
    case 'current_age':
      if (!Number.isInteger(n) || n < 18 || n > 80) return '当前年龄需在 18-80 之间';
      return '';
    case 'retirement_age': {
      const currentAge = context?.current_age ?? 0;
      if (!Number.isInteger(n) || n <= currentAge || n > 80) return '退休年龄需大于当前年龄且不超过 80';
      return '';
    }
    case 'annual_expenses':
      if (!(n > 0)) return '年度支出需大于 0';
      return '';
    case 'expected_return_rate':
      if (n < 100 || n > 1500) return '预期回报率需在 1%-15% 之间';
      return '';
    case 'inflation_rate':
      if (n < 0 || n > 1000) return '通胀率需在 0%-10% 之间';
      return '';
    case 'withdrawal_rate':
      if (n < 200 || n > 600) return '提现率需在 2%-6% 之间';
      return '';
    case 'retirement_years':
      if (!Number.isInteger(n) || n < 10 || n > 50) return '退休后年限需在 10-50 之间';
      return '';
    case 'monthly_savings':
      if (n < 0) return '每月储蓄不能为负';
      return '';
    case 'post_retirement_monthly_income':
      if (n < 0) return '退休后月收入不能为负';
      return '';
    default:
      return '';
  }
}

// ============= 投影数据格式化 =============

/** 投影图表数据点（Recharts AreaChart 格式） */
// Projection chart data point (Recharts AreaChart format)
export interface ProjectionChartPoint {
  age: number;          // 年龄（保留 2 位小数）
  balance: number;      // 余额（元）
  phase: 'accumulation' | 'retirement';
  fireNumber: number;   // FIRE Number 参考线（元，每点相同）
}

/** MonthlyProjectionPoint[] → ProjectionChartPoint[]（分→元，注入 fireNumber） */
// Convert projection points to chart format (cents→yuan, inject fireNumber)
export function formatProjectionForChart(
  projection: MonthlyProjectionPoint[],
  fireNumber: number
): ProjectionChartPoint[] {
  const fireNumberYuan = centsToYuan(fireNumber);
  return projection.map((p) => ({
    age: Math.round(p.age * 100) / 100,
    balance: centsToYuan(p.balance),
    phase: p.phase,
    fireNumber: fireNumberYuan,
  }));
}

// ============= 常量 =============

/** 中国市场提现率建议 */
// China market withdrawal rate hint
export const CHINA_WITHDRAWAL_RATE_HINT = '中国市场建议提现率 3.0%-3.5%';

/** 表单字段分组配置 */
// Form field group config
export type FormFieldType = 'text' | 'number' | 'amount' | 'percent' | 'toggle';

export interface FormFieldConfig {
  key: keyof FireScenario;
  label: string;
  type: FormFieldType;
  required?: boolean;
  min?: number;
  max?: number;
  step?: number;
  hint?: string;
}

export interface FormFieldGroup {
  title: string;
  fields: ReadonlyArray<FormFieldConfig>;
}

export const FORM_FIELD_GROUPS: ReadonlyArray<FormFieldGroup> = [
  {
    title: '基本参数',
    fields: [
      { key: 'name', label: '场景名称', type: 'text', required: true },
      { key: 'current_age', label: '当前年龄', type: 'number', required: true, min: 18, max: 80 },
      { key: 'retirement_age', label: '退休年龄', type: 'number', required: true, min: 18, max: 80 },
      { key: 'retirement_years', label: '退休后年限', type: 'number', required: true, min: 10, max: 50 },
      { key: 'annual_expenses', label: '年度支出', type: 'amount', required: true },
      { key: 'post_retirement_monthly_income', label: '退休后月收入', type: 'amount' },
    ],
  },
  {
    title: '投资参数',
    fields: [
      { key: 'auto_sync_assets', label: '自动同步资产', type: 'toggle' },
      { key: 'current_portfolio_value', label: '当前组合值', type: 'amount' },
      { key: 'monthly_savings', label: '每月储蓄', type: 'amount' },
      { key: 'expected_return_rate', label: '预期回报率', type: 'percent', required: true, min: 1, max: 15, step: 0.1 },
      { key: 'inflation_rate', label: '通胀率', type: 'percent', required: true, min: 0, max: 10, step: 0.1 },
      { key: 'withdrawal_rate', label: '提现率', type: 'percent', required: true, min: 2, max: 6, step: 0.1 },
    ],
  },
];
