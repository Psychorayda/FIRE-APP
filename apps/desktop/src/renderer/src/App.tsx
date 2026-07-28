// 应用根组件：挂载 RouterProvider + 启动时初始化 app-store
// App root: mount RouterProvider + initialize app-store on startup

import { useEffect } from 'react';
import { RouterProvider } from 'react-router-dom';
import { router } from './router/index.js';
import { useAppStore } from './stores/app-store.js';

export default function App() {
  const initialize = useAppStore((s) => s.initialize);

  useEffect(() => {
    initialize();
  }, [initialize]);

  return <RouterProvider router={router} />;
}
