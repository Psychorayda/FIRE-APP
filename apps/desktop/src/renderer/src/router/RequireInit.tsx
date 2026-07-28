// 路由守卫：未初始化时重定向到 /onboarding
// Route guard: redirect to /onboarding if not initialized

import { Navigate, Outlet } from 'react-router-dom';
import { useAppStore } from '../stores/app-store.js';

export function RequireInit() {
  const initialized = useAppStore((s) => s.initialized);

  if (!initialized) {
    return <Navigate to="/onboarding" replace />;
  }

  return <Outlet />;
}
