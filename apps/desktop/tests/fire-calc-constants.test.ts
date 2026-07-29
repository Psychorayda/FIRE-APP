// FIRE 计算器纯函数测试 / FIRE calculator pure function tests

import { describe, it, expect } from 'vitest';
import type { User, FireScenario } from '@shared/types/index.js';
import type { MonthlyProjectionPoint } from '@shared/services/fire-calc.js';
import {
  createDefaultScenarioInput,
  validateScenarioField,
  basisPointsToPercent,
  percentToBasisPoints,
  formatFireAmount,
  formatProgress,
  formatProjectionForChart,
  FORM_FIELD_GROUPS,
  CHINA_WITHDRAWAL_RATE_HINT,
} from '@renderer/components/fire-calculator/fire-calc-constants.js';

function makeUser(overrides: Partial<User>): User {
  return {
    id: 'user-1',
    display_name: 'test',
    base_currency: 'CNY',
    is_china_market: 1,
    default_withdrawal_rate: 350,
    default_expected_return: 700,
    default_inflation_rate: 300,
    encryption_key_hash: null,
    last_sync_at: null,
    sync_version: 0,
    updated_at: 0,
    deleted_flag: 0,
    ...overrides,
  };
}

describe('basisPointsToPercent', () => {
  it('350 基点 → 3.5%', () => {
    expect(basisPointsToPercent(350)).toBe(3.5);
  });
  it('400 基点 → 4%', () => {
    expect(basisPointsToPercent(400)).toBe(4);
  });
  it('0 基点 → 0%', () => {
    expect(basisPointsToPercent(0)).toBe(0);
  });
});

describe('percentToBasisPoints', () => {
  it('3.5% → 350 基点', () => {
    expect(percentToBasisPoints(3.5)).toBe(350);
  });
  it('4% → 400 基点', () => {
    expect(percentToBasisPoints(4)).toBe(400);
  });
  it('往返转换一致', () => {
    expect(percentToBasisPoints(basisPointsToPercent(550))).toBe(550);
  });
});

describe('formatFireAmount', () => {
  it('分转元并格式化为人民币', () => {
    expect(formatFireAmount(171428600)).toBe('¥1,714,286.00');
  });
  it('0 分', () => {
    expect(formatFireAmount(0)).toBe('¥0.00');
  });
});

describe('formatProgress', () => {
  it('66.7 → 66.7%', () => {
    expect(formatProgress(66.7)).toBe('66.7%');
  });
  it('0 → 0%', () => {
    expect(formatProgress(0)).toBe('0%');
  });
  it('100 → 100%', () => {
    expect(formatProgress(100)).toBe('100%');
  });
});

describe('createDefaultScenarioInput', () => {
  it('从 User 表读取默认利率偏好', () => {
    const user = makeUser({
      default_expected_return: 700,
      default_inflation_rate: 300,
      default_withdrawal_rate: 350,
    });
    const input = createDefaultScenarioInput(user, '我的计划');
    expect(input.name).toBe('我的计划');
    expect(input.expected_return_rate).toBe(700);
    expect(input.inflation_rate).toBe(300);
    expect(input.withdrawal_rate).toBe(350);
  });

  it('默认值：年龄30、退休55、年限30', () => {
    const input = createDefaultScenarioInput(makeUser({}), 'x');
    expect(input.current_age).toBe(30);
    expect(input.retirement_age).toBe(55);
    expect(input.retirement_years).toBe(30);
  });

  it('默认开启自动同步', () => {
    const input = createDefaultScenarioInput(makeUser({}), 'x');
    expect(input.auto_sync_assets).toBe(1);
  });

  it('年度支出默认 6 万元/年（转分）', () => {
    const input = createDefaultScenarioInput(makeUser({}), 'x');
    expect(input.annual_expenses).toBe(6000000);
  });

  it('继承用户的 is_china_market', () => {
    const input = createDefaultScenarioInput(makeUser({ is_china_market: 0 }), 'x');
    expect(input.is_china_market).toBe(0);
  });
});

