// Vite-safe eager glob import of all gallery images.
// Sorted numerically by the number in the filename (erdalguda-1.jpg → 1, etc.).

const modules = import.meta.glob('../assets/imgs/*.{jpg,jpeg,png,webp}', {
  eager: true,
});

function extractNumber(path: string): number {
  const match = path.match(/erdalguda-(\d+)/);
  return match ? parseInt(match[1], 10) : 0;
}

export const galleryImages: string[] = Object.entries(modules)
  .sort(([pathA], [pathB]) => extractNumber(pathA) - extractNumber(pathB))
  .map(([, mod]) => (mod as { default: string }).default);
