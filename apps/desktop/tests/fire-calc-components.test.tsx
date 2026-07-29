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
