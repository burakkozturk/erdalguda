export type LapelStyle = 'notch' | 'peak' | 'shawl';
export type LapelWidth = 'narrow' | 'medium' | 'wide';

export type TuxedoStyle =
  | 'single_breasted_1'
  | 'single_breasted_2'
  | 'double_breasted_2'
  | 'double_breasted_4'
  | 'double_breasted_6';

export type PocketStyle =
  | 'no_pocket'
  | 'double_welt'
  | 'double_welt_third'
  | 'with_flap'
  | 'with_flap_third';

export interface TuxedoConfig {
  style: TuxedoStyle;
  lapelStyle: LapelStyle;
  lapelWidth: LapelWidth;
  pocketStyle: PocketStyle;
  fabricKey: string;
  fabricLabel: string;
}
