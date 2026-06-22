export type CoatStyle = 'overcoat' | 'double_breasted' | 'funnel_neck' | 'pea_coat' | 'duffle_coat';
export type CoatLapelStyle = 'notch' | 'peak' | 'rounded' | 'ulster';
export type CoatLapelLength = 'classic' | 'long';
export type CoatLapelWidth = 'standard' | 'wide';
export type CoatFastening = 'boton_standard' | 'boton_hide' | 'trench';
export type CoatPocketStyle = 'flap' | 'flap_3' | 'double_welt' | 'double_welt_3' | 'diagonal' | 'patched';

export interface CoatConfig {
  style: CoatStyle;
  lapelStyle: CoatLapelStyle;
  lapelWidth: CoatLapelWidth;
  lapelLength: CoatLapelLength;
  fastening: CoatFastening;
  pocketStyle: CoatPocketStyle;
  fabricKey: string;
  fabricLabel: string;
}

export interface CoatInternalParams {
  internalStyle: 'simple' | 'crossed';
  collarStyle: 'flap' | 'classic' | 'standup';
  defaultLapelLength: CoatLapelLength;
  hasLapel: boolean;
  hasLapelWidth: boolean;
  hasLapelLength: boolean;
  hasFastening: boolean;
}

export const COAT_STYLE_PARAMS: Record<CoatStyle, CoatInternalParams> = {
  overcoat:        { internalStyle: 'simple',  collarStyle: 'flap',    defaultLapelLength: 'long',    hasLapel: true,  hasLapelWidth: true,  hasLapelLength: true,  hasFastening: true  },
  double_breasted: { internalStyle: 'crossed', collarStyle: 'flap',    defaultLapelLength: 'classic', hasLapel: true,  hasLapelWidth: false, hasLapelLength: false, hasFastening: false },
  funnel_neck:     { internalStyle: 'simple',  collarStyle: 'standup', defaultLapelLength: 'long',    hasLapel: false, hasLapelWidth: false, hasLapelLength: false, hasFastening: false },
  pea_coat:        { internalStyle: 'simple',  collarStyle: 'flap',    defaultLapelLength: 'classic', hasLapel: true,  hasLapelWidth: true,  hasLapelLength: true,  hasFastening: true  },
  duffle_coat:     { internalStyle: 'simple',  collarStyle: 'standup', defaultLapelLength: 'classic', hasLapel: false, hasLapelWidth: false, hasLapelLength: false, hasFastening: false },
};

export function inferCoatStyle(
  coatStyle?: string | null,
  collarStyle?: string | null,
  lapelLength?: string | null,
): CoatStyle {
  if (coatStyle === 'crossed') return 'double_breasted';
  if (collarStyle === 'standup') return lapelLength === 'long' ? 'funnel_neck' : 'duffle_coat';
  if (lapelLength === 'long') return 'overcoat';
  return 'pea_coat';
}

export const DEFAULT_COAT_CONFIG: CoatConfig = {
  style: 'overcoat',
  lapelStyle: 'peak',
  lapelWidth: 'standard',
  lapelLength: 'long',
  fastening: 'boton_standard',
  pocketStyle: 'flap',
  fabricKey: '2191',
  fabricLabel: 'Karels',
};
