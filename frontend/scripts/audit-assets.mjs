import fs from 'node:fs/promises';
import path from 'node:path';

const roots = process.argv.slice(2);
const targets = roots.length > 0 ? roots : ['dist'];

const IMAGE_EXTENSIONS = new Set(['.avif', '.gif', '.jpeg', '.jpg', '.png', '.svg', '.webp']);

async function exists(target) {
  try {
    await fs.access(target);
    return true;
  } catch {
    return false;
  }
}

async function collectFiles(root) {
  const entries = await fs.readdir(root, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map(async (entry) => {
      const fullPath = path.join(root, entry.name);

      if (entry.isDirectory()) {
        return collectFiles(fullPath);
      }

      if (entry.isFile()) {
        const stat = await fs.stat(fullPath);
        return [{ path: fullPath, size: stat.size }];
      }

      if (entry.isSymbolicLink()) {
        const stat = await fs.stat(fullPath);
        if (stat.isDirectory()) {
          return collectFiles(fullPath);
        }

        if (stat.isFile()) {
          return [{ path: fullPath, size: stat.size }];
        }
      }

      return [];
    }),
  );

  return nested.flat();
}

function formatBytes(bytes) {
  const units = ['B', 'KB', 'MB', 'GB'];
  let size = bytes;
  let index = 0;

  while (size >= 1024 && index < units.length - 1) {
    size /= 1024;
    index += 1;
  }

  return `${size.toFixed(size >= 10 || index === 0 ? 0 : 1)} ${units[index]}`;
}

const files = [];

for (const target of targets) {
  if (await exists(target)) {
    files.push(...(await collectFiles(target)));
  }
}

const total = files.reduce((sum, file) => sum + file.size, 0);
const imageTotal = files
  .filter((file) => IMAGE_EXTENSIONS.has(path.extname(file.path).toLowerCase()))
  .reduce((sum, file) => sum + file.size, 0);

const byExtension = files.reduce((result, file) => {
  const ext = path.extname(file.path).toLowerCase() || '[no extension]';
  result.set(ext, (result.get(ext) ?? 0) + file.size);
  return result;
}, new Map());

console.log(`Targets: ${targets.join(', ')}`);
console.log(`Total: ${formatBytes(total)}`);
console.log(`Images: ${formatBytes(imageTotal)}`);

console.log('\nLargest files:');
files
  .sort((a, b) => b.size - a.size)
  .slice(0, 25)
  .forEach((file) => {
    console.log(`${formatBytes(file.size).padStart(8)}  ${file.path}`);
  });

console.log('\nBy extension:');
Array.from(byExtension.entries())
  .sort(([, a], [, b]) => b - a)
  .forEach(([ext, size]) => {
    console.log(`${formatBytes(size).padStart(8)}  ${ext}`);
  });
