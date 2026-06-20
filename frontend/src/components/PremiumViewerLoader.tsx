import './PremiumViewerLoader.css';

interface PremiumViewerLoaderProps {
  active: boolean;
}

export default function PremiumViewerLoader({ active }: PremiumViewerLoaderProps) {
  return (
    <div
      className={active ? 'premium-viewer-loader is-active' : 'premium-viewer-loader'}
      aria-hidden={!active}
    >
      <div className="premium-viewer-loader-ring" />
    </div>
  );
}
