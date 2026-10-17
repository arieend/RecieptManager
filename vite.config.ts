import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, loadEnv} from 'vite';
import { configDefaults } from 'vitest/config';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig(({mode}) => {
  const env = loadEnv(mode, '.', '');
  return {
    plugins: [
      react(), 
      tailwindcss(),
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'mask-icon.svg'],
        manifest: {
          name: 'Receipt Manager AI',
          short_name: 'ReceiptAI',
          description: 'AI-powered receipt management and expense splitting',
          theme_color: '#059669',
          background_color: '#ffffff',
          display: 'standalone',
          start_url: '/',
          icons: [
            {
              src: 'https://picsum.photos/seed/receipt-192/192/192',
              sizes: '192x192',
              type: 'image/png'
            },
            {
              src: 'https://picsum.photos/seed/receipt-512/512/512',
              sizes: '512x512',
              type: 'image/png'
            },
            {
              src: 'https://picsum.photos/seed/receipt-512/512/512',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'any maskable'
            }
          ]
        }
      })
    ],
    define: {
      'process.env.GEMINI_API_KEY': JSON.stringify(process.env.GEMINI_API_KEY || env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY || env.VITE_GEMINI_API_KEY),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
    },
    test: {
      globals: true,
      environment: 'jsdom',
      setupFiles: './src/test/setup.ts',
      // Each test sets its own mock behaviour; none leaks from an earlier test.
      mockReset: true,
      // Agent worktrees under .claude/ hold other branches' tests; check only this checkout.
      exclude: [...configDefaults.exclude, '.claude/**'],
      coverage: {
        provider: 'v8',
        // TESTING.md: services and utility helpers carry the coverage bar.
        include: ['src/services/**/*.ts', 'src/utils/**/*.ts'],
        exclude: ['**/*.test.ts'],
        reporter: ['text-summary', 'text'],
        // Floors at today's coverage, not the 100% goal: raise them as tests land.
        thresholds: {
          statements: 42,
          branches: 36,
          functions: 50,
          lines: 43,
          'src/services/**/*.ts': { statements: 79, branches: 59, functions: 88, lines: 80 },
        },
      },
    },
  };
});
