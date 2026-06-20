/**
 * Icon mapping registry for the configurator UI.
 *
 * The PNG icons live under /public/icons/configurator/<category>/<name>.png
 * (copied from the project's icon library). This file maps semantic option
 * values used by each configurator's state to the icon files.
 *
 * IMPORTANT: This mapping is UI-only. The visual layer composition in each
 * configurator (lapel matching, pocket matching, collar/cuff rendering) is
 * driven by the SAME state keys as before — we only restyle the inputs.
 */

const ROOT = '/icons/configurator';

// -----------------------------------------------------------------------------
// JACKET / SUIT — visual features (already affect layer composition)
// -----------------------------------------------------------------------------

/** Breast-style + button-count → button silhouette icon. */
export const JACKET_BUTTON_ICONS = {
  'single-1': `${ROOT}/ceket-stil/tek-dugme.png`,
  'single-2': `${ROOT}/ceket-stil/iki-dugme.png`,
  'single-3': `${ROOT}/ceket-stil/uc-dugme.png`,
  'double-2': `${ROOT}/ceket-stil/iki-dugme.png`,
  'double-4': `${ROOT}/ceket-stil/dort-dugme.png`,
  'double-6': `${ROOT}/ceket-stil/alti-dugme.png`,
  'mao':      `${ROOT}/ceket-stil/mandarin.png`,
} as const;

/** Breast style top-level (single/double/mao). */
export const JACKET_BREAST_ICONS = {
  single: `${ROOT}/ceket-stil/tek-dugme.png`,
  double: `${ROOT}/ceket-stil/cift-dugme.png`,
  mao:    `${ROOT}/ceket-stil/mandarin.png`,
} as const;

/** Lapel WIDTH icons (visual). Notch is matched by lapelStyle below;
 *  there's no notch-specific icon in the source set, so notch falls back
 *  to a textual placeholder. */
export const JACKET_LAPEL_WIDTH_ICONS = {
  slim:     `${ROOT}/ceket-yaka/dar-yaka.png`,
  standard: `${ROOT}/ceket-yaka/standart-genislik.png`,
  wide:     `${ROOT}/ceket-yaka/genis-yaka.png`,
} as const;

/** Lapel STYLE icons (visual). Notch has no source icon → label only. */
export const JACKET_LAPEL_STYLE_ICONS = {
  notch: undefined,
  peak:  `${ROOT}/ceket-yaka/kirlangic-yaka.png`,
  shawl: `${ROOT}/ceket-yaka/sal-yaka.png`,
  mao:   `${ROOT}/ceket-yaka/mono-yaka.png`,
} as const;

/** Pocket icons (visual). Maps each PocketStyle / manifest pocketStyle
 *  string used by SuitConfigurator/JacketConfigurator. */
export const JACKET_POCKET_ICONS = {
  no_pocket:         `${ROOT}/ceket-cep/cepsiz.png`,
  double_welt:       `${ROOT}/ceket-cep/flato-cep.png`,
  double_welt_third: `${ROOT}/ceket-cep/flato-3x.png`,
  with_flap:         `${ROOT}/ceket-cep/kapakli-cep.png`,
  with_flap_third:   `${ROOT}/ceket-cep/kapakli-3x.png`,
  // SuitConfigurator uses the underscore form internally:
  double_welted:     `${ROOT}/ceket-cep/flato-cep.png`,
  patched:           `${ROOT}/ceket-cep/torba-cep.png`,
} as const;

// -----------------------------------------------------------------------------
// JACKET / SUIT — data-only features (DO NOT affect layer composition)
// -----------------------------------------------------------------------------

export const JACKET_FIT_ICONS = {
  slim:    `${ROOT}/ceket-fit/slimfit.png`,
  regular: `${ROOT}/ceket-fit/regularfit.png`,
} as const;

export const JACKET_VENT_ICONS = {
  single: `${ROOT}/ceket-yirtmac/tek-yirtmac.png`,
  double: `${ROOT}/ceket-yirtmac/cift-yirtmac.png`,
  none:   `${ROOT}/ceket-yirtmac/yirtmacsiz.png`,
} as const;

// -----------------------------------------------------------------------------
// SHIRT
// -----------------------------------------------------------------------------

/** Shirt collar style → icon. Visual feature (already drives layer composition). */
export const SHIRT_COLLAR_ICONS: Record<string, string> = {
  'new-kent':         `${ROOT}/gomlek-yaka/modern-kent.png`,
  'cutaway':          `${ROOT}/gomlek-yaka/italyan-yaka.png`,
  'kent-collar':      `${ROOT}/gomlek-yaka/kent-yaka.png`,
  'long-collar':      `${ROOT}/gomlek-yaka/sivri-yaka.png`,
  'button-down':      `${ROOT}/gomlek-yaka/dugmeli-yaka.png`,
  'stand-up-collar':  `${ROOT}/gomlek-yaka/hakim-yaka.png`,
  'wing-collar':      `${ROOT}/gomlek-yaka/kelebek-yaka.png`,
  'rounded-collar':   `${ROOT}/gomlek-yaka/club-yaka.png`,
  'short-classic':    `${ROOT}/gomlek-yaka/kisa-yaka.png`,
  'pinned-collar':    `${ROOT}/gomlek-yaka/pinli-yaka.png`,
};

