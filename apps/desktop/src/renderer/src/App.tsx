// 应用根组件：挂载 RouterProvider + 启动时初始化 app-store
// App root: mount RouterProvider + initialize app-store on startup

import { Suspense, useEffect } from 'react';
import { RouterProvider } from 'react-router-dom';
import { ErrorBoundary } from './components/base/ErrorBoundary.js';
import { router } from './router/index.js';
import { useAppStore } from './stores/app-store.js';

export default function App() {
  const initialize = useAppStore((s) => s.initialize);

  useEffect(() => {
    initialize();
  }, [initialize]);

  return (
    <ErrorBoundary>
      <Suspense fallback={<div className="p-8 text-gray-500">加载中...</div>}>
        <RouterProvider router={router} />
      </Suspense>
    </ErrorBoundary>
  );
}
