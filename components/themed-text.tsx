import { StyleSheet, Text, type TextProps } from 'react-native';

import { Typography } from '@/constants/theme';
import { useThemeColor } from '@/hooks/use-theme-color';

export type ThemedTextType =
  | 'hero'         // 56 px bold  – headline stat (timer)
  | 'title'        // 28 px bold  – screen titles
  | 'subtitle'     // 22 px bold  – section headings
  | 'label'        // 11 px medium uppercase – stat card labels
  | 'body'         // 16 px regular – general copy
  | 'bodyMed'      // 16 px medium
  | 'bodySemiBold' // 16 px bold   (was 'defaultSemiBold')
  | 'caption'      // 13 px regular – metadata, timestamps
  | 'link';        // 16 px medium in primary colour

export type ThemedTextProps = TextProps & {
  lightColor?: string;
  darkColor?: string;
  type?: ThemedTextType;
};

export function ThemedText({
  style,
  lightColor,
  darkColor,
  type = 'body',
  ...rest
}: ThemedTextProps) {
  const color = useThemeColor({ light: lightColor, dark: darkColor }, 'text');
  const linkColor = useThemeColor({}, 'primary');

  return (
    <Text
      style={[
        { color },
        type === 'hero'         ? styles.hero         : undefined,
        type === 'title'        ? styles.title        : undefined,
        type === 'subtitle'     ? styles.subtitle     : undefined,
        type === 'label'        ? styles.label        : undefined,
        type === 'body'         ? styles.body         : undefined,
        type === 'bodyMed'      ? styles.bodyMed      : undefined,
        type === 'bodySemiBold' ? styles.bodySemiBold : undefined,
        type === 'caption'      ? styles.caption      : undefined,
        type === 'link'         ? [styles.link, { color: linkColor }] : undefined,
        style,
      ]}
      {...rest}
    />
  );
}

const styles = StyleSheet.create({
  hero: {
    fontSize:   Typography.sizes.hero,
    fontFamily: Typography.fontDisplay,
    lineHeight: Math.round(Typography.sizes.hero * Typography.lineHeights.tight),
  },
  title: {
    fontSize:   Typography.sizes.xl,
    fontFamily: Typography.fontHeadline,
    lineHeight: Math.round(Typography.sizes.xl * Typography.lineHeights.tight),
  },
  subtitle: {
    fontSize:   Typography.sizes.lg,
    fontFamily: Typography.fontHeadline,
    lineHeight: Math.round(Typography.sizes.lg * Typography.lineHeights.normal),
  },
  label: {
    fontSize:      Typography.sizes.xs,
    fontFamily:    Typography.fontMedium,
    lineHeight:    Math.round(Typography.sizes.xs * Typography.lineHeights.normal),
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  body: {
    fontSize:   Typography.sizes.base,
    fontFamily: Typography.fontRegular,
    lineHeight: Math.round(Typography.sizes.base * Typography.lineHeights.normal),
  },
  bodyMed: {
    fontSize:   Typography.sizes.base,
    fontFamily: Typography.fontMedium,
    lineHeight: Math.round(Typography.sizes.base * Typography.lineHeights.normal),
  },
  bodySemiBold: {
    fontSize:   Typography.sizes.base,
    fontFamily: Typography.fontBold,
    lineHeight: Math.round(Typography.sizes.base * Typography.lineHeights.normal),
  },
  caption: {
    fontSize:   Typography.sizes.sm,
    fontFamily: Typography.fontRegular,
    lineHeight: Math.round(Typography.sizes.sm * Typography.lineHeights.normal),
  },
  link: {
    fontSize:   Typography.sizes.base,
    fontFamily: Typography.fontMedium,
    lineHeight: Math.round(Typography.sizes.base * Typography.lineHeights.normal),
  },
});
