import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { fonts } from '@/constants/fonts';
import { joyTheme } from '@/constants/joyTheme';

interface SectionTitleProps {
  eyebrow: string;
  title: string;
  subtitle?: string;
}

export const SectionTitle = React.memo(function SectionTitle({ eyebrow, title, subtitle }: SectionTitleProps) {
  return (
    <View style={styles.container}>
      <View style={styles.eyebrowBadge}>
        <Text style={styles.eyebrow}>{eyebrow}</Text>
      </View>
      <Text style={styles.title}>{title}</Text>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    gap: 10,
  },
  eyebrowBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: joyTheme.warmSoft,
    borderWidth: 1,
    borderColor: '#FDBA74',
  },
  eyebrow: {
    fontSize: 11,
    fontFamily: fonts.extraBold,
    color: joyTheme.warm,
    letterSpacing: 1.1,
    textTransform: 'uppercase',
  },
  title: {
    fontSize: 30,
    lineHeight: 35,
    fontFamily: fonts.black,
    color: joyTheme.text,
    letterSpacing: -0.6,
  },
  subtitle: {
    fontFamily: fonts.regular,
    fontSize: 15,
    lineHeight: 23,
    color: joyTheme.textMuted,
    maxWidth: '92%',
  },
});
