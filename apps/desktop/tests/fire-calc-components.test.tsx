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

  // ============= 浏览模式 =============
  it('浏览模式渲染两个分组标题', () => {
    render(<ScenarioForm scenario={baseScenario} onSave={vi.fn()} investableBalance={null} />);
    expect(screen.getByText('基本参数')).toBeInTheDocument();
    expect(screen.getByText('投资参数')).toBeInTheDocument();
  });

  it('浏览模式显示编辑按钮', () => {
    render(<ScenarioForm scenario={baseScenario} onSave={vi.fn()} investableBalance={null} />);
    expect(screen.getByText('编辑')).toBeInTheDocument();
  });

  it('浏览模式以百分比显示利率字段（7% 而非 700）', () => {
    render(<ScenarioForm scenario={baseScenario} onSave={vi.fn()} investableBalance={null} />);
    expect(screen.getByText('7%')).toBeInTheDocument();
  });

  it('浏览模式以货币格式显示金额字段', () => {
    render(<ScenarioForm scenario={baseScenario} onSave={vi.fn()} investableBalance={null} />);
    // current_portfolio_value: 10000000 分 = 100000 元 = ¥100,000.00
    expect(screen.getByText('¥100,000.00')).toBeInTheDocument();
  });

  it('浏览模式 auto_sync 开启时显示 investableBalance', () => {
    const syncScenario = { ...baseScenario, auto_sync_assets: 1 };
    render(<ScenarioForm scenario={syncScenario} onSave={vi.fn()} investableBalance={5000000} />);
    // 5000000 分 = 50000 元 = ¥50,000.00
    expect(screen.getByText('¥50,000.00')).toBeInTheDocument();
  });

  it('浏览模式 is_china_market=1 时显示提现率提示', () => {
    render(<ScenarioForm scenario={baseScenario} onSave={vi.fn()} investableBalance={null} />);
    expect(screen.getByText(/中国市场建议提现率/)).toBeInTheDocument();
  });

  it('浏览模式 is_china_market=0 时不显示提现率提示', () => {
    const overseasScenario = { ...baseScenario, is_china_market: 0 };
    render(<ScenarioForm scenario={overseasScenario} onSave={vi.fn()} investableBalance={null} />);
    expect(screen.queryByText(/中国市场建议提现率/)).not.toBeInTheDocument();
  });

  // ============= 编辑模式 =============
  it('点击编辑进入编辑模式，显示保存和取消按钮', () => {
    render(<ScenarioForm scenario={baseScenario} onSave={vi.fn()} investableBalance={null} />);
    fireEvent.click(screen.getByText('编辑'));
    expect(screen.getByText('保存')).toBeInTheDocument();
    expect(screen.getByText('取消')).toBeInTheDocument();
  });

  it('编辑模式百分比字段显示为百分比（7 而非 700）', () => {
    render(<ScenarioForm scenario={baseScenario} onSave={vi.fn()} investableBalance={null} />);
    fireEvent.click(screen.getByText('编辑'));
    const input = screen.getByLabelText('预期回报率') as HTMLInputElement;
    expect(input.value).toBe('7');
  });

  it('编辑模式金额字段显示为元（100000 而非 10000000）', () => {
    render(<ScenarioForm scenario={baseScenario} onSave={vi.fn()} investableBalance={null} />);
    fireEvent.click(screen.getByText('编辑'));
    const input = screen.getByLabelText('当前组合值') as HTMLInputElement;
    expect(input.value).toBe('100000');
  });

  it('编辑模式 auto_sync 开启时当前组合值只读并显示 investableBalance', () => {
    const syncScenario = { ...baseScenario, auto_sync_assets: 1 };
    render(<ScenarioForm scenario={syncScenario} onSave={vi.fn()} investableBalance={5000000} />);
    fireEvent.click(screen.getByText('编辑'));
    const input = screen.getByLabelText('当前组合值') as HTMLInputElement;
    expect(input.disabled).toBe(true);
    expect(input.value).toBe('50000'); // 5000000 分 → 50000 元
  });

  it('编辑模式修改百分比字段后保存触发 onSave（转基点）', () => {
    const onSave = vi.fn();
    render(<ScenarioForm scenario={baseScenario} onSave={onSave} investableBalance={null} />);
    fireEvent.click(screen.getByText('编辑'));
    const input = screen.getByLabelText('预期回报率') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '8' } });
    fireEvent.click(screen.getByText('保存'));
    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSave.mock.calls[0][0].expected_return_rate).toBe(800); // 8% → 800 基点
  });

  it('编辑模式修改金额字段后保存触发 onSave（转分）', () => {
    const onSave = vi.fn();
    render(<ScenarioForm scenario={baseScenario} onSave={onSave} investableBalance={null} />);
    fireEvent.click(screen.getByText('编辑'));
    const input = screen.getByLabelText('每月储蓄') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '2000' } });
    fireEvent.click(screen.getByText('保存'));
    expect(onSave.mock.calls[0][0].monthly_savings).toBe(200000); // 2000 元 → 200000 分
  });

  it('编辑模式切换 auto_sync 开关后保存', () => {
    const onSave = vi.fn();
    render(<ScenarioForm scenario={baseScenario} onSave={onSave} investableBalance={null} />);
    fireEvent.click(screen.getByText('编辑'));
    const toggle = screen.getByLabelText('自动同步资产') as HTMLInputElement;
    fireEvent.click(toggle);
    fireEvent.click(screen.getByText('保存'));
    expect(onSave.mock.calls[0][0].auto_sync_assets).toBe(1);
  });

  it('点击取消返回浏览模式且不触发 onSave', () => {
    const onSave = vi.fn();
    render(<ScenarioForm scenario={baseScenario} onSave={onSave} investableBalance={null} />);
    fireEvent.click(screen.getByText('编辑'));
    const input = screen.getByLabelText('预期回报率') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '8' } });
    fireEvent.click(screen.getByText('取消'));
    expect(onSave).not.toHaveBeenCalled();
    // 回到浏览模式
    expect(screen.getByText('编辑')).toBeInTheDocument();
  });

  it('校验失败时阻止保存并显示错误', () => {
    const onSave = vi.fn();
    render(<ScenarioForm scenario={baseScenario} onSave={onSave} investableBalance={null} />);
    fireEvent.click(screen.getByText('编辑'));
    const ageInput = screen.getByLabelText('当前年龄') as HTMLInputElement;
    fireEvent.change(ageInput, { target: { value: '15' } });
    fireEvent.submit(screen.getByText('保存').closest('form')!);
    expect(onSave).not.toHaveBeenCalled();
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

import { ProjectionChart } from '@renderer/components/fire-calculator/ProjectionChart.js';
import type { MonthlyProjectionPoint } from '@shared/services/fire-calc.js';

function makeProjectionPoints(): MonthlyProjectionPoint[] {
  return [
    {
      month: 1, age: 30.08, balance: 10100000, contribution: 100000,
      growth: 100000, cumulative_contribution: 100000, cumulative_growth: 100000,
      phase: 'accumulation',
    },
    {
      month: 2, age: 30.17, balance: 10300000, contribution: 100000,
      growth: 101000, cumulative_contribution: 200000, cumulative_growth: 201000,
      phase: 'accumulation',
    },
    {
      month: 301, age: 55.08, balance: 1990000000, contribution: 0,
      growth: 5000000, cumulative_contribution: 30000000, cumulative_growth: 1960000000,
      phase: 'retirement',
    },
  ];
}

describe('ProjectionChart', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('loading 时显示加载中', () => {
    render(<ProjectionChart data={[]} fireNumber={1500000000} loading={true} />);
    expect(screen.getByText('加载中...')).toBeInTheDocument();
  });

  it('空数据显示空状态', () => {
    render(<ProjectionChart data={[]} fireNumber={1500000000} loading={false} />);
    expect(screen.getByText('暂无投影数据')).toBeInTheDocument();
  });

  it('有数据时渲染面积图', () => {
    render(<ProjectionChart data={makeProjectionPoints()} fireNumber={1500000000} loading={false} />);
    expect(screen.getByTestId('area-chart')).toBeInTheDocument();
    expect(screen.getByTestId('reference-line')).toBeInTheDocument();
  });
});

import { FireCalculatorPage } from '@renderer/pages/FireCalculatorPage.js';
import { useAppStore } from '@renderer/stores/app-store.js';
import { useScenarioStore } from '@renderer/stores/scenario-store.js';
import { useToastStore } from '@renderer/stores/toast-store.js';
import type { User } from '@shared/types/index.js';

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

describe('FireCalculatorPage 集成', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // 重置 stores
    useAppStore.getState().clearError();
    useScenarioStore.getState().clear();
    useToastStore.getState().clear();
    // 默认 mock
    (window.dataAccess.scenario.list as any).mockResolvedValue([]);
    (window.dataAccess.scenario.create as any).mockResolvedValue(undefined);
    (window.dataAccess.scenario.update as any).mockResolvedValue(undefined);
    (window.dataAccess.fireCalc.runProjection as any).mockResolvedValue(makeProjection({}));
    (window.dataAccess.account.investableBalance as any).mockResolvedValue(0);
  });

  it('无场景时显示介绍页', async () => {
    (window.dataAccess.scenario.list as any).mockResolvedValue([]);
    useAppStore.setState({ currentUser: makeUser({}) as any });

    render(<FireCalculatorPage />);

    expect(await screen.findByText('开始你的 FIRE 之旅')).toBeInTheDocument();
  });

  it('有场景时显示表单和结果', async () => {
    const scenarios = [makeScenario({ id: 's1', name: '标准' })];
    (window.dataAccess.scenario.list as any).mockResolvedValue(scenarios);
    useAppStore.setState({ currentUser: makeUser({}) as any });

    render(<FireCalculatorPage />);

    expect(await screen.findByText('场景详情')).toBeInTheDocument();
    expect(screen.getByText('基本参数')).toBeInTheDocument();
    expect(screen.getByText('FIRE Number')).toBeInTheDocument();
  });

  it('点击介绍页按钮创建场景', async () => {
    (window.dataAccess.scenario.list as any)
      .mockResolvedValueOnce([]) // 初始 fetch
      .mockResolvedValueOnce([makeScenario({ id: 's-new', name: '我的 FIRE 计划' })]); // 创建后
    useAppStore.setState({ currentUser: makeUser({}) as any });

    render(<FireCalculatorPage />);

    const btn = await screen.findByText('创建第一个场景');
    fireEvent.click(btn);

    expect(await screen.findByText('场景详情')).toBeInTheDocument();
    expect(window.dataAccess.scenario.create).toHaveBeenCalledTimes(1);
  });

  it('切换场景触发 runProjection', async () => {
    const scenarios = [makeScenario({ id: 's1', name: 'A' }), makeScenario({ id: 's2', name: 'B' })];
    (window.dataAccess.scenario.list as any).mockResolvedValue(scenarios);
    useAppStore.setState({ currentUser: makeUser({}) as any });

    render(<FireCalculatorPage />);
    await screen.findByText('场景详情');
    vi.clearAllMocks();

    fireEvent.click(screen.getByText('B'));
    expect(window.dataAccess.fireCalc.runProjection).toHaveBeenCalledWith(
      expect.objectContaining({ id: 's2' })
    );
  });

  it('加载失败显示错误提示', async () => {
    (window.dataAccess.scenario.list as any).mockRejectedValue(new Error('加载失败'));
    useAppStore.setState({ currentUser: makeUser({}) as any });

    render(<FireCalculatorPage />);

    expect(await screen.findByText('数据加载失败，请重试')).toBeInTheDocument();
  });

  it('校验失败→阻止保存→修正后恢复保存（spec 8.4 场景 3）', async () => {
    const scenarios = [makeScenario({ id: 's1', name: '标准' })];
    (window.dataAccess.scenario.list as any).mockResolvedValue(scenarios);
    useAppStore.setState({ currentUser: makeUser({}) as any });

    render(<FireCalculatorPage />);
    await screen.findByText('场景详情');

    // 进入编辑模式
    fireEvent.click(screen.getByText('编辑'));

    // 输入非法年龄 → 保存被阻止
    const ageInput = screen.getByLabelText('当前年龄') as HTMLInputElement;
    fireEvent.change(ageInput, { target: { value: '15' } });
    fireEvent.submit(screen.getByText('保存').closest('form')!);
    expect(screen.getByText('当前年龄需在 18-80 之间')).toBeInTheDocument();
    expect(window.dataAccess.scenario.update).not.toHaveBeenCalled();

    // 修正年龄 → 保存成功
    fireEvent.change(ageInput, { target: { value: '35' } });
    fireEvent.submit(screen.getByText('保存').closest('form')!);
    expect(window.dataAccess.scenario.update).toHaveBeenCalledWith('s1', expect.objectContaining({ current_age: 35 }));
    // 回到浏览模式
    expect(screen.getByText('编辑')).toBeInTheDocument();
  });

  it('保存触发 update + runProjection + 结果更新（spec 8.4 场景 1）', async () => {
    const scenarios = [makeScenario({ id: 's1', name: '标准' })];
    (window.dataAccess.scenario.list as any).mockResolvedValue(scenarios);
    (window.dataAccess.fireCalc.runProjection as any).mockResolvedValue(
      makeProjection({ progress: 50, fire_number: 1000000000 })
    );
    useAppStore.setState({ currentUser: makeUser({}) as any });

    render(<FireCalculatorPage />);
    await screen.findByText('场景详情');
    vi.clearAllMocks();

    // 重新 mock update 后 list 返回更新后的场景
    (window.dataAccess.scenario.list as any).mockResolvedValue(
      [makeScenario({ id: 's1', name: '标准', current_age: 35 })]
    );
    (window.dataAccess.fireCalc.runProjection as any).mockResolvedValue(
      makeProjection({ progress: 75, fire_number: 1200000000 })
    );

    // 编辑并保存
    fireEvent.click(screen.getByText('编辑'));
    const savingsInput = screen.getByLabelText('每月储蓄') as HTMLInputElement;
    fireEvent.change(savingsInput, { target: { value: '5000' } });
    fireEvent.click(screen.getByText('保存'));

    // 验证 update 被调用
    await screen.findByText('场景详情');
    expect(window.dataAccess.scenario.update).toHaveBeenCalledWith(
      's1', expect.objectContaining({ monthly_savings: 500000 })
    );
    // 验证 runProjection 被调用
    expect(window.dataAccess.fireCalc.runProjection).toHaveBeenCalled();
  });

  it('auto_sync 开启→getInvestableBalance 被调用（FC-11 页面级）', async () => {
    const scenarios = [makeScenario({ id: 's1', name: '标准', auto_sync_assets: 0 })];
    (window.dataAccess.scenario.list as any).mockResolvedValue(scenarios);
    (window.dataAccess.account.investableBalance as any).mockResolvedValue(5000000);
    useAppStore.setState({ currentUser: makeUser({}) as any });

    render(<FireCalculatorPage />);
    await screen.findByText('场景详情');
    // auto_sync=0 时不应调用 investableBalance
    expect(window.dataAccess.account.investableBalance).not.toHaveBeenCalled();

    // 切换 auto_sync 开启并保存
    fireEvent.click(screen.getByText('编辑'));
    const toggle = screen.getByLabelText('自动同步资产') as HTMLInputElement;
    fireEvent.click(toggle);
    fireEvent.click(screen.getByText('保存'));

    // update 后 list 返回 auto_sync=1 的场景
    (window.dataAccess.scenario.list as any).mockResolvedValue(
      [makeScenario({ id: 's1', name: '标准', auto_sync_assets: 1 })]
    );

    // 等 useEffect 触发 getInvestableBalance
    await screen.findByText('场景详情');
    await new Promise((r) => setTimeout(r, 50));
    expect(window.dataAccess.account.investableBalance).toHaveBeenCalledWith('user-1');
  });

  it('createScenario 成功显示成功 toast', async () => {
    (window.dataAccess.scenario.list as any)
      .mockResolvedValueOnce([]) // 初始 fetch
      .mockResolvedValueOnce([makeScenario({ id: 's-new', name: '我的 FIRE 计划' })]); // 创建后
    useAppStore.setState({ currentUser: makeUser({}) as any });

    render(<FireCalculatorPage />);

    const btn = await screen.findByText('创建第一个场景');
    fireEvent.click(btn);

    // 等 createScenario 完成后页面切换到场景详情
    await screen.findByText('场景详情');
    // 验证成功 toast 已入栈
    const toasts = useToastStore.getState().toasts;
    expect(toasts.some((t) => t.type === 'success' && t.message === '场景已创建')).toBe(true);
  });

  it('updateScenario 成功显示成功 toast', async () => {
    const scenarios = [makeScenario({ id: 's1', name: '标准' })];
    (window.dataAccess.scenario.list as any).mockResolvedValue(scenarios);
    useAppStore.setState({ currentUser: makeUser({}) as any });

    render(<FireCalculatorPage />);
    await screen.findByText('场景详情');

    // 编辑并保存
    fireEvent.click(screen.getByText('编辑'));
    const savingsInput = screen.getByLabelText('每月储蓄') as HTMLInputElement;
    fireEvent.change(savingsInput, { target: { value: '5000' } });
    fireEvent.click(screen.getByText('保存'));

    // 等 updateScenario 完成
    await new Promise((r) => setTimeout(r, 50));
    const toasts = useToastStore.getState().toasts;
    expect(toasts.some((t) => t.type === 'success' && t.message === '场景已保存')).toBe(true);
  });

  it('updateScenario 失败显示错误 toast', async () => {
    const scenarios = [makeScenario({ id: 's1', name: '标准' })];
    (window.dataAccess.scenario.list as any).mockResolvedValue(scenarios);
    (window.dataAccess.scenario.update as any).mockRejectedValue(new Error('保存失败'));
    useAppStore.setState({ currentUser: makeUser({}) as any });

    render(<FireCalculatorPage />);
    await screen.findByText('场景详情');

    // 编辑并保存（会失败）
    fireEvent.click(screen.getByText('编辑'));
    const savingsInput = screen.getByLabelText('每月储蓄') as HTMLInputElement;
    fireEvent.change(savingsInput, { target: { value: '5000' } });
    fireEvent.click(screen.getByText('保存'));

    // 等 updateScenario 失败 + error toast 入栈
    await new Promise((r) => setTimeout(r, 50));
    const toasts = useToastStore.getState().toasts;
    expect(toasts.some((t) => t.type === 'error' && t.message.includes('操作失败'))).toBe(true);
    expect(toasts.some((t) => t.message.includes('保存失败'))).toBe(true);
    // 失败时不应显示成功 toast
    expect(toasts.some((t) => t.type === 'success')).toBe(false);
  });
});
