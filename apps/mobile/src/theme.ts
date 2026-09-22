// ---------------------------------------------------------------------------
// DUHAHE design tokens — professional grocery market brand
// ---------------------------------------------------------------------------

export const colors = {
  // Brand accent — deep black (per redesign: cream canvas, black accents)
  primary: '#111111',
  primaryDark: '#000000',
  primaryDeep: '#111111',
  secondary: '#111111',
  primarySoft: '#EFEAD9',
  primaryLine: '#DDD6C3',

  // Accent yellow (badges, offers, highlights, selected states)
  accent: '#F4B942',
  accentDark: '#B97F14',
  accentSoft: '#FDF3D9',

  // Legacy aliases — map onto the black brand; removed during screen migration
  accentDeep: '#111111',
  accentLine: '#DDD6C3',

  // Neutrals (Warm cream background, black ink text)
  bg: '#F7F4EC',
  surface: '#FFFFFF',
  card: '#FFFFFF',
  chip: '#EDE8DA',
  subtle: '#EDE8DA',
  ink: '#111111',
  inkSoft: '#2A2822',
  muted: '#77736B',
  faint: '#A39E92',
  border: '#E5E0D3',
  divider: '#EDE8DA',

  // Semantic
  success: '#B45309',
  successSoft: '#FDF3D9',
  warn: '#DB9F2B',
  warnSoft: '#FDF3D9',
  danger: '#C2410C',
  dangerSoft: '#FBE9E7',
  info: '#111111',
  infoSoft: '#EFEAD9',

  // Legacy "leaf" scale — remapped to warm neutrals/black (no green anywhere)
  leaf50: '#EDE8DA',
  leaf100: '#DDD6C3',
  leaf200: '#C9C1AA',
  leaf300: '#A39E92',
  leaf400: '#77736B',
  leaf500: '#44403C',
  leaf600: '#2A2822',
  leaf700: '#111111',
  leaf800: '#000000',
  leaf900: '#000000',

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

  // DEPRECATED gradient stops — kept for legacy components (black accent stops)
  accentGrad1: '#111111',
  accentGrad2: '#000000',
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
    shadowColor: '#111111',
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

// DEPRECATED — kept for legacy components; solid black ramps now (no gradients in spirit, monochrome stops)
export const gradientHero = ['#111111', '#111111', '#111111'] as const;
export const gradientAccent = ['#111111', '#111111'] as const;
export const gradientAccentSolid = ['#111111', '#111111'] as const;
export const gradientCard = ['#F7F4EC', '#EFEAD9'] as const;