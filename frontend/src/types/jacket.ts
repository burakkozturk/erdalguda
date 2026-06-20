/** Data-only Jacket/Suit feature: silhouette fit. Does not affect the
 *  rendered PNG layer composition — pure order payload field. */
export type JacketFit = 'slim' | 'regular';

/** Data-only Jacket/Suit feature: back vent style. Does not affect the
 *  rendered PNG layer composition — pure order payload field. */
export type JacketVent = 'single' | 'double' | 'none';

export interface JacketConfig {
  styleKey: string;
  lapelStyle: string;
  lapelWidth: string;
  pocketStyle: string;
  /** Data-only: silhouette fit (slim/regular). No visual effect. */
  fit?: JacketFit;
  /** Data-only: back vent style (single/double/none). No visual effect. */
  vent?: JacketVent;
  fabricKey: string;
  fabricLabel: string;
}
