// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// mock electron（InstallRunner 依赖 app.relaunch 和 app.exit）
vi.mock('electron', () => ({
  app: {
    relaunch: vi.fn(),
    exit: vi.fn(),
  },
}));

// mock child_process（InstallRunner 依赖 spawn）
vi.mock('node:child_process', () => ({
  spawn: vi.fn(() => ({
    unref: vi.fn(),
  })),
}));

import { app } from 'electron';
import { spawn } from 'node:child_process';
import { InstallRunner } from '../src/main/updater/install-runner.js';

describe('InstallRunner', () => {
  let runner: InstallRunner;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    runner = new InstallRunner();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('run 用 /S 参数 spawn 安装包', () => {
    runner.run('/path/to/installer.exe');
    expect(spawn).toHaveBeenCalledWith(
      '/path/to/installer.exe',
      ['/S'],
      expect.objectContaining({ detached: true, stdio: 'ignore' }),
    );
  });

  it('run 对返回的 child 调用 unref', () => {
    const mockChild = { unref: vi.fn() };
    vi.mocked(spawn).mockReturnValue(mockChild as any);
    runner.run('/path/to/installer.exe');
    expect(mockChild.unref).toHaveBeenCalled();
  });

  it('run 3 秒后调用 app.relaunch 和 app.exit(0)', () => {
    runner.run('/path/to/installer.exe');
    // 3 秒内未调用
    expect(app.relaunch).not.toHaveBeenCalled();
    // 快进 3 秒
    vi.advanceTimersByTime(3000);
    expect(app.relaunch).toHaveBeenCalled();
    expect(app.exit).toHaveBeenCalledWith(0);
  });
});
