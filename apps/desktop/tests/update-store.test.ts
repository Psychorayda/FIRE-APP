// useUpdateStore 单测 / useUpdateStore unit test

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useUpdateStore } from '@renderer/stores/update-store.js';

// mock window.update API
const mockUpdateApi = {
  check: vi.fn(),
  download: vi.fn(),
  install: vi.fn(),
  skipVersion: vi.fn(),
  getStatus: vi.fn(),
  onStatusChanged: vi.fn().mockReturnValue(() => {}),
};

describe('useUpdateStore', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (window as any).update = mockUpdateApi;
    // 重置 store 状态
    useUpdateStore.setState({
      phase: 'idle',
      currentVersion: '0.0.0',
      latestVersion: undefined,
      releaseNotes: undefined,
      downloadProgress: undefined,
      error: undefined,
      skippedVersions: [],
      dialogOpen: false,
    });
  });

  it('初始状态正确', () => {
    const state = useUpdateStore.getState();
    expect(state.phase).toBe('idle');
    expect(state.dialogOpen).toBe(false);
    expect(state.currentVersion).toBe('0.0.0');
  });

  it('syncStatus 从 main 拉取初始状态', async () => {
    mockUpdateApi.getStatus.mockResolvedValue({
      phase: 'idle',
      currentVersion: '0.0.0-dev.1',
      skippedVersions: [],
    });
    await useUpdateStore.getState().syncStatus();
    const state = useUpdateStore.getState();
    expect(state.currentVersion).toBe('0.0.0-dev.1');
    expect(mockUpdateApi.onStatusChanged).toHaveBeenCalled();
  });

  it('checkForUpdates 调用 window.update.check', async () => {
    mockUpdateApi.check.mockResolvedValue({
      phase: 'not-available',
      currentVersion: '0.0.0-dev.1',
      skippedVersions: [],
    });
    await useUpdateStore.getState().checkForUpdates();
    expect(mockUpdateApi.check).toHaveBeenCalled();
    expect(useUpdateStore.getState().dialogOpen).toBe(true);
  });

  it('phase=available 且版本未跳过时自动打开 dialog', async () => {
    mockUpdateApi.check.mockResolvedValue({
      phase: 'available',
      currentVersion: '0.0.0-dev.1',
      latestVersion: '0.0.0-dev.2',
      skippedVersions: [],
    });
    await useUpdateStore.getState().checkForUpdates();
    expect(useUpdateStore.getState().dialogOpen).toBe(true);
    expect(useUpdateStore.getState().phase).toBe('available');
  });

  it('phase=available 但版本已跳过时不打开 dialog', async () => {
    mockUpdateApi.check.mockResolvedValue({
      phase: 'available',
      currentVersion: '0.0.0-dev.1',
      latestVersion: '0.0.0-dev.2',
      skippedVersions: ['0.0.0-dev.2'],
    });
    await useUpdateStore.getState().checkForUpdates();
    expect(useUpdateStore.getState().dialogOpen).toBe(false);
  });

  it('downloadUpdate 调用 window.update.download', async () => {
    mockUpdateApi.download.mockResolvedValue(undefined);
    await useUpdateStore.getState().downloadUpdate();
    expect(mockUpdateApi.download).toHaveBeenCalled();
  });

  it('installUpdate 调用 window.update.install', async () => {
    mockUpdateApi.install.mockResolvedValue(undefined);
    await useUpdateStore.getState().installUpdate();
    expect(mockUpdateApi.install).toHaveBeenCalled();
  });

  it('skipVersion 调用 window.update.skipVersion', async () => {
    mockUpdateApi.skipVersion.mockResolvedValue(undefined);
    await useUpdateStore.getState().skipVersion('0.0.0-dev.2');
    expect(mockUpdateApi.skipVersion).toHaveBeenCalledWith('0.0.0-dev.2');
  });

  it('closeDialog 设置 dialogOpen=false', () => {
    useUpdateStore.setState({ dialogOpen: true });
    useUpdateStore.getState().closeDialog();
    expect(useUpdateStore.getState().dialogOpen).toBe(false);
  });

  it('openDialog 设置 dialogOpen=true', () => {
    useUpdateStore.getState().openDialog();
    expect(useUpdateStore.getState().dialogOpen).toBe(true);
  });
});
