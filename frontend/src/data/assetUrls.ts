const DEFAULT_S3_ASSET_BASE_URL = 'https://erdalguda-assets.s3.eu-north-1.amazonaws.com';

export const S3_ASSET_BASE_URL =
  import.meta.env.VITE_S3_ASSET_BASE_URL || DEFAULT_S3_ASSET_BASE_URL;

function encodeKey(key: string) {
  return key
    .split('/')
    .filter(Boolean)
    .map((part) => encodeURIComponent(part))
    .join('/');
}

export function generatedLayerUrl(
  garment: string,
  fabricId: string,
  file: string,
  version?: string | number,
) {
  const key = encodeKey(`${garment}/generated/${fabricId}/${file}`);
  const suffix = version === undefined ? '' : `?v=${encodeURIComponent(String(version))}`;
  return `${S3_ASSET_BASE_URL.replace(/\/$/, '')}/${key}${suffix}`;
}
