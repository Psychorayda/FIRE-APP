// UpdateDialog 组件测试 / UpdateDialog component test

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { UpdateDialog } from '@renderer/components/auxiliary/UpdateDialog.js';
import { useUpdateStore } from '@renderer/stores/update-store.js';

describe('UpdateDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useUpdateStore.setState({
      phase: 'idle',
      currentVersion: '0.0.0-dev.1',
      latestVersion: undefined,
      releaseNotes: undefined,
      downloadProgress: undefined,
      error: undefined,
      skippedVersions: [],
      dialogOpen: false,
    });
  });

  it('dialogOpen=false 时不渲染', () => {
    render(<UpdateDialog />);
    expect(screen.queryByText('发现新版本')).not.toBeInTheDocument();
  });

  it('phase=available 时显示新版本信息和下载按钮', () => {
    useUpdateStore.setState({
      phase: 'available',
      currentVersion: '0.0.0-dev.1',
      latestVersion: '0.0.0-dev.2',
      releaseNotes: '修复 bug',
      dialogOpen: true,
    });
    render(<UpdateDialog />);
    expect(screen.getByText('发现新版本 v0.0.0-dev.2')).toBeInTheDocument();
    expect(screen.getByText('当前版本：v0.0.0-dev.1')).toBeInTheDocument();
    expect(screen.getByText('修复 bug')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '现在下载' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '跳过本次' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '不再提醒本版本' })).toBeInTheDocument();
  });

  it('点击"现在下载"调用 downloadUpdate', () => {
    const downloadUpdate = vi.fn();
    useUpdateStore.setState({
      phase: 'available',
      latestVersion: '0.0.0-dev.2',
      dialogOpen: true,
      downloadUpdate,
    });
    render(<UpdateDialog />);
    fireEvent.click(screen.getByRole('button', { name: '现在下载' }));
    expect(downloadUpdate).toHaveBeenCalled();
  });

  it('点击"跳过本次"关闭弹窗', () => {
    const closeDialog = vi.fn();
    useUpdateStore.setState({
      phase: 'available',
      latestVersion: '0.0.0-dev.2',
      dialogOpen: true,
      closeDialog,
    });
    render(<UpdateDialog />);
    fireEvent.click(screen.getByRole('button', { name: '跳过本次' }));
    expect(closeDialog).toHaveBeenCalled();
  });

  it('点击"不再提醒本版本"调用 skipVersion', () => {
    const skipVersion = vi.fn();
    useUpdateStore.setState({
      phase: 'available',
      latestVersion: '0.0.0-dev.2',
      dialogOpen: true,
      skipVersion,
    });
    render(<UpdateDialog />);
    fireEvent.click(screen.getByRole('button', { name: '不再提醒本版本' }));
    expect(skipVersion).toHaveBeenCalledWith('0.0.0-dev.2');
  });

  it('phase=downloading 时显示进度条', () => {
    useUpdateStore.setState({
      phase: 'downloading',
      downloadProgress: 65,
      dialogOpen: true,
    });
    render(<UpdateDialog />);
    expect(screen.getAllByText('下载中...')).toHaveLength(2);
    expect(screen.getByText('65%')).toBeInTheDocument();
  });

  it('phase=downloaded 时显示安装按钮', () => {
    const installUpdate = vi.fn();
    useUpdateStore.setState({
      phase: 'downloaded',
      dialogOpen: true,
      installUpdate,
    });
    render(<UpdateDialog />);
    expect(screen.getByRole('button', { name: '安装并重启' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '安装并重启' }));
    expect(installUpdate).toHaveBeenCalled();
  });

  it('phase=not-available 时显示已是最新', () => {
    useUpdateStore.setState({
      phase: 'not-available',
      dialogOpen: true,
    });
    render(<UpdateDialog />);
    expect(screen.getByText('已是最新版本')).toBeInTheDocument();
  });

  it('phase=error 时显示错误信息', () => {
    useUpdateStore.setState({
      phase: 'error',
      error: '检查更新失败，请检查网络连接',
      dialogOpen: true,
    });
    render(<UpdateDialog />);
    expect(screen.getByText('检查更新失败，请检查网络连接')).toBeInTheDocument();
  });
});
