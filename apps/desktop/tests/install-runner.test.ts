// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// mock electron（InstallRunner 依赖 app.getPath 和 app.quit）
vi.mock('electron', () => ({
  app: {
    getPath: vi.fn((key: string) => {
      if (key === 'exe') return 'C:\\Apps\\FIRE App\\FIRE App.exe';
      if (key === 'temp') return 'C:\\Users\\test\\AppData\\Local\\Temp';
      return 'C:\\mock';
    }),
    quit: vi.fn(),
    relaunch: vi.fn(),
    exit: vi.fn(),
  },
}));

// mock node:child_process
vi.mock('node:child_process', () => ({
  spawn: vi.fn(() => ({
    unref: vi.fn(),
  })),
}));

// mock node:fs（writeFileSync）
vi.mock('node:fs', () => ({
  writeFileSync: vi.fn(),
}));

import { app } from 'electron';
import { spawn } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { InstallRunner } from '../src/main/updater/install-runner.js';

describe('InstallRunner', () => {
  let runner: InstallRunner;

  beforeEach(() => {
    vi.clearAllMocks();
    runner = new InstallRunner();
  });

  it('run 写入批处理脚本到 temp 目录', () => {
    runner.run('/path/to/installer.exe');
    expect(writeFileSync).toHaveBeenCalledTimes(1);
    const [batPath, content] = vi.mocked(writeFileSync).mock.calls[0];
    expect(batPath).toContain('fire-app-update-installer.bat');
    expect(content).toContain('@echo off');
    expect(content).toContain('start /wait');
    expect(content).toContain('/S');
  });

  it('run 用 cmd.exe /c spawn 批处理', () => {
    runner.run('/path/to/installer.exe');
    expect(spawn).toHaveBeenCalledWith(
      'cmd.exe',
      ['/c', expect.stringContaining('fire-app-update-installer.bat'), '/path/to/installer.exe', expect.any(String)],
      expect.objectContaining({
        detached: true,
        stdio: 'ignore',
        windowsHide: true,
      }),
    );
  });

  it('run 对返回的 child 调用 unref', () => {
    const mockChild = { unref: vi.fn() };
    vi.mocked(spawn).mockReturnValue(mockChild as any);
    runner.run('/path/to/installer.exe');
    expect(mockChild.unref).toHaveBeenCalled();
  });

  it('run 调用 app.quit（走 before-quit 钩子，正确关闭数据库）', () => {
    runner.run('/path/to/installer.exe');
    expect(app.quit).toHaveBeenCalledTimes(1);
    // 不应调用 app.exit(0)，因为它会跳过 before-quit
    expect(app.exit).not.toHaveBeenCalled();
  });

  it('批处理脚本包含等待 + 安装 + 重启 + 自删逻辑', () => {
    runner.run('/path/to/installer.exe');
    const content = vi.mocked(writeFileSync).mock.calls[0][1] as string;
    expect(content).toContain('timeout /t 2');        // 等应用退出
    expect(content).toContain('start /wait');         // 静默安装
    expect(content).toContain('/S');                  // NSIS 静默参数
    expect(content).toContain('start ""');            // 重启应用
    expect(content).toContain('del "%~f0"');          // 自删脚本
  });
});
