import { useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/**
 * Returns responsive sizing helpers based on the current screen dimensions.
 * Use these to scale padding, font sizes, and element sizes across devices.
 */
export function useResponsive() {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  // Base design width is 390 (iPhone 14 Pro)
  const scale = Math.min(width / 390, 1.3);

  // Responsive font sizes
  const fs = {
    xs: Math.round(10 * scale),
    sm: Math.round(12 * scale),
    base: Math.round(14 * scale),
    md: Math.round(16 * scale),
    lg: Math.round(18 * scale),
    xl: Math.round(20 * scale),
    xxl: Math.round(24 * scale),
    xxxl: Math.round(30 * scale),
  };

  // Responsive spacing
  const sp = {
    xs: Math.round(4 * scale),
    sm: Math.round(8 * scale),
    md: Math.round(12 * scale),
    lg: Math.round(16 * scale),
    xl: Math.round(20 * scale),
    xxl: Math.round(24 * scale),
  };

  // Responsive icon sizes
  const icon = {
    xs: Math.round(12 * scale),
    sm: Math.round(14 * scale),
    md: Math.round(16 * scale),
    lg: Math.round(20 * scale),
    xl: Math.round(24 * scale),
  };

  // Bottom nav height + safe area bottom
  const bottomNavHeight = Math.round(56 * scale);
  const safeBottom = insets.bottom;
  const bottomNavOffset = bottomNavHeight + safeBottom + sp.sm;

  // Top safe area
  const topInset = insets.top;
  const statusBarHeight = insets.top;

  return {
    width,
    height,
    scale,
    fs,
    sp,
    icon,
    insets,
    bottomNavHeight,
    bottomNavOffset,
    topInset,
    statusBarHeight,
    isSmallPhone: width < 360,
    isLargePhone: width >= 414,
    isTablet: width >= 768,
  };
}
