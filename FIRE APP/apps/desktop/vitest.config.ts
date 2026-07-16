// vitest 配置：jsdom 环境 + React 插件 + alias + setupFiles
// vitest config: jsdom environment + React plugin + alias + setupFiles

import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
    include: ['tests/**/*.test.{ts,tsx}'],
    pool: 'threads',
    poolOptions: { threads: { singleThread: true } },
  },
  resolve: {
    alias: {
      '@shared': resolve(__dirname, '../../packages/shared/src'),
      '@renderer': resolve(__dirname, 'src/renderer/src'),
    },
  },
});
