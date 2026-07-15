// 应用主布局：侧边栏 + 内容区 + Toast
// App layout: sidebar + content area + toast

import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar.js';
import { Toast } from '../auxiliary/Toast.js';

export function AppLayout() {
  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar />
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
      <Toast />
    </div>
  );
}
