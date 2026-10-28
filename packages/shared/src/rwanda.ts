/**
 * Rwanda's administrative geography: 5 provinces and their 30 districts.
 * Province keys are the canonical (English) names stored on orders and
 * addresses, so the storefront, API and admin dashboard always agree.
 */
export type ProvinceKey = 'Kigali City' | 'Northern' | 'Southern' | 'Eastern' | 'Western';

export const PROVINCE_KEYS: ProvinceKey[] = ['Kigali City', 'Northern', 'Southern', 'Eastern', 'Western'];

export const PROVINCE_LABELS: Record<ProvinceKey, { en: string; kin: string; fr: string }> = {
  'Kigali City': { en: 'Kigali City', kin: 'Umujyi wa Kigali', fr: 'Ville de Kigali' },
  Northern: { en: 'Northern', kin: 'Amajyaruguru', fr: 'Nord' },
  Southern: { en: 'Southern', kin: 'Amajyepfo', fr: 'Sud' },
  Eastern: { en: 'Eastern', kin: 'Iburasirazuba', fr: 'Est' },
  Western: { en: 'Western', kin: 'Uburengerazuba', fr: 'Ouest' },
};

export const DISTRICTS_BY_PROVINCE: Record<ProvinceKey, string[]> = {
  'Kigali City': ['Gasabo', 'Kicukiro', 'Nyarugenge'],
  Northern: ['Burera', 'Gakenke', 'Gicumbi', 'Musanze', 'Rulindo'],
  Southern: ['Gisagara', 'Huye', 'Kamonyi', 'Muhanga', 'Nyamagabe', 'Nyanza', 'Nyaruguru', 'Ruhango'],
  Eastern: ['Bugesera', 'Gatsibo', 'Kayonza', 'Kirehe', 'Ngoma', 'Nyagatare', 'Rwamagana'],
  Western: ['Karongi', 'Ngororero', 'Nyabihu', 'Nyamasheke', 'Rubavu', 'Rusizi', 'Rutsiro'],
};

export const ALL_DISTRICTS: string[] = PROVINCE_KEYS.flatMap((p) => DISTRICTS_BY_PROVINCE[p]);

/** Province that owns a district (case-insensitive), or undefined if unknown. */
export function provinceOfDistrict(district?: string): ProvinceKey | undefined {
  const d = (district ?? '').trim().toLowerCase();
  if (!d) return undefined;
  return PROVINCE_KEYS.find((p) => DISTRICTS_BY_PROVINCE[p].some((x) => x.toLowerCase() === d));
}

/** Map any localized or canonical province label back to its canonical key. */
export function normalizeProvince(value?: string): ProvinceKey | undefined {
  const v = (value ?? '').trim().toLowerCase();
  if (!v) return undefined;
  return PROVINCE_KEYS.find((p) => {
    const l = PROVINCE_LABELS[p];
    return [p, l.en, l.kin, l.fr].some((x) => x.toLowerCase() === v);
  });
}
