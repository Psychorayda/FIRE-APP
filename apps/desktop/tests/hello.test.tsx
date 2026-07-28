// 冒烟测试：验证 vitest + jsdom + @testing-library 配置正确
// Smoke test: verify vitest + jsdom + @testing-library configuration

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';

function Hello({ name }: { name: string }) {
  return <div>Hello, {name}!</div>;
}

describe('vitest 配置冒烟测试', () => {
  it('渲染 React 组件并断言文本', () => {
    render(<Hello name="FIRE" />);
    expect(screen.getByText('Hello, FIRE!')).toBeInTheDocument();
  });

  it('jsdom DOM API 可用', () => {
    const div = document.createElement('div');
    div.textContent = 'test';
    expect(div.textContent).toBe('test');
  });

  it('window.dataAccess mock 已注入', () => {
    expect(window.dataAccess).toBeDefined();
    expect(window.dataAccess.tx.listByUser).toBeDefined();
    expect(typeof window.dataAccess.tx.listByUser).toBe('function');
  });
});
