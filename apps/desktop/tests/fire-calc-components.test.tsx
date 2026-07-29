// Mock recharts（jsdom 下 SVG 渲染有问题）
// Mock recharts (SVG rendering issues under jsdom)
import { vi } from 'vitest';
vi.mock('recharts', () => ({
  AreaChart: ({ children }: { children: React.ReactNode }) => <div data-testid="area-chart">{children}</div>,
  Area: () => <div data-testid="area" />,
  XAxis: () => <div data-testid="xaxis" />,
  YAxis: () => <div data-testid="yaxis" />,
  Tooltip: () => <div data-testid="tooltip" />,
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div data-testid="responsive-container">{children}</div>,
  ReferenceLine: () => <div data-testid="reference-line" />,
  RadialBarChart: ({ children }: { children: React.ReactNode }) => <div data-testid="radial-bar-chart">{children}</div>,
  RadialBar: () => <div data-testid="radial-bar" />,
  PolarAngleAxis: () => <div data-testid="polar-angle-axis" />,
}));

// FIRE 计算器组件测试 / FIRE calculator component tests

import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { FireIntro } from '@renderer/components/fire-calculator/FireIntro.js';

describe('FireIntro', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('渲染标题和说明', () => {
    render(<FireIntro onCreate={vi.fn()} />);
    expect(screen.getByText('开始你的 FIRE 之旅')).toBeInTheDocument();
    expect(screen.getAllByText(/FIRE Number/).length).toBeGreaterThan(0);
  });

  it('点击按钮触发 onCreate', () => {
    const onCreate = vi.fn();
    render(<FireIntro onCreate={onCreate} />);
    fireEvent.click(screen.getByText('创建第一个场景'));
    expect(onCreate).toHaveBeenCalledTimes(1);
  });
});

import { ScenarioSidebar } from '@renderer/components/fire-calculator/ScenarioSidebar.js';
import type { FireScenario } from '@shared/types/index.js';

function makeScenario(overrides: Partial<FireScenario>): FireScenario {
  return {
    id: 'scn-1', user_id: 'user-1', name: '标准计划', description: null,
    current_age: 30, retirement_age: 55, current_portfolio_value: 0,
    auto_sync_assets: 0, monthly_savings: 0, annual_expenses: 6000000,
    expected_return_rate: 700, inflation_rate: 300, withdrawal_rate: 400,
    retirement_years: 30, post_retirement_monthly_income: 0,
    is_china_market: 1, is_active: 1, sync_version: 0, updated_at: 0, deleted_flag: 0,
    ...overrides,
  };
}

describe('ScenarioSidebar', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('渲染场景列表', () => {
    const scenarios = [makeScenario({ id: 's1', name: '标准' }), makeScenario({ id: 's2', name: '保守' })];
    render(<ScenarioSidebar scenarios={scenarios} currentId="s1" onSelect={vi.fn()} onCreate={vi.fn()} />);
    expect(screen.getByText('标准')).toBeInTheDocument();
    expect(screen.getByText('保守')).toBeInTheDocument();
  });

  it('选中项有高亮 class', () => {
    const scenarios = [makeScenario({ id: 's1', name: '标准' }), makeScenario({ id: 's2', name: '保守' })];
    render(<ScenarioSidebar scenarios={scenarios} currentId="s2" onSelect={vi.fn()} onCreate={vi.fn()} />);
    const item = screen.getByText('保守').closest('button');
    expect(item!.className).toContain('bg-blue-50');
  });

  it('点击场景项触发 onSelect', () => {
    const onSelect = vi.fn();
    const scenarios = [makeScenario({ id: 's1', name: '标准' })];
    render(<ScenarioSidebar scenarios={scenarios} currentId="s1" onSelect={onSelect} onCreate={vi.fn()} />);
    fireEvent.click(screen.getByText('标准'));
    expect(onSelect).toHaveBeenCalledWith('s1');
  });

  it('点击新建按钮触发 onCreate', () => {
    const onCreate = vi.fn();
    render(<ScenarioSidebar scenarios={[]} currentId="" onSelect={vi.fn()} onCreate={onCreate} />);
    fireEvent.click(screen.getByText('+ 新建场景'));
    expect(onCreate).toHaveBeenCalledTimes(1);
  });
});

import { ScenarioForm } from '@renderer/components/fire-calculator/ScenarioForm.js';

