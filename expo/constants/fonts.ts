import { Platform } from 'react-native';

const regular = Platform.select({
  ios: 'System',
  android: 'sans-serif',
  default: 'System',
});

const medium = Platform.select({
  ios: 'System',
  android: 'sans-serif-medium',
  default: 'System',
});

const bold = Platform.select({
  ios: 'System',
  android: 'sans-serif-medium',
  default: 'System',
});

export const fonts = {
  thin: regular,
  light: regular,
  regular: regular,
  medium: medium,
  semiBold: bold,
  bold: bold,
  extraBold: bold,
  black: bold,
} as const;

export type FontWeight = '100' | '300' | '400' | '500' | '600' | '700' | '800' | '900';

export const fontFamilyForWeight = (weight: string): string => {
  switch (weight) {
    case '100': return fonts.thin;
    case '300': return fonts.light;
    case '400': return fonts.regular;
    case '500': return fonts.medium;
    case '600': return fonts.semiBold;
    case '700': return fonts.bold;
    case '800': return fonts.extraBold;
    case '900': return fonts.black;
    default: return fonts.regular;
  }
};
