// 仪表盘页（简单占位） / Dashboard page (simple placeholder)

import { useAppStore } from '../stores/app-store.js';

export function DashboardPage() {
  const currentUser = useAppStore((s) => s.currentUser);

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold text-gray-900">仪表盘</h1>
      <div className="mt-4 bg-white rounded-lg shadow-sm p-6">
        <p className="text-gray-700">
          欢迎回来，{currentUser?.display_name ?? '用户'}！
        </p>
        <p className="text-gray-500 mt-2 text-sm">
          各功能模块将在后续里程碑逐步开放。
        </p>
      </div>
    </div>
  );
}
