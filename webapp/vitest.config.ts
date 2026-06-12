import path from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['convex/**/*.test.ts'],
  },
  resolve: {
    alias: {
      '@convex': path.resolve(__dirname, './convex'),
    },
  },
});
