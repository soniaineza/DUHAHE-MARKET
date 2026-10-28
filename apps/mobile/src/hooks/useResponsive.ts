import { useWindowDimensions } from 'react-native';

/** Widest the storefront content is allowed to get on a desktop browser. */
export const FRAME_MAX_WIDTH = 1200;

/**
 * Shared desktop/tablet breakpoints for the web storefront.
 *
 * `itemWidth` is the exact card width for the current number of grid columns,
 * so React Native Web never stretches a 2-column phone grid across a monitor.
 */
export function useResponsive(maxWidth: number = FRAME_MAX_WIDTH, horizontalPadding: number = 16) {
  const { width, height } = useWindowDimensions();
  const isDesktop = width >= 900;
  const isWide = width >= 1200;
  const frameWidth = Math.min(width, maxWidth);
  const contentWidth = Math.max(0, frameWidth - horizontalPadding * 2);
  const columns = isWide ? 5 : isDesktop ? 4 : width >= 700 ? 3 : 2;
  const gap = isDesktop ? 16 : 12;
  // Keep the fraction (to 2 dp, rounded down so a row can never wrap): flooring to whole pixels left the
  // last card up to a few pixels short of the container's right edge.
  const itemWidth = Math.max(0, Math.floor(((contentWidth - gap * (columns - 1)) / columns) * 100) / 100);

  return { width, height, isDesktop, isWide, columns, gap, itemWidth, contentWidth };
}
