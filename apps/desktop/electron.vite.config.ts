import { resolve } from 'path';
import { defineConfig, externalizeDepsPlugin } from 'electron-vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// 不 external 的依赖：会被打包进 out/ 产物（解决 monorepo workspace 符号链接打包问题）
// Deps NOT externalized: bundled into out/ (fixes monorepo workspace symlink packaging)
const noExternal = ['@fire-app/shared'];

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin({ exclude: noExternal })],
    resolve: {
      alias: {
        '@shared': resolve(__dirname, '../../packages/shared/src'),
      },
    },
  },
  preload: {
    plugins: [externalizeDepsPlugin({ exclude: noExternal })],
    resolve: {
      alias: {
        '@shared': resolve(__dirname, '../../packages/shared/src'),
      },
    },
  },
  renderer: {
    resolve: {
      alias: {
        '@renderer': resolve(__dirname, 'src/renderer/src'),
        '@shared': resolve(__dirname, '../../packages/shared/src'),
      },
    },
    plugins: [react(), tailwindcss()],
    build: {
      rollupOptions: {
        output: {
          manualChunks: {
            'react-vendor': ['react', 'react-dom', 'react-router-dom'],
            'recharts': ['recharts'],
            'zustand': ['zustand'],
          },
        },
      },
    },
  },
});
