// Task U1: ErrorBoundary 失败测试（TDD）
// Task U1: ErrorBoundary failing tests (TDD)

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ErrorBoundary } from '@renderer/components/base/ErrorBoundary.js';

function ThrowOnRender({ shouldThrow }: { shouldThrow: boolean }) {
  if (shouldThrow) throw new Error('测试崩溃');
  return <div>正常内容</div>;
}

describe('ErrorBoundary', () => {
  it('子组件正常时不拦截渲染', () => {
    render(<ErrorBoundary><ThrowOnRender shouldThrow={false} /></ErrorBoundary>);
    expect(screen.getByText('正常内容')).toBeInTheDocument();
  });

  it('子组件崩溃时显示兜底页', () => {
    // 抑制 console.error
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    render(<ErrorBoundary><ThrowOnRender shouldThrow={true} /></ErrorBoundary>);
    expect(screen.getByText(/出现错误/)).toBeInTheDocument();
    expect(screen.getByText('测试崩溃')).toBeInTheDocument();
    spy.mockRestore();
  });

  it('兜底页含重试按钮', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    render(<ErrorBoundary><ThrowOnRender shouldThrow={true} /></ErrorBoundary>);
    expect(screen.getByText('重试')).toBeInTheDocument();
    spy.mockRestore();
  });
});
