// 应用路由配置 / App router configuration

import { createHashRouter, Navigate } from 'react-router-dom';
import { RequireInit } from './RequireInit.js';
import { AppLayout } from '../components/layout/AppLayout.js';
import { OnboardingPage } from '../pages/OnboardingPage.js';
import { DashboardPage } from '../pages/DashboardPage.js';
import { AccountsPage } from '../pages/AccountsPage.js';
import { TransactionsPage } from '../pages/TransactionsPage.js';
import { NetWorthPage } from '../pages/NetWorthPage.js';
import { FireCalculatorPage } from '../pages/FireCalculatorPage.js';

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
        ],
      },
    ],
  },
  {
    path: '*',
    element: <Navigate to="/" replace />,
  },
]);
