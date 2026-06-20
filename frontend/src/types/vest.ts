export type VestLapelStyle =
  | 'single-4btn-narrow-notch'
  | 'single-4btn-narrow-peak'
  | 'single-4btn-medium-notch'
  | 'single-4btn-medium-peak'
  | 'single-4btn-shawl'
  | 'single-4btn-no'
  | 'single-5btn-narrow-notch'
  | 'single-5btn-narrow-peak'
  | 'single-5btn-medium-notch'
  | 'single-5btn-medium-peak'
  | 'single-5btn-shawl'
  | 'single-5btn-no'
  | 'double-6btn-narrow-notch'
  | 'double-6btn-narrow-peak'
  | 'double-6btn-medium-notch'
  | 'double-6btn-medium-peak'
  | 'double-6btn-shawl'
  | 'double-6btn-no';

export type VestStylePrefix =
  | 'single-4btn'
  | 'single-5btn'
  | 'double-6btn';

export type VestLapelWidth = 'narrow' | 'medium';
export type VestLapelShape = 'notch' | 'peak' | 'shawl' | 'no';

export interface VestConfig {
  stylePrefix: VestStylePrefix;
  lapelWidth: VestLapelWidth;
  lapelShape: VestLapelShape;
  fabricKey: string;
  fabricLabel: string;
}

export function vestLapelKey(config: VestConfig): VestLapelStyle {
  if (config.lapelShape === 'shawl' || config.lapelShape === 'no') {
    return `${config.stylePrefix}-${config.lapelShape}` as VestLapelStyle;
  }
  return `${config.stylePrefix}-${config.lapelWidth}-${config.lapelShape}` as VestLapelStyle;
}

export const DEFAULT_VEST_CONFIG: VestConfig = {
  stylePrefix: 'single-4btn',
  lapelWidth: 'medium',
  lapelShape: 'notch',
  fabricKey: '2191',
  fabricLabel: 'Karels',
};
