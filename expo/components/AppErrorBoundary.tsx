import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { fonts } from '@/constants/fonts';
import { joyTheme } from '@/constants/joyTheme';

interface AppErrorBoundaryProps {
  children: React.ReactNode;
}

interface AppErrorBoundaryState {
  hasError: boolean;
}

export class AppErrorBoundary extends React.Component<AppErrorBoundaryProps, AppErrorBoundaryState> {
  public state: AppErrorBoundaryState = {
    hasError: false,
  };

  public static getDerivedStateFromError(): AppErrorBoundaryState {
    return { hasError: true };
  }

  public componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    console.error('[AppErrorBoundary] Caught rendering error', error);
    console.error('[AppErrorBoundary] Component stack:', errorInfo?.componentStack);
  }

  private handleRetry = (): void => {
    console.log('[AppErrorBoundary] Resetting boundary state after retry tap');
    this.setState({ hasError: false });
  };

  public render(): React.ReactNode {
    if (this.state.hasError) {
      return (
        <View style={styles.container} testID="error-boundary-screen">
          <Text style={styles.kicker}>Something went off-script</Text>
          <Text style={styles.title}>Let’s get the joy flowing again.</Text>
          <Text style={styles.description}>
            Try reloading this screen. If it keeps happening, reopen the app and jump back in.
          </Text>
          <Pressable onPress={this.handleRetry} style={styles.button} testID="error-boundary-retry-button">
            <Text style={styles.buttonText}>Try again</Text>
          </Pressable>
        </View>
      );
    }

    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: joyTheme.background,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
    gap: 14,
  },
  kicker: {
    fontSize: 13,
    fontFamily: fonts.bold,
    color: joyTheme.accent,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
  },
  title: {
    fontSize: 28,
    fontFamily: fonts.extraBold,
    color: joyTheme.text,
    textAlign: 'center',
  },
  description: {
    fontSize: 16,
    lineHeight: 24,
    textAlign: 'center',
    color: joyTheme.textMuted,
  },
  button: {
    marginTop: 8,
    backgroundColor: joyTheme.success,
    paddingHorizontal: 22,
    paddingVertical: 14,
    borderRadius: 999,
  },
  buttonText: {
    color: joyTheme.textOnDark,
    fontSize: 15,
    fontFamily: fonts.bold,
  },
});
