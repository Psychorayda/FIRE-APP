// 架构验证页面 / Architecture validation page
// 验证 IPC 桥 + 数据层 + React 渲染的完整数据通路

import { useEffect } from 'react';
import { useUserStore } from '../stores/user-store';

export function TestPage() {
  const { user, loading, error, fetchUser, createUser } = useUserStore();

  useEffect(() => {
    fetchUser();
  }, [fetchUser]);

  const handleCreateUser = () => {
    createUser({
      display_name: '测试用户',
      is_china_market: 1,
    });
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">
          FIRE 计算APP — 架构验证
        </h1>

        {/* 状态指示器 / Status indicator */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-700 mb-4">数据通路验证</h2>

          {loading && (
            <p className="text-blue-600">加载中...</p>
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 rounded p-4">
              <p className="text-red-600 font-medium">错误: {error}</p>
            </div>
          )}

          {!loading && !error && user && (
            <div className="bg-green-50 border border-green-200 rounded p-4">
              <p className="text-green-700 font-medium">✓ IPC 桥验证通过</p>
              <p className="text-gray-600 mt-2">用户名: {user.display_name}</p>
              <p className="text-gray-600">货币: {user.base_currency}</p>
              <p className="text-gray-600">中国市场: {user.is_china_market ? '是' : '否'}</p>
              <p className="text-gray-600">用户 ID: {user.id}</p>
            </div>
          )}

          {!loading && !error && !user && (
            <div className="bg-amber-50 border border-amber-200 rounded p-4">
              <p className="text-amber-700 font-medium">无用户记录（首次启动）</p>
              <button
                onClick={handleCreateUser}
                className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition"
              >
                创建测试用户 + 种子分类
              </button>
            </div>
          )}
        </div>

        {/* 技术栈验证清单 / Tech stack checklist */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h2 className="text-lg font-semibold text-gray-700 mb-4">技术栈验证</h2>
          <ul className="space-y-2 text-gray-600">
            <li>✓ Electron 主进程启动</li>
            <li>✓ better-sqlite3 数据库连接</li>
            <li>✓ IPC 桥（ipcMain.handle → contextBridge）</li>
            <li>✓ React 19 渲染进程</li>
            <li>✓ Zustand 状态管理</li>
            <li>✓ Tailwind CSS 样式</li>
            {user && <li>✓ 数据层 CRUD（用户创建 + 种子分类）</li>}
          </ul>
        </div>
      </div>
    </div>
  );
}
