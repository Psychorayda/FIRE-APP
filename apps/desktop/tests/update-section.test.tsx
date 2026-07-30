// UpdateSection 组件测试 / UpdateSection component test

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { UpdateSection } from '@renderer/components/auxiliary/UpdateSection.js';
import { useUpdateStore } from '@renderer/stores/update-store.js';

describe('UpdateSection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useUpdateStore.setState({
      phase: 'idle',
      currentVersion: '0.0.0-dev.1',
      latestVersion: undefined,
      skippedVersions: [],
      dialogOpen: false,
    });
  });

  it('显示当前版本号', () => {
    render(<UpdateSection />);
    expect(screen.getByText('v0.0.0-dev.1')).toBeInTheDocument();
  });

  it('无新版本时显示"已是最新"', () => {
    useUpdateStore.setState({ phase: 'not-available' });
    render(<UpdateSection />);
    expect(screen.getByText('已是最新')).toBeInTheDocument();
  });

  it('有新版本时显示最新版本号', () => {
    useUpdateStore.setState({
      phase: 'available',
      latestVersion: '0.0.0-dev.2',
    });
    render(<UpdateSection />);
    expect(screen.getByText('v0.0.0-dev.2（有更新）')).toBeInTheDocument();
  });

  it('点击"检查更新"调用 checkForUpdates + openDialog', () => {
    const checkForUpdates = vi.fn().mockResolvedValue(undefined);
    const openDialog = vi.fn();
    useUpdateStore.setState({ checkForUpdates, openDialog });
    render(<UpdateSection />);
    fireEvent.click(screen.getByRole('button', { name: '检查更新' }));
    expect(checkForUpdates).toHaveBeenCalled();
    expect(openDialog).toHaveBeenCalled();
  });
});
