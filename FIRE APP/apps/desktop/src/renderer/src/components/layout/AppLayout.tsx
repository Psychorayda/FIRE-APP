// 临时占位 AppLayout（Task 4 替换为完整版本）
import { Outlet } from 'react-router-dom';

export function AppLayout() {
  return (
    <div className="flex h-screen bg-gray-50">
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  );
}
