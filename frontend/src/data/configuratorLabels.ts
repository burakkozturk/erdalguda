export const BREAST_STYLE_LABELS: Record<string, string> = {
  single: 'Tek Sıra',
  double: 'Çift Sıra',
  mao: 'Mao Yaka',
};

export const JACKET_LAPEL_WIDTH_LABELS: Record<string, string> = {
  slim: 'Dar Yaka',
  standard: 'Standart Yaka',
  wide: 'Geniş Yaka',
  narrow: 'Dar Yaka',
  medium: 'Orta Yaka',
};

export const LAPEL_STYLE_LABELS: Record<string, string> = {
  notch: 'Çentikli Yaka',
  peak: 'Kırlangıç Yaka',
  shawl: 'Şal Yaka',
  mao: 'Mao Yaka',
};

export const POCKET_STYLE_LABELS: Record<string, string> = {
  no_pocket: 'Cepsiz',
  with_flap: 'Kapaklı Cep',
  with_flap_third: 'Kapaklı Üçlü Cep',
  double_welt: 'Fleto Cep',
  double_welted: 'Fleto Cep',
  double_welt_third: 'Fleto Üçlü Cep',
  patched: 'Torba Cep',
};

export const JACKET_FIT_LABELS: Record<string, string> = {
  slim: 'Dar Kesim',
  regular: 'Klasik Kesim',
};

export const SHIRT_FIT_LABELS: Record<string, string> = {
  slim: 'Dar Kesim',
  normal: 'Normal Kesim',
};

export const PANT_FIT_LABELS: Record<string, string> = {
  slim: 'Dar Kesim',
  normal: 'Normal Kesim',
};

export const JACKET_VENT_LABELS: Record<string, string> = {
  single: 'Tek Yırtmaç',
  double: 'Çift Yırtmaç',
  none: 'Yırtmaçsız',
};

export const SHIRT_COLLAR_LABELS: Record<string, string> = {
  'new-kent': 'Modern Kent Yaka',
  cutaway: 'İtalyan Yaka',
  'kent-collar': 'Kent Yaka',
  'long-collar': 'Sivri Yaka',
  'button-down': 'Düğmeli Yaka',
  'stand-up-collar': 'Hakim Yaka',
  'wing-collar': 'Kelebek Yaka',
  'rounded-collar': 'Club Yaka',
  'short-classic': 'Kısa Klasik Yaka',
  'pinned-collar': 'Pinli Yaka',
};

export const SHIRT_CUFF_LABELS: Record<string, string> = {
  'single-cuff-1-button': 'Tek Düğmeli Klasik Manşet',
  'single-cuff-2-buttons': 'Çift Düğmeli Klasik Manşet',
  'one-button-cut': 'Tek Düğmeli Kesik Manşet',
  'two-button-cut': 'Çift Düğmeli Kesik Manşet',
  'rounded-1-button': 'Tek Düğmeli Yuvarlak Manşet',
  'rounded-2-buttons': 'Çift Düğmeli Yuvarlak Manşet',
  'squared-french-cuff': 'Kare Fransız Manşet',
  'double-squared-french-cuff': 'Çift Kare Fransız Manşet',
  'rounded-french-cuff': 'Yuvarlak Fransız Manşet',
  'double-rounded-french-cuff': 'Çift Yuvarlak Fransız Manşet',
};

export const PANT_FASTENING_LABELS: Record<string, string> = {
  centered: 'Ortadan Düğmeli',
  'no-button': 'Ortadan Düğmesiz',
  'off-centered': 'Yandan Düğmeli',
  'off-centered-buttonless': 'Yandan Düğmesiz',
};

export const PANT_PLEAT_LABELS: Record<string, string> = {
  none: 'Pilesiz',
  'single-pleated': 'Tek Pileli',
  'double-pleated': 'Çift Pileli',
};

export const PANT_LEG_STYLE_LABELS: Record<string, string> = {
  straight: 'Düz Paça',
  cuffed: 'Duble Paça',
};

export const PANT_DRAPE_LABELS: Record<string, string> = {
  none: 'Dökümsüz',
  light: 'Hafif Dökümlü',
  full: 'Tam Dökümlü',
};

export const VEST_STYLE_LABELS: Record<string, string> = {
  'single-4btn': 'Tek Sıra 4 Düğme',
  'single-5btn': 'Tek Sıra 5 Düğme',
  'double-6btn': 'Çift Sıra 6 Düğme',
};

export const VEST_LAPEL_WIDTH_LABELS: Record<string, string> = {
  narrow: 'Dar Yaka',
  medium: 'Orta Yaka',
};

export const VEST_LAPEL_SHAPE_LABELS: Record<string, string> = {
  notch: 'Çentikli Yaka',
  peak: 'Kırlangıç Yaka',
  shawl: 'Şal Yaka',
  no: 'Yakasız',
};

export const TUXEDO_STYLE_LABELS: Record<string, string> = {
  single_breasted_1: 'Tek Sıra 1 Düğme',
  single_breasted_2: 'Tek Sıra 2 Düğme',
  double_breasted_2: 'Çift Sıra 2 Düğme',
  double_breasted_4: 'Çift Sıra 4 Düğme',
  double_breasted_6: 'Çift Sıra 6 Düğme',
};

export function getConfiguratorLabel(labels: Record<string, string>, value: string | null | undefined) {
  if (!value) {
    return '-';
  }
  return labels[value] ?? value;
}

export function getPocketLabel(value: string | null | undefined) {
  if (!value) {
    return '-';
  }
  if (value.endsWith('_x3')) {
    const baseValue = value.replace(/_x3$/, '');
    const baseLabel = POCKET_STYLE_LABELS[baseValue] ?? baseValue;
    return `${baseLabel} + Üçlü Cep`;
  }
  return POCKET_STYLE_LABELS[value] ?? value;
}

export const COAT_STYLE_LABELS: Record<string, string> = {
  overcoat: 'Overcoat',
  double_breasted: 'Double Breasted',
  funnel_neck: 'Funnel Neck',
  pea_coat: 'Pea Coat',
  duffle_coat: 'Duffle Coat',
};

export const COAT_LAPEL_STYLE_LABELS: Record<string, string> = {
  notch: 'Notch',
  peak: 'Peak',
  rounded: 'Rounded',
  ulster: 'Ulster',
};

export const COAT_LAPEL_WIDTH_LABELS: Record<string, string> = {
  standard: 'Standard',
  wide: 'Wide',
};

export const COAT_LAPEL_LENGTH_LABELS: Record<string, string> = {
  classic: 'Classic',
  long: 'Long',
};

export const COAT_FASTENING_LABELS: Record<string, string> = {
  boton_standard: 'Standard',
  boton_hide: 'Hidden',
};

export const COAT_POCKET_LABELS: Record<string, string> = {
  flap: 'Flap',
  flap_3: 'Flap + Breast',
  double_welt: 'Double Welt',
  double_welt_3: 'Welt + Breast',
  diagonal: 'Diagonal',
  patched: 'Patch',
};

export function getJacketStyleLabel(styleKey: string | null | undefined) {
  if (!styleKey) {
    return '-';
  }
  const lower = styleKey.toLowerCase();
  if (lower.startsWith('mao')) {
    return 'Mao Yaka';
  }
  const match = lower.match(/^(sb|db)-(\d+)b/);
  if (!match) {
    return styleKey;
  }
  const breastLabel = match[1] === 'sb' ? 'Tek Sıra' : 'Çift Sıra';
  return `${breastLabel} ${match[2]} Düğme`;
}
