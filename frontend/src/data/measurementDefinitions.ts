import type { MeasurementDefinition } from '../types/measurement';

const MEASUREMENT_MEDIA_ROOT = '/assets/measurement_media';

const imagesByLegacyOrder: Record<number, string> = {
  1: `${MEASUREMENT_MEDIA_ROOT}/1_boyun_çapı/yeni_render/1.png`,
  3: `${MEASUREMENT_MEDIA_ROOT}/3_boyun_kökü_ile_sağ_omuz_ucu_arası_mesafe/yeni_render/3.png`,
  4: `${MEASUREMENT_MEDIA_ROOT}/4_omuz_genişliği/yeni_render/4.png`,
  5: `${MEASUREMENT_MEDIA_ROOT}/5_sırt_genişliği/yeni_render/5.png`,
  6: `${MEASUREMENT_MEDIA_ROOT}/6_göğüs_çapı/yeni_render/6.png`,
  7: `${MEASUREMENT_MEDIA_ROOT}/7_göbek_çapı/yeni_render/7.png`,
  8: `${MEASUREMENT_MEDIA_ROOT}/8_bel_kemer_çapı/yeni_render/8.png`,
  9: `${MEASUREMENT_MEDIA_ROOT}/9_basen_kalça_çapı/yeni_render/9.png`,
  10: `${MEASUREMENT_MEDIA_ROOT}/10_etek_boyu/yeni_render/10.png`,
  18: `${MEASUREMENT_MEDIA_ROOT}/18_sağ_boyun_göğüs_yükseklik/yeni_render/18.png`,
  19: `${MEASUREMENT_MEDIA_ROOT}/19_sağ_omuz_göğus_yükseklik/yeni_render/19.png`,
  20: `${MEASUREMENT_MEDIA_ROOT}/20_sağ_kol_omuz_kesişim_çapı/yeni_render/20.png`,
  21: `${MEASUREMENT_MEDIA_ROOT}/21_sağ_kol_boyu/yeni_render/21.png`,
  22: `${MEASUREMENT_MEDIA_ROOT}/22_sağ_pazu_çapı/yeni_render/22.png`,
  23: `${MEASUREMENT_MEDIA_ROOT}/23_sağ_dirsek/yeni_render/23.png`,
  24: `${MEASUREMENT_MEDIA_ROOT}/24_sağ_bilek_çapı/yeni_render/24.png`,
  25: `${MEASUREMENT_MEDIA_ROOT}/25_ceket_etek_boyu_sırttan/yeni_render/25.png`,
  26: `${MEASUREMENT_MEDIA_ROOT}/26_göğüs_genişliği/yeni_render/26.png`,
  27: `${MEASUREMENT_MEDIA_ROOT}/27_göbek_genişliği/yeni_render/27.png`,
  34: `${MEASUREMENT_MEDIA_ROOT}/34_sağ_üst_bacak_baldır_çapı/yeni_render/34.png`,
  35: `${MEASUREMENT_MEDIA_ROOT}/35_sağ_diz/yeni_render/35.png`,
  36: `${MEASUREMENT_MEDIA_ROOT}/36_sağ_alt_bacak_adele_çapı/yeni_render/36.png`,
  37: `${MEASUREMENT_MEDIA_ROOT}/37_sağ_ayak_bileği_çapı/yeni_render/37.png`,
  38: `${MEASUREMENT_MEDIA_ROOT}/38_sağ_bacak_bel_bilek_boyu/yeni_render/db-0038.png`,
  39: `${MEASUREMENT_MEDIA_ROOT}/39_sağ_bacak_bilek_boyu/yeni_render/39.png`,
};

// Tuple: [definitionKey, displayLabel, legacyOrder, sectionTitle]
//
// legacyOrder maps to the historic 1-39 image folder layout (preserved on
// disk under assets/measurement_media/<order>_<slug>). After the Sol/Sağ
// asymmetry cleanup we only keep "Sağ" + neutral measurements; legacyOrder
// remains so existing media still resolves correctly even though the
// public order numbers are renumbered sequentially.
const baseDefinitions = [
  ['boyun_capi',                        'Boyun Çapı',                                           1,  'Üst Beden'],
  ['boyun_koku_sag_omuz_ucu_mesafe',    'Boyun Kökü ile Sağ Omuz Ucu Arası Mesafe',             3,  'Üst Beden'],
  ['omuz_genisligi',                    'Omuz Genişliği',                                       4,  'Üst Beden'],
  ['sirt_genisligi',                    'Sırt Genişliği',                                       5,  'Üst Beden'],
  ['gogus_capi',                        'Göğüs Çapı',                                           6,  'Üst Beden'],
  ['gobek_capi',                        'Göbek Çapı',                                           7,  'Üst Beden'],
  ['bel_kemer_capi',                    'Bel Kemer Çapı',                                       8,  'Üst Beden'],
  ['basen_kalca_capi',                  'Basen Kalça Çapı',                                     9,  'Üst Beden'],
  ['etek_boyu',                         'Etek Boyu',                                            10, 'Üst Beden'],
  ['sag_boyun_gogus_yukseklik',         'Sağ Boyun Göğüs Yüksekliği',                           18, 'Üst Beden'],
  ['sag_omuz_gogus_yukseklik',          'Sağ Omuz Göğüs Yüksekliği',                            19, 'Üst Beden'],
  ['sag_kol_omuz_kesisim_capi',         'Sağ Kol Omuz Kesişim Çapı',                            20, 'Üst Beden'],
  ['sag_kol_boyu',                      'Sağ Kol Boyu',                                         21, 'Üst Beden'],
  ['sag_pazu_capi',                     'Sağ Pazu Çapı',                                        22, 'Üst Beden'],
  ['sag_dirsek',                        'Sağ Dirsek',                                           23, 'Üst Beden'],
  ['sag_bilek_capi',                    'Sağ Bilek Çapı',                                       24, 'Üst Beden'],
  ['ceket_etek_boyu_sirttan',           'Ceket Etek Boyu Sırttan',                              25, 'Üst Beden'],
  ['gogus_genisligi',                   'Göğüs Genişliği',                                      26, 'Üst Beden'],
  ['gobek_genisligi',                   'Göbek Genişliği',                                      27, 'Üst Beden'],
  ['sag_ust_bacak_baldir_capi',         'Sağ Üst Bacak Baldır Çapı',                            34, 'Sağ Bacak'],
  ['sag_diz',                           'Sağ Diz',                                              35, 'Sağ Bacak'],
  ['sag_alt_bacak_adele_capi',          'Sağ Alt Bacak Adele Çapı',                             36, 'Sağ Bacak'],
  ['sag_ayak_bilegi_capi',              'Sağ Ayak Bileği Çapı',                                 37, 'Sağ Bacak'],
  ['sag_bacak_bel_bilek_boyu',          'Sağ Bacak Bel Bilek Boyu',                             38, 'Sağ Bacak'],
  ['sag_bacak_bilek_boyu',              'Sağ Bacak Bilek Boyu',                                 39, 'Sağ Bacak'],
] as const;

export type MeasurementSection = 'Üst Beden' | 'Sağ Bacak';

export const measurementDefinitions: MeasurementDefinition[] = baseDefinitions.map(
  ([key, label, legacyOrder], index) => ({
    order: index + 1,
    key,
    label,
    unit: 'cm',
    imageSrc: imagesByLegacyOrder[legacyOrder],
  }),
);

export const measurementSectionFor: Record<string, MeasurementSection> = Object.fromEntries(
  baseDefinitions.map(([key, , , section]) => [key, section]),
);