describe('ScenarioForm', () => {
  const baseScenario = makeScenario({
    id: 's1', name: '标准', current_age: 30, retirement_age: 55,
    annual_expenses: 6000000, expected_return_rate: 700, inflation_rate: 300,
    withdrawal_rate: 400, retirement_years: 30, auto_sync_assets: 0,
    current_portfolio_value: 10000000, monthly_savings: 100000,
    post_retirement_monthly_income: 0, is_china_market: 1,
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('渲染两个分组标题', () => {
    render(<ScenarioForm scenario={baseScenario} onFieldChange={vi.fn()} investableBalance={null} />);
    expect(screen.getByText('基本参数')).toBeInTheDocument();
    expect(screen.getByText('投资参数')).toBeInTheDocument();
  });

  it('百分比字段显示为百分比（7.0 而非 700）', () => {
    render(<ScenarioForm scenario={baseScenario} onFieldChange={vi.fn()} investableBalance={null} />);
    // 预期回报率 700 基点 = 7.0%
    const input = screen.getByLabelText('预期回报率') as HTMLInputElement;
    expect(input.value).toBe('7');
  });

  it('金额字段显示为元（100000 而非 10000000）', () => {
    render(<ScenarioForm scenario={baseScenario} onFieldChange={vi.fn()} investableBalance={null} />);
    const input = screen.getByLabelText('当前组合值') as HTMLInputElement;
    expect(input.value).toBe('100000');
  });

  it('auto_sync 开启时当前组合值只读并显示 investableBalance', () => {
    const syncScenario = { ...baseScenario, auto_sync_assets: 1 };
    render(<ScenarioForm scenario={syncScenario} onFieldChange={vi.fn()} investableBalance={5000000} />);
    const input = screen.getByLabelText('当前组合值') as HTMLInputElement;
    expect(input.disabled).toBe(true);
    expect(input.value).toBe('50000'); // 5000000 分 → 50000 元
  });

  it('is_china_market=1 时显示提现率提示', () => {
    render(<ScenarioForm scenario={baseScenario} onFieldChange={vi.fn()} investableBalance={null} />);
    expect(screen.getByText(/中国市场建议提现率/)).toBeInTheDocument();
  });

  it('is_china_market=0 时不显示提现率提示', () => {
    const overseasScenario = { ...baseScenario, is_china_market: 0 };
    render(<ScenarioForm scenario={overseasScenario} onFieldChange={vi.fn()} investableBalance={null} />);
    expect(screen.queryByText(/中国市场建议提现率/)).not.toBeInTheDocument();
  });

  it('修改百分比字段触发 onFieldChange（转基点）', () => {
    const onFieldChange = vi.fn();
    render(<ScenarioForm scenario={baseScenario} onFieldChange={onFieldChange} investableBalance={null} />);
    const input = screen.getByLabelText('预期回报率') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '8' } });
    expect(onFieldChange).toHaveBeenCalledWith('expected_return_rate', 800);
  });

  it('修改金额字段触发 onFieldChange（转分）', () => {
    const onFieldChange = vi.fn();
    render(<ScenarioForm scenario={baseScenario} onFieldChange={onFieldChange} investableBalance={null} />);
    const input = screen.getByLabelText('每月储蓄') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '2000' } });
    expect(onFieldChange).toHaveBeenCalledWith('monthly_savings', 200000);
  });

  it('切换 auto_sync 开关触发 onFieldChange', () => {
    const onFieldChange = vi.fn();
    render(<ScenarioForm scenario={baseScenario} onFieldChange={onFieldChange} investableBalance={null} />);
    const toggle = screen.getByLabelText('自动同步资产') as HTMLInputElement;
    fireEvent.click(toggle);
    expect(onFieldChange).toHaveBeenCalledWith('auto_sync_assets', 1);
  });

  it('非法年龄显示校验错误', () => {
    const invalidScenario = { ...baseScenario, current_age: 15 };
    render(<ScenarioForm scenario={invalidScenario} onFieldChange={vi.fn()} investableBalance={null} />);
    expect(screen.getByText('当前年龄需在 18-80 之间')).toBeInTheDocument();
  });
});

import { ResultCards } from '@renderer/components/fire-calculator/ResultCards.js';
import type { ProjectionResult } from '@shared/services/fire-calc.js';

function makeProjection(overrides: Partial<ProjectionResult>): ProjectionResult {
  return {
    fire_number: 1500000000,
    adjusted_fire_number: 1500000000,
    retirement_portfolio: 2000000000,
    progress: 66.7,
    monthly_projection: [],
    ...overrides,
  };
}

describe('ResultCards', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('loading 时显示加载中', () => {
    render(<ResultCards result={null} loading={true} />);
    // 4 张卡都显示加载中（getAllByText）
    expect(screen.getAllByText('加载中...')).toHaveLength(4);
  });

  it('result 为 null 时显示暂无数据', () => {
    render(<ResultCards result={null} loading={false} />);
    expect(screen.getAllByText('暂无数据')).toHaveLength(4);
  });

  it('渲染 4 个卡片标签', () => {
    render(<ResultCards result={makeProjection({})} loading={false} />);
    expect(screen.getByText('FIRE Number')).toBeInTheDocument();
    expect(screen.getByText('调整后 FIRE Number')).toBeInTheDocument();
    expect(screen.getByText('当前进度')).toBeInTheDocument();
    expect(screen.getByText('退休时资产')).toBeInTheDocument();
  });

  it('金额和进度格式化正确（分→元）', () => {
    render(<ResultCards result={makeProjection({ fire_number: 1500000000, progress: 66.7 })} loading={false} />);
    // 1500000000 分 = 15000000 元 = ¥15,000,000.00
    // fire_number 与 adjusted_fire_number 默认相同，两张卡显示同一金额，用 getAllByText
    expect(screen.getAllByText('¥15,000,000.00').length).toBeGreaterThan(0);
    expect(screen.getByText('66.7%')).toBeInTheDocument();
  });
});

import { ProgressGauge } from '@renderer/components/fire-calculator/ProgressGauge.js';

describe('ProgressGauge', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('渲染环形图和百分比', () => {
    render(<ProgressGauge progress={66.7} fireNumber={1500000000} currentValue={1000000000} />);
    expect(screen.getByTestId('radial-bar-chart')).toBeInTheDocument();
    expect(screen.getByText('66.7%')).toBeInTheDocument();
  });

  it('底部标注显示当前值 → FIRE Number', () => {
    render(<ProgressGauge progress={66.7} fireNumber={1500000000} currentValue={1000000000} />);
    // 1000000000 分 = 10000000 元 = ¥10,000,000.00
    // 1500000000 分 = 15000000 元 = ¥15,000,000.00
    expect(screen.getByText('¥10,000,000.00 → ¥15,000,000.00')).toBeInTheDocument();
  });

  it('progress=0 显示 0%', () => {
    render(<ProgressGauge progress={0} fireNumber={1500000000} currentValue={0} />);
    expect(screen.getByText('0%')).toBeInTheDocument();
  });
});
