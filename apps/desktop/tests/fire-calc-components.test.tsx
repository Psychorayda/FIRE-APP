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
