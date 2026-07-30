// 应用根组件：挂载 RouterProvider + 启动时初始化 app-store + 自动更新
// App root: mount RouterProvider + initialize app-store + auto-update on startup

import { Suspense, useEffect } from 'react';
import { RouterProvider } from 'react-router-dom';
import { ErrorBoundary } from './components/base/ErrorBoundary.js';
import { UpdateDialog } from './components/auxiliary/UpdateDialog.js';
import { router } from './router/index.js';
import { useAppStore } from './stores/app-store.js';
import { useUpdateStore } from './stores/update-store.js';

export default function App() {
  const initialize = useAppStore((s) => s.initialize);
  const syncUpdateStatus = useUpdateStore((s) => s.syncStatus);

  useEffect(() => {
    initialize();
    // 启动时同步更新状态 + 订阅 main 进程事件
    // Sync update status on startup + subscribe to main process events
    syncUpdateStatus();
  }, [initialize, syncUpdateStatus]);

  return (
    <ErrorBoundary>
      <Suspense fallback={<div className="p-8 text-gray-500">加载中...</div>}>
        <RouterProvider router={router} />
      </Suspense>
      <UpdateDialog />
    </ErrorBoundary>
  );
}
