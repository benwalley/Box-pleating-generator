import { defineConfig } from 'vite';

export default defineConfig({
  // Relative base so the built app works from any folder or static host.
  base: './',
  build: {
    target: 'es2022',
    sourcemap: true,
  },
});
