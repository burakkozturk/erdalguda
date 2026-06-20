export type PantFasteningStyle =
  | 'centered'
  | 'no-button'
  | 'off-centered'
  | 'off-centered-buttonless';

export type PantPleatStyle =
  | 'none'
  | 'single-pleated'
  | 'double-pleated';

/** Data-only Pant feature: silhouette fit. No visual effect. */
export type PantFit = 'slim' | 'normal';

/** Data-only Pant feature: leg-end style (cuffed vs straight). No visual effect. */
export type PantLegStyle = 'straight' | 'cuffed';

/** Data-only Pant feature: drape (none/light/full). No visual effect. */
export type PantDrape = 'none' | 'light' | 'full';

export interface PantConfig {
  fasteningStyle: PantFasteningStyle;
  pleatStyle: PantPleatStyle;
  /** Data-only: silhouette fit. No visual effect. */
  fit?: PantFit;
  /** Data-only: leg-end style. No visual effect. */
  legStyle?: PantLegStyle;
  /** Data-only: drape level. No visual effect. */
  drape?: PantDrape;
  fabricKey: string;
  fabricLabel: string;
}

export const DEFAULT_PANT_CONFIG: PantConfig = {
  fasteningStyle: 'centered',
  pleatStyle: 'none',
  fit: 'normal',
  legStyle: 'straight',
  drape: 'none',
  fabricKey: '2191',
  fabricLabel: 'Karels',
};
