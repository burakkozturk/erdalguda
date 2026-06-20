/** Data-only Shirt feature: silhouette fit. No visual effect. */
export type ShirtFit = 'slim' | 'normal';

export interface ShirtConfig {
  collarStyle: string;
  collarButtons: '1' | '2';
  cuffStyle: string;
  /** Data-only: silhouette fit. No visual effect. */
  fit?: ShirtFit;
  fabricKey: string;
  fabricLabel: string;
}
