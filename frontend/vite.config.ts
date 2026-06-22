import fs from 'node:fs/promises';
import path from 'node:path';
import { defineConfig, type Plugin, type ResolvedConfig } from 'vite';
import react from '@vitejs/plugin-react';
import sharp from 'sharp';

const RASTER_IMAGE_RE = /\.(png|jpe?g)$/i;
const TEXT_ASSET_RE = /\.(html|js|mjs|css|json|svg|txt|xml|webmanifest)$/i;
const USED_MEASUREMENT_MEDIA_ORDERS = new Set([
  1, 3, 4, 5, 6, 7, 8, 9, 10, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 34, 35, 36, 37, 38, 39,
]);

async function walkFiles(dir: string): Promise<string[]> {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map(async (entry) => {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        return walkFiles(fullPath);
      }
      return entry.isFile() ? [fullPath] : [];
    }),
  );

  return nested.flat();
}

async function mapWithConcurrency<T>(items: T[], limit: number, worker: (item: T) => Promise<void>) {
  let index = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (index < items.length) {
      const currentIndex = index;
      index += 1;
      await worker(items[currentIndex] as T);
    }
  });

  await Promise.all(workers);
}

function webpAssetOptimizer(): Plugin {
  let config: ResolvedConfig;

  return {
    name: 'webp-asset-optimizer',
    apply: 'build',
    enforce: 'post',
    configResolved(resolvedConfig) {
      config = resolvedConfig;
    },
    async writeBundle() {
      const outDir = path.resolve(config.root, config.build.outDir);
      const files = await walkFiles(outDir);
      const prunedFiles = new Set<string>();

      await mapWithConcurrency(files, 32, async (file) => {
        const relativePath = path.relative(outDir, file).split(path.sep).join('/');
        const measurementMatch = relativePath.match(/^assets\/measurement_media\/(\d+)[^/]*\//);
        const isUnusedMeasurementMedia =
          measurementMatch && !USED_MEASUREMENT_MEDIA_ORDERS.has(Number(measurementMatch[1]));
        const isBuildOnlyHelper = relativePath.endsWith('_zones.py');

        if (isUnusedMeasurementMedia || isBuildOnlyHelper) {
          await fs.unlink(file);
          prunedFiles.add(file);
        }
      });

      // RESİM DÖNÜŞTÜRME KISMI İPTAL EDİLDİ
      // Sadece gereksiz dosyaları silecek, orijinal resimlere dokunmayacak.
      
      config.logger.info(`pruned ${prunedFiles.size} unused build assets`);
    },
  };
}

export default defineConfig({
  // DİKKAT: webpAssetOptimizer() BURADAN KALDIRILDI! Sadece react() var.
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api/fabrics/generate': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true,
      },
    },
  },
  build: {
    assetsInlineLimit: 0,
    cssCodeSplit: true,
    sourcemap: false,
    chunkSizeWarningLimit: 900,
    rollupOptions: {
      output: {
        assetFileNames: (assetInfo) => {
          const name = assetInfo.names?.[0] ?? assetInfo.name ?? '';

          if (/\.(png|jpe?g|webp|avif|gif|svg)$/i.test(name)) {
            return 'assets/images/[name]-[hash][extname]';
          }

          if (/\.(woff2?|ttf|otf|eot)$/i.test(name)) {
            return 'assets/fonts/[name]-[hash][extname]';
          }

          return 'assets/[name]-[hash][extname]';
        },
        chunkFileNames: 'assets/js/[name]-[hash].js',
        entryFileNames: 'assets/js/[name]-[hash].js',
        manualChunks(id) {
          if (id.includes('node_modules/react') || id.includes('node_modules/react-dom')) {
            return 'react-vendor';
          }

          if (id.includes('/src/components/') && id.includes('Configurator')) {
            return 'configurators';
          }

          if (id.includes('/src/pages/admin/')) {
            return 'admin';
          }

          if (id.includes('/src/pages/public/')) {
            return 'public-site';
          }
        },
      },
    },
  },
});
