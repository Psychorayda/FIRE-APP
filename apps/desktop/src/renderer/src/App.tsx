// 应用根组件：挂载 RouterProvider + 启动时初始化 app-store + 自动更新
// App root: mount RouterProvider + initialize app-store + auto-update on startup

import { Suspense, useEffect } from 'react';
import { RouterProvider } from 'react-router-dom';
import { ErrorBoundary } from './components/base/ErrorBoundary.js';
import { UpdateDialog } from './components/auxiliary/UpdateDialog.js';
import { router } from './router/index.js';
import { useAppStore } from './stores/app-store.js';
import { useToastStore } from './stores/toast-store.js';
import { useUpdateStore } from './stores/update-store.js';

export default function App() {
  const initialize = useAppStore((s) => s.initialize);
  const syncUpdateStatus = useUpdateStore((s) => s.syncStatus);
  const showError = useToastStore((s) => s.showError);

  useEffect(() => {
    initialize();
    // 启动时同步更新状态 + 订阅 main 进程事件
    // Sync update status on startup + subscribe to main process events
    syncUpdateStatus();
  }, [initialize, syncUpdateStatus]);

  // 订阅数据库降级重建事件：明确提示用户，非静默回 Onboarding
  // Subscribe to DB degraded-rebuild event: explicit notice, not silent Onboarding redirect
  useEffect(() => {
    const unsubscribe = window.dataAccess.onCorruptedRecovered((info) => {
      showError(
        `数据库已损坏并已备份（${info.backupPath}），请联系支持恢复。当前已创建新空库。`,
        15000,
      );
    });
    return unsubscribe;
  }, [showError]);

  return (
    <ErrorBoundary>
      <Suspense fallback={<div className="p-8 text-gray-500">加载中...</div>}>
        <RouterProvider router={router} />
      </Suspense>
      <UpdateDialog />
    </ErrorBoundary>
  );
}
