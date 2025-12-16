
import { defineConfig } from 'vite';

export default defineConfig({
  base: './', // Use relative paths for assets (works on GitHub Pages /repo/ or root)
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    sourcemap: false
  }
});
