
import { defineConfig } from 'vite';

export default defineConfig({
  base: '/Prismata/', // Explicit base path for GitHub Pages
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    sourcemap: false
  }
});
