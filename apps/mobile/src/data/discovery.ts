import type { Language } from '@duhahe/shared';

// Localized string tuple: [en, kin, fr]
export type L = readonly [string, string, string];

const IDX: Record<Language, number> = { en: 0, kin: 1, fr: 2 };

export function pick(l: L, lang: Language): string {
  return l[IDX[lang]];
}

// ---------------------------------------------------------------------------
export interface SearchSuggestion {
  label: L;
  q: string;
}

export const SUGGESTED_SEARCHES: SearchSuggestion[] = [
  { label: ['Avocado', 'Avoka', 'Avocat'], q: 'avocado' },
  { label: ['Rice', 'Umuceri', 'Riz'], q: 'rice' },
  { label: ['Tomatoes', 'Inyanya', 'Tomates'], q: 'tomato' },
  { label: ['Eggs', 'Amagi', 'Œufs'], q: 'eggs' },
];

export const POPULAR_SEARCHES: SearchSuggestion[] = [
  { label: ['Maize flour', 'Ifu y’ibigori', 'Farine de maïs'], q: 'maize' },
  { label: ['Beans', 'Ibishyimbo', 'Haricots'], q: 'beans' },
  { label: ['Fresh milk', 'Amata mashya', 'Lait frais'], q: 'milk' },
  { label: ['Bananas', 'Ibitoki', 'Bananes'], q: 'banana' },
  { label: ['Coffee beans', 'ikawa', 'Grains de café'], q: 'coffee' },
  { label: ['Peanuts', 'Amabiyeyi', 'Arachides'], q: 'groundnut' },
];

export const COURIERS: { name: string; emoji: string; color: string; phone: string; rating: number }[] = [
  { name: 'Eric N.', emoji: '🛵', color: '#334155', phone: '+250 788 500 123', rating: 4.9 },
  { name: 'Jean de Dieu', emoji: '🏍️', color: '#166534', phone: '+250 782 111 456', rating: 4.8 },
  { name: 'Aisha U.', emoji: '🛵', color: '#9d174d', phone: '+250 783 999 287', rating: 4.7 },
  { name: 'Claude M.', emoji: '🚲', color: '#1e40af', phone: '+250 784 555 014', rating: 4.8 },
  { name: 'Solange K.', emoji: '🛵', color: '#7c2d12', phone: '+250 789 222 890', rating: 5.0 },
];

export function pickCourier(orderId: string) {
  let seed = 0;
  for (const ch of orderId) seed = (seed * 31 + ch.charCodeAt(0)) % 997;
  return COURIERS[seed % COURIERS.length];
}

// Curated ids for the Home "Popular this week" rail (fallback picks when missing).
export const FEATURED_IDS: string[] = [
  's001', // Local rice
  'v001', // Tomatoes
  'v002', // White onions
  's024', // Irish potatoes
  's036', // Eggs
  's053', // Fresh milk
  'f001', // Avocado
  'f002', // Sweet bananas
  'f010', // Mango
  's034', // Coffee beans
  's065', // Bread loaf
  'p001', // Bath soap
];