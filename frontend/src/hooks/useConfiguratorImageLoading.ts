import { useEffect, useMemo, useState } from 'react';

const loadedImages = new Set<string>();
const pendingImages = new Map<string, Promise<void>>();

function normaliseSrcs(srcs: Array<string | null | undefined>) {
  return Array.from(new Set(srcs.filter((src): src is string => Boolean(src))));
}

function preloadImage(src: string): Promise<void> {
  if (loadedImages.has(src)) return Promise.resolve();

  const pending = pendingImages.get(src);
  if (pending) return pending;

  const promise = new Promise<void>((resolve) => {
    const image = new Image();
    image.onload = () => {
      loadedImages.add(src);
      pendingImages.delete(src);
      resolve();
    };
    image.onerror = () => {
      loadedImages.add(src);
      pendingImages.delete(src);
      resolve();
    };
    image.src = src;
  });

  pendingImages.set(src, promise);
  return promise;
}

export function useViewerImageLoading(srcs: Array<string | null | undefined>) {
  const stableSrcs = useMemo(() => normaliseSrcs(srcs), [srcs]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const missing = stableSrcs.filter((src) => !loadedImages.has(src));

    if (missing.length === 0) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    Promise.all(missing.map(preloadImage)).then(() => {
      if (!cancelled) setIsLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [stableSrcs]);

  return isLoading;
}

export function useBackgroundImagePreload(
  srcs: Array<string | null | undefined>,
  maxCount = 80,
) {
  const stableSrcs = useMemo(() => normaliseSrcs(srcs).slice(0, maxCount), [srcs, maxCount]);

  useEffect(() => {
    if (stableSrcs.length === 0) return undefined;

    let cancelled = false;
    let index = 0;
    let active = 0;
    const concurrency = 4;

    const run = () => {
      if (cancelled) return;
      while (active < concurrency && index < stableSrcs.length) {
        const src = stableSrcs[index];
        index += 1;
        if (loadedImages.has(src)) continue;
        active += 1;
        preloadImage(src).finally(() => {
          active -= 1;
          run();
        });
      }
    };

    const start = () => {
      if (!cancelled) run();
    };

    const timeout = window.setTimeout(start, 120);
    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
    };
  }, [stableSrcs]);
}
