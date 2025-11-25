import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@proto': path.resolve(__dirname, '../..', 'packages/proto'),
      '@tauri-apps/api': path.resolve(__dirname, 'node_modules', '@tauri-apps', 'api'),
    },
  },
  server: {
    port: 5173,
    strictPort: true,
    fs: {
      allow: [path.resolve(__dirname, '..', '..')],
    },
  },
  clearScreen: false,
});