/** Shirt cuff style → icon. Visual feature. */
export const SHIRT_CUFF_ICONS: Record<string, string> = {
  'single-cuff-1-button':       `${ROOT}/gomlek-manset/tek-dugme-klasik-manset.png`,
  'single-cuff-2-buttons':      `${ROOT}/gomlek-manset/cift-dugme-klasik-manset.png`,
  'one-button-cut':             `${ROOT}/gomlek-manset/tek-dugme-kesik-manset.png`,
  'two-button-cut':             `${ROOT}/gomlek-manset/kesik-cift-dugme-manset.png`,
  'rounded-1-button':           `${ROOT}/gomlek-manset/yuvarlak-tek-dugme-manset.png`,
  'rounded-2-buttons':          `${ROOT}/gomlek-manset/yuvarlak-cift-dugme-manset.png`,
  'squared-french-cuff':        `${ROOT}/gomlek-manset/kare-fransiz-manset.png`,
  'double-squared-french-cuff': `${ROOT}/gomlek-manset/kare-fransiz-duble-manset.png`,
  'rounded-french-cuff':        `${ROOT}/gomlek-manset/yuvarlak-fransiz-manset.png`,
  'double-rounded-french-cuff': `${ROOT}/gomlek-manset/yuvarlak-fransiz-duble-manset.png`,
};

/** Shirt fit — data-only. */
export const SHIRT_FIT_ICONS = {
  slim:   `${ROOT}/gomlek-fit/slim-fit.png`,
  normal: `${ROOT}/gomlek-fit/normal-fit.png`,
} as const;

// -----------------------------------------------------------------------------
// PANT
// -----------------------------------------------------------------------------

/** Pant fastening (visual). */
export const PANT_FASTENING_ICONS = {
  'centered':                `${ROOT}/pantolon-bel/ortalanmis-dugmeli.png`,
  'no-button':               `${ROOT}/pantolon-bel/ortalanmis-dugmesiz.png`,
  'off-centered':            `${ROOT}/pantolon-bel/kaydirilmis-dugmeli.png`,
  'off-centered-buttonless': `${ROOT}/pantolon-bel/kaydirilmis-dugmesiz.png`,
} as const;

/** Pant pleat (visual). */
export const PANT_PLEAT_ICONS = {
  'none':           `${ROOT}/pantolon-pile/pilesiz.png`,
  'single-pleated': `${ROOT}/pantolon-pile/tek-pile.png`,
  'double-pleated': `${ROOT}/pantolon-pile/cift-pile.png`,
} as const;

/** Pant fit — data-only. */
export const PANT_FIT_ICONS = {
  slim:   `${ROOT}/pantolon-fit/slim-fit.png`,
  normal: `${ROOT}/pantolon-fit/normal-fit.png`,
} as const;

/** Pant leg-end (paça) — data-only. */
export const PANT_LEG_STYLE_ICONS = {
  straight: `${ROOT}/pantolon-paca/duz-paca.png`,
  cuffed:   `${ROOT}/pantolon-paca/duble-paca.png`,
} as const;

/** Pant drape (dökum) — data-only. */
export const PANT_DRAPE_ICONS = {
  none:  `${ROOT}/pantolon-dokum/dokumsuz.png`,
  light: `${ROOT}/pantolon-dokum/hafif-dokumlu.png`,
  full:  `${ROOT}/pantolon-dokum/tam-dokumlu.png`,
} as const;

// -----------------------------------------------------------------------------
// VEST
// -----------------------------------------------------------------------------

/** Vest style prefix (visual). */
export const VEST_STYLE_ICONS = {
  'single-4btn': `${ROOT}/yelek-stil/dort-dugme.png`,
  'single-5btn': `${ROOT}/yelek-stil/bes-dugme.png`,
  'double-6btn': `${ROOT}/yelek-stil/alti-dugme.png`,
} as const;

/** Vest lapel shape (visual). */
export const VEST_LAPEL_SHAPE_ICONS = {
  notch: `${ROOT}/yelek-yaka/centik-yaka.png`,
  peak:  `${ROOT}/yelek-yaka/sivri-yaka.png`,
  shawl: `${ROOT}/yelek-yaka/sal-yaka.png`,
  no:    `${ROOT}/yelek-yaka/yakasiz.png`,
} as const;
