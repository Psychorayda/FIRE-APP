// 应用路由配置 / App router configuration

import { lazy } from 'react';
import { createHashRouter, Navigate } from 'react-router-dom';
import { RequireInit } from './RequireInit.js';
import { AppLayout } from '../components/layout/AppLayout.js';

const OnboardingPage = lazy(() => import('../pages/OnboardingPage.js').then(m => ({ default: m.OnboardingPage })));
const DashboardPage = lazy(() => import('../pages/DashboardPage.js').then(m => ({ default: m.DashboardPage })));
const AccountsPage = lazy(() => import('../pages/AccountsPage.js').then(m => ({ default: m.AccountsPage })));
const TransactionsPage = lazy(() => import('../pages/TransactionsPage.js').then(m => ({ default: m.TransactionsPage })));
const NetWorthPage = lazy(() => import('../pages/NetWorthPage.js').then(m => ({ default: m.NetWorthPage })));
const FireCalculatorPage = lazy(() => import('../pages/FireCalculatorPage.js').then(m => ({ default: m.FireCalculatorPage })));
const SettingsPage = lazy(() => import('../pages/SettingsPage.js').then(m => ({ default: m.SettingsPage })));

export const router = createHashRouter([
  {
    path: '/onboarding',
    element: <OnboardingPage />,
  },
  {
    element: <RequireInit />,
    children: [
      {
        element: <AppLayout />,
        children: [
          { path: '/', element: <DashboardPage /> },
          { path: '/accounts', element: <AccountsPage /> },
          { path: '/transactions', element: <TransactionsPage /> },
          { path: '/net-worth', element: <NetWorthPage /> },
          { path: '/fire-calculator', element: <FireCalculatorPage /> },
          { path: '/settings', element: <SettingsPage /> },
        ],
      },
    ],
  },
  {
    path: '*',
    element: <Navigate to="/" replace />,
  },
]);
