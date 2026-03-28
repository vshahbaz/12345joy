import { useLocalSearchParams, useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { ArrowLeft, RotateCw, Share2 } from 'lucide-react-native';
import React, { useCallback, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

let WebView: any = null;
if (Platform.OS !== 'web') {
  try {
    WebView = require('react-native-webview').WebView;
  } catch {
    console.log('[DonateWebView] WebView not available');
  }
}

import { fonts } from '@/constants/fonts';
import { joyTheme } from '@/constants/joyTheme';

export default function DonateWebViewScreen() {
  const router = useRouter();
  const { url, title } = useLocalSearchParams<{ url: string; title?: string }>();
  const webViewRef = useRef<any>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [pageTitle, setPageTitle] = useState<string>(title ?? 'Donate');

  const handleBack = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    router.back();
  }, [router]);

  const handleReload = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    webViewRef.current?.reload();
  }, []);

  const handleShare = useCallback(async () => {
    if (!url) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    try {
      const shareContent = Platform.OS === 'ios'
        ? { url, title: pageTitle }
        : { message: url, title: pageTitle };
      await Share.share(shareContent);
    } catch (err) {
      console.log('[DonateWebView] Share error:', err);
    }
  }, [url, pageTitle]);

  if (!url) {
    return (
      <View style={styles.root}>
        <SafeAreaView style={styles.safeArea} edges={['top']}>
          <View style={styles.header}>
            <Pressable onPress={handleBack} style={styles.headerBtn} hitSlop={12}>
              <ArrowLeft color={joyTheme.text} size={22} />
            </Pressable>
            <Text style={styles.headerTitle}>Donate</Text>
            <View style={styles.headerBtn} />
          </View>
        </SafeAreaView>
        <View style={styles.errorWrap}>
          <Text style={styles.errorText}>No donation URL provided.</Text>
          <Pressable onPress={handleBack} style={styles.errorBtn}>
            <Text style={styles.errorBtnText}>Go Back</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  if (Platform.OS === 'web') {
    return (
      <View style={styles.root}>
        <SafeAreaView style={styles.safeArea} edges={['top']}>
          <View style={styles.header}>
            <Pressable onPress={handleBack} style={styles.headerBtn} hitSlop={12}>
              <ArrowLeft color={joyTheme.text} size={22} />
            </Pressable>
            <Text style={styles.headerTitle} numberOfLines={1}>{pageTitle}</Text>
            <View style={styles.headerBtn} />
          </View>
        </SafeAreaView>
        <iframe
          src={url}
          style={{ flex: 1, border: 'none', width: '100%', height: '100%' } as any}
          title={pageTitle}
        />
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.header}>
          <Pressable onPress={handleBack} style={styles.headerBtn} hitSlop={12}>
            <ArrowLeft color={joyTheme.text} size={22} />
          </Pressable>
          <View style={styles.headerTitleWrap}>
            <Text style={styles.headerTitle} numberOfLines={1}>{pageTitle}</Text>
            {url ? (
              <Text style={styles.headerUrl} numberOfLines={1}>
                {new URL(url).hostname}
              </Text>
            ) : null}
          </View>
          <View style={styles.headerActions}>
            <Pressable onPress={handleReload} style={styles.headerBtn} hitSlop={8}>
              <RotateCw color={joyTheme.textMuted} size={18} />
            </Pressable>
            <Pressable onPress={handleShare} style={styles.headerBtn} hitSlop={8}>
              <Share2 color={joyTheme.textMuted} size={18} />
            </Pressable>
          </View>
        </View>
        {isLoading ? (
          <View style={styles.loadingBar}>
            <View style={styles.loadingBarFill} />
          </View>
        ) : null}
      </SafeAreaView>

      <WebView
        ref={webViewRef}
        source={{ uri: url }}
        style={styles.webview}
        onLoadStart={() => setIsLoading(true)}
        onLoadEnd={() => setIsLoading(false)}
        onNavigationStateChange={(navState: { title?: string }) => {
          if (navState.title && navState.title !== url) {
            setPageTitle(navState.title);
          }
        }}
        startInLoadingState
        renderLoading={() => (
          <View style={styles.webviewLoading}>
            <ActivityIndicator size="large" color={joyTheme.primary} />
          </View>
        )}
        javaScriptEnabled
        domStorageEnabled
        allowsInlineMediaPlayback
        sharedCookiesEnabled
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: joyTheme.background,
  },
  safeArea: {
    backgroundColor: joyTheme.surface,
    borderBottomWidth: 1,
    borderBottomColor: joyTheme.border,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
  },
  headerBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 18,
  },
  headerTitleWrap: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 16,
    fontFamily: fonts.bold,
    color: joyTheme.text,
    letterSpacing: -0.3,
  },
  headerUrl: {
    fontSize: 11,
    color: joyTheme.textMuted,
    marginTop: 1,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  loadingBar: {
    height: 2,
    backgroundColor: joyTheme.border,
    overflow: 'hidden',
  },
  loadingBarFill: {
    height: 2,
    width: '40%',
    backgroundColor: joyTheme.primary,
    borderRadius: 1,
  },
  webview: {
    flex: 1,
  },
  webviewLoading: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: joyTheme.background,
  },
  errorWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    paddingHorizontal: 32,
  },
  errorText: {
    fontSize: 16,
    color: joyTheme.textMuted,
    textAlign: 'center',
  },
  errorBtn: {
    backgroundColor: joyTheme.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  errorBtnText: {
    fontSize: 15,
    fontFamily: fonts.bold,
    color: '#fff',
  },
});
