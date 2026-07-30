// useCurrency hook / 货币 hook
// 从 app store 读取当前用户的 base_currency，未登录时回退到 CNY
// Reads current user's base_currency from app store; falls back to CNY when not logged in

import { useAppStore } from '../stores/app-store.js';

export function useCurrency(): string {
  return useAppStore((s) => s.currentUser?.base_currency ?? 'CNY');
}