describe('validateScenarioField', () => {
  it('current_age=30 通过', () => {
    expect(validateScenarioField('current_age', 30)).toBe('');
  });
  it('current_age=17 失败', () => {
    expect(validateScenarioField('current_age', 17)).toBe('当前年龄需在 18-80 之间');
  });
  it('current_age=81 失败', () => {
    expect(validateScenarioField('current_age', 81)).toBe('当前年龄需在 18-80 之间');
  });
  it('retirement_age=55 且 current_age=30 通过（需带上下文）', () => {
    // retirement_age 校验需 current_age 上下文，用第二参数
    expect(validateScenarioField('retirement_age', 55, { current_age: 30 })).toBe('');
  });
  it('retirement_age=30 且 current_age=30 失败', () => {
    expect(validateScenarioField('retirement_age', 30, { current_age: 30 })).toBe('退休年龄需大于当前年龄且不超过 80');
  });
  it('annual_expenses=0 失败', () => {
    expect(validateScenarioField('annual_expenses', 0)).toBe('年度支出需大于 0');
  });
  it('expected_return_rate=100 通过（1%）', () => {
    expect(validateScenarioField('expected_return_rate', 100)).toBe('');
  });
  it('expected_return_rate=1500 通过（15%）', () => {
    expect(validateScenarioField('expected_return_rate', 1500)).toBe('');
  });
  it('expected_return_rate=99 失败', () => {
    expect(validateScenarioField('expected_return_rate', 99)).toBe('预期回报率需在 1%-15% 之间');
  });
  it('inflation_rate=0 通过', () => {
    expect(validateScenarioField('inflation_rate', 0)).toBe('');
  });
  it('inflation_rate=1001 失败', () => {
    expect(validateScenarioField('inflation_rate', 1001)).toBe('通胀率需在 0%-10% 之间');
  });
  it('withdrawal_rate=200 通过（2%）', () => {
    expect(validateScenarioField('withdrawal_rate', 200)).toBe('');
  });
  it('withdrawal_rate=600 通过（6%）', () => {
    expect(validateScenarioField('withdrawal_rate', 600)).toBe('');
  });
  it('withdrawal_rate=601 失败', () => {
    expect(validateScenarioField('withdrawal_rate', 601)).toBe('提现率需在 2%-6% 之间');
  });
  it('retirement_years=10 通过', () => {
    expect(validateScenarioField('retirement_years', 10)).toBe('');
  });
  it('retirement_years=51 失败', () => {
    expect(validateScenarioField('retirement_years', 51)).toBe('退休后年限需在 10-50 之间');
  });
  it('monthly_savings=-1 失败', () => {
    expect(validateScenarioField('monthly_savings', -1)).toBe('每月储蓄不能为负');
  });
  it('name="标准计划" 通过', () => {
    expect(validateScenarioField('name', '标准计划')).toBe('');
  });
  it('name="" 失败（空字符串）', () => {
    expect(validateScenarioField('name', '')).toBe('场景名称需在 1-50 字符之间');
  });
  it('name=51 字符 失败', () => {
    expect(validateScenarioField('name', 'a'.repeat(51))).toBe('场景名称需在 1-50 字符之间');
  });
  it('未知字段返回空字符串', () => {
    expect(validateScenarioField('sync_version', 0)).toBe('');
  });
});

describe('FORM_FIELD_GROUPS', () => {
  it('包含 2 个分组', () => {
    expect(FORM_FIELD_GROUPS).toHaveLength(2);
  });
  it('第一组标题为基本参数', () => {
    expect(FORM_FIELD_GROUPS[0].title).toBe('基本参数');
  });
  it('第二组标题为投资参数', () => {
    expect(FORM_FIELD_GROUPS[1].title).toBe('投资参数');
  });
  it('包含 current_age 字段', () => {
    const allFields = FORM_FIELD_GROUPS.flatMap((g) => g.fields.map((f) => f.key));
    expect(allFields).toContain('current_age');
  });
});

describe('CHINA_WITHDRAWAL_RATE_HINT', () => {
  it('包含 3.0%-3.5%', () => {
    expect(CHINA_WITHDRAWAL_RATE_HINT).toContain('3.0%-3.5%');
  });
});

describe('formatProjectionForChart', () => {
  it('空数组返回空', () => {
    expect(formatProjectionForChart([], 1500000000)).toEqual([]);
  });

  it('转换分→元、注入 fireNumber、保留 phase', () => {
    const projection: MonthlyProjectionPoint[] = [
      {
        month: 1, age: 30.0833, balance: 10100000, contribution: 100000,
        growth: 100000, cumulative_contribution: 100000, cumulative_growth: 100000,
        phase: 'accumulation',
      },
      {
        month: 301, age: 55.0833, balance: 1990000000, contribution: 0,
        growth: 5000000, cumulative_contribution: 30000000, cumulative_growth: 1960000000,
        phase: 'retirement',
      },
    ];
    const result = formatProjectionForChart(projection, 1500000000);
    expect(result).toHaveLength(2);
    expect(result[0].age).toBe(30.08);
    expect(result[0].balance).toBe(101000); // 10100000 分 → 101000 元
    expect(result[0].phase).toBe('accumulation');
    expect(result[0].fireNumber).toBe(15000000); // 1500000000 分 → 15000000 元
    expect(result[1].phase).toBe('retirement');
  });
});
