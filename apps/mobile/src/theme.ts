// ---------------------------------------------------------------------------
// DUHAHE design tokens — professional grocery market brand
// ---------------------------------------------------------------------------

export const colors = {
  // Brand greens (primary actions, active states, headers)
  primary: '#087443',
  primaryDark: '#06602F',
  primaryDeep: '#064F2A',
  secondary: '#0B8F55',
  primarySoft: '#E5F3EC',
  primaryLine: '#CBE7D8',

  // Accent yellow (badges, offers, highlights, selected states)
  accent: '#F4B942',
  accentDark: '#DB9F2B',
  accentSoft: '#FDF3D9',

  // Legacy aliases — map onto the green brand; removed during screen migration
  accentDeep: '#064F2A',
  accentLine: '#CBE7D8',

  // Neutrals (Warm paper background, ink text)
  bg: '#F7F8F6',
  surface: '#FFFFFF',
  card: '#FFFFFF',
  chip: '#EFF1EF',
  subtle: '#EFF1EF',
  ink: '#171A18',
  inkSoft: '#2B302C',
  muted: '#6B716C',
  faint: '#9BA19C',
  border: '#E4E7E3',
  divider: '#EDEFEB',

  // Semantic
  success: '#16804A',
  successSoft: '#E6F2EC',
  warn: '#DB9F2B',
  warnSoft: '#FDF3D9',
  danger: '#D64545',
  dangerSoft: '#FBE9E7',
  info: '#087443',
  infoSoft: '#E5F3EC',

  // Green scale (legacy alias kept for stepwise migration)
  leaf50: '#E9F6EF',
  leaf100: '#D3EDDF',
  leaf200: '#A8DCC0',
  leaf300: '#6FC39B',
  leaf400: '#3CA977',
  leaf500: '#1E955F',
  leaf600: '#0B8F55',
  leaf700: '#087443',
  leaf800: '#06602F',
  leaf900: '#054725',

  // Yellow scale (legacy alias kept for stepwise migration)
  harvest50: '#FEF5DC',
  harvest100: '#FBEBC0',
  harvest200: '#F8DA84',
  harvest300: '#F4C946',
  harvest400: '#EFB834',
  harvest500: '#DB9F2B',
  harvest600: '#B97F14',

  // Payment providers
  mtn: '#FECB33',
  mtnDark: '#C79E12',
  airtel: '#D61E4E',
  airtelDark: '#9F1239',

  white: '#FFFFFF',

  // DEPRECATED gradient stops — removed in later phases (no gradients in spec)
  accentGrad1: '#0B8F55',
  accentGrad2: '#087443',
} as const;

export const radii = {
  s: 10,
  m: 14,
  l: 18,
  xl: 24,
  pill: 999,
} as const;

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24, xxxl: 32 } as const;

export const fontSizes = {
  xs: 11,
  sm: 13,
  md: 15,
  lg: 18,
  xl: 22,
  xxl: 28,
  display: 34,
} as const;

export const fontWeights = {
  regular: '400',
  medium: '500',
  semibold: '600',
  bold: '700',
  extrabold: '800',
  black: '900',
} as const;

// Inter font family names as registered by @expo-google-fonts/inter
export const fonts = {
  regular: 'Inter_400Regular',
  medium: 'Inter_500Medium',
  semibold: 'Inter_600SemiBold',
  bold: 'Inter_700Bold',
  extrabold: 'Inter_800ExtraBold',
  black: 'Inter_900Black',
} as const;

// Card / sheet shadows — subtle, low elevation (spec: no excessive shadow)
export const shadow = {
  sm: {
    shadowColor: '#171A18',
    shadowOpacity: 0.05,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  md: {
    shadowColor: '#171A18',
    shadowOpacity: 0.08,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
  lg: {
    shadowColor: '#171A18',
    shadowOpacity: 0.12,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 10 },
    elevation: 8,
  },
} as const;

// DEPRECATED — keep for legacy components; removed during screen migration
export const gradientHero = ['#0B8F55', '#087443', '#065931'] as const;
export const gradientAccent = ['#0B8F55', '#087443'] as const;
export const gradientAccentSolid = ['#0B8F55', '#087443'] as const;
export const gradientCard = ['#f3f8f5', '#e9f6ef'] as const;