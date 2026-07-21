import { cp, mkdir, rename, rm, copyFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { defineConfig } from 'vite';

const rootDir = dirname(fileURLToPath(import.meta.url));

function chronaStaticPlugin() {
  return {
    name: 'chrona-static-layout',
    async closeBundle() {
      const distDir = resolve(rootDir, 'dist');
      await mkdir(distDir, { recursive: true });

      await rename(resolve(distDir, 'public/index.html'), resolve(distDir, 'index.html')).catch(() => {});
      await rm(resolve(distDir, 'public'), { recursive: true, force: true });

      await Promise.all([
        copyFile(resolve(rootDir, 'public/manifest.json'), resolve(distDir, 'manifest.json')),
        copyFile(resolve(rootDir, 'public/sw.js'), resolve(distDir, 'sw.js')),
        copyFile(resolve(rootDir, 'public/styles.css'), resolve(distDir, 'styles.css')),
        cp(resolve(rootDir, 'public/icons'), resolve(distDir, 'icons'), { recursive: true }),
      ]);
    },
  };
}

export default defineConfig({
  publicDir: false,
  server: {
    open: '/public/index.html',
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        index: resolve(rootDir, 'public/index.html'),
        admin: resolve(rootDir, 'admin.html'),
      },
    },
  },
  plugins: [chronaStaticPlugin()],
});
