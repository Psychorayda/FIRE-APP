// 自动更新对话框 / Auto-update dialog
// 根据 phase 显示不同内容：新版本信息 / 下载进度 / 安装按钮 / 错误信息

import { useUpdateStore } from '../../stores/update-store.js';

export function UpdateDialog() {
  const phase = useUpdateStore((s) => s.phase);
  const currentVersion = useUpdateStore((s) => s.currentVersion);
  const latestVersion = useUpdateStore((s) => s.latestVersion);
  const releaseNotes = useUpdateStore((s) => s.releaseNotes);
  const downloadProgress = useUpdateStore((s) => s.downloadProgress);
  const error = useUpdateStore((s) => s.error);
  const dialogOpen = useUpdateStore((s) => s.dialogOpen);

  const downloadUpdate = useUpdateStore((s) => s.downloadUpdate);
  const installUpdate = useUpdateStore((s) => s.installUpdate);
  const skipVersion = useUpdateStore((s) => s.skipVersion);
  const closeDialog = useUpdateStore((s) => s.closeDialog);

  if (!dialogOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
        {/* 标题 */}
        {phase === 'available' && (
          <h2 className="mb-2 text-lg font-semibold text-gray-900">
            {`发现新版本 v${latestVersion}`}
          </h2>
        )}
        {phase === 'downloading' && (
          <h2 className="mb-2 text-lg font-semibold text-gray-900">下载更新</h2>
        )}
        {phase === 'downloaded' && (
          <h2 className="mb-2 text-lg font-semibold text-gray-900">下载完成</h2>
        )}
        {phase === 'not-available' && (
          <h2 className="mb-2 text-lg font-semibold text-gray-900">已是最新版本</h2>
        )}
        {phase === 'error' && (
          <h2 className="mb-2 text-lg font-semibold text-gray-900">更新失败</h2>
        )}

        {/* 内容 */}
        {phase === 'available' && (
          <div className="mb-4 space-y-2">
            <p className="text-sm text-gray-600">{`当前版本：v${currentVersion}`}</p>
            {releaseNotes && (
              <div>
                <p className="mb-1 text-sm font-medium text-gray-700">更新内容：</p>
                <pre className="max-h-40 overflow-auto whitespace-pre-wrap rounded bg-gray-50 p-2 text-xs text-gray-600">
                  {releaseNotes}
                </pre>
              </div>
            )}
          </div>
        )}

        {phase === 'downloading' && (
          <div className="mb-4">
            <p className="mb-2 text-sm text-gray-600">下载中...</p>
            <div className="h-2 w-full overflow-hidden rounded-full bg-gray-200">
              <div
                className="h-full bg-blue-600 transition-all"
                style={{ width: `${downloadProgress ?? 0}%` }}
              />
            </div>
            <p className="mt-1 text-right text-xs text-gray-500">{`${downloadProgress ?? 0}%`}</p>
          </div>
        )}

        {phase === 'downloaded' && (
          <p className="mb-4 text-sm text-gray-600">
            新版本已下载完成，点击"安装并重启"立即安装。
          </p>
        )}

        {phase === 'not-available' && (
          <p className="mb-4 text-sm text-gray-600">
            {`当前版本 v${currentVersion} 已是最新。`}
          </p>
        )}

        {phase === 'error' && (
          <p className="mb-4 text-sm text-red-600">{error ?? '更新检查失败'}</p>
        )}

        {/* 按钮 */}
        <div className="flex justify-end gap-2">
          {phase === 'available' && (
            <>
              <button
                onClick={() => skipVersion(latestVersion!)}
                className="rounded-md px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100"
              >
                不再提醒本版本
              </button>
              <button
                onClick={closeDialog}
                className="rounded-md px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100"
              >
                跳过本次
              </button>
              <button
                onClick={downloadUpdate}
                className="rounded-md bg-blue-600 px-3 py-1.5 text-sm text-white hover:bg-blue-700"
              >
                现在下载
              </button>
            </>
          )}

          {phase === 'downloading' && (
            <button
              disabled
              className="cursor-not-allowed rounded-md bg-gray-300 px-3 py-1.5 text-sm text-gray-500"
            >
              下载中...
            </button>
          )}

          {phase === 'downloaded' && (
            <>
              <button
                onClick={closeDialog}
                className="rounded-md px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100"
              >
                稍后
              </button>
              <button
                onClick={installUpdate}
                className="rounded-md bg-blue-600 px-3 py-1.5 text-sm text-white hover:bg-blue-700"
              >
                安装并重启
              </button>
            </>
          )}

          {(phase === 'not-available' || phase === 'error') && (
            <button
              onClick={closeDialog}
              className="rounded-md bg-blue-600 px-3 py-1.5 text-sm text-white hover:bg-blue-700"
            >
              关闭
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
