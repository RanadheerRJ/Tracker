import { readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

const roots = ['src', 'firebase-config.js', 'vite.config.js'];

async function collectJs(path) {
  if (path.endsWith('.js') || path.endsWith('.mjs')) return [path];
  const entries = await readdir(path, { withFileTypes: true });
  const files = await Promise.all(
    entries.map((entry) => {
      const child = join(path, entry.name);
      if (entry.isDirectory()) return collectJs(child);
      if (entry.isFile() && (entry.name.endsWith('.js') || entry.name.endsWith('.mjs'))) return [child];
      return [];
    }),
  );
  return files.flat();
}

const files = (await Promise.all(roots.map((root) => collectJs(root)))).flat();
let failed = false;
for (const file of files) {
  const result = spawnSync(process.execPath, ['--check', file], { stdio: 'inherit' });
  if (result.status !== 0) failed = true;
}
if (failed) process.exit(1);
