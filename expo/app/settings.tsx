import { Image } from 'expo-image';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import React, { useCallback } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  ArrowLeft,
  Bell,
  ChevronRight,
  Globe,
  HelpCircle,
  Lock,
  LogOut,
  Mail,
  MapPin,
  Phone,
  Shield,
  User,
  Building2,
  Hash,
  Info,
} from 'lucide-react-native';

import { fonts } from '@/constants/fonts';
import { joyTheme } from '@/constants/joyTheme';
import { resolveImageUrl } from '@/lib/imageUtils';
import { useAuth } from '@/providers/AuthProvider';

function SettingsRow({
  label,
  value,
  icon: Icon,
  onPress,
  danger,
  showChevron = true,
}: {
  label: string;
  value?: string;
  icon: React.ComponentType<{ color?: string; size?: number }>;
  onPress?: () => void;
  danger?: boolean;
  showChevron?: boolean;
}) {
  const color = danger ? '#C23B22' : joyTheme.text;
  const iconColor = danger ? '#C23B22' : joyTheme.primary;
  const bgColor = danger ? '#FFF5F5' : '#FFFFFF';
  const iconBg = danger ? 'rgba(194,59,34,0.08)' : joyTheme.primarySoft;

  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      style={({ pressed }) => [
        styles.settingsRow,
        { backgroundColor: bgColor },
        pressed && onPress ? styles.rowPressed : null,
      ]}
    >
      <View style={[styles.settingsIconWrap, { backgroundColor: iconBg }]}>
        <Icon color={iconColor} size={18} />
      </View>
      <View style={styles.settingsTextWrap}>
        <Text style={[styles.settingsLabel, { color }]}>{label}</Text>
        {value ? <Text style={styles.settingsValue} numberOfLines={1}>{value}</Text> : null}
      </View>
      {showChevron && onPress ? (
        <ChevronRight color={danger ? '#C23B22' : joyTheme.textMuted} size={18} />
      ) : null}
    </Pressable>
  );
}

function SectionHeader({ title }: { title: string }) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionHeaderText}>{title}</Text>
    </View>
  );
}

export default function SettingsScreen() {
  const router = useRouter();
  const { user, role, profile, organization, signOut, isSigningOut, adminUser } = useAuth();

  const isOrg = role === 'organization';

  const handleSignOut = useCallback(() => {
    console.log('[Settings] Sign out requested');
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: async () => {
          try {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
            await signOut();
            console.log('[Settings] Sign out successful');
            router.replace('/welcome' as never);
          } catch (err) {
            console.error('[Settings] Sign out error:', err);
            Alert.alert('Error', 'Failed to sign out. Please try again.');
          }
        },
      },
    ]);
  }, [signOut, router]);

  const displayName = isOrg
    ? organization?.name ?? 'Organization'
    : profile?.full_name ?? user?.email ?? 'Joy Dealer';

  const initials = displayName
    .split(' ')
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <View style={styles.screen} testID="settings-screen">
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.header}>
          <Pressable
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
              router.back();
            }}
            style={styles.backButton}
            hitSlop={12}
          >
            <ArrowLeft color={joyTheme.text} size={22} />
          </Pressable>
          <Text style={styles.headerTitle}>Settings</Text>
          <View style={styles.backButton} />
        </View>

        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.accountCard}>
            {resolveImageUrl(profile?.avatar_url) ? (
              <Image source={{ uri: resolveImageUrl(profile?.avatar_url)! }} style={styles.avatarImage} contentFit="cover" />
            ) : (
              <View style={styles.avatarWrap}>
                <Text style={styles.avatarText}>{initials}</Text>
              </View>
            )}
            <View style={styles.accountInfo}>
              <Text style={styles.accountName}>{displayName}</Text>
              <Text style={styles.accountEmail}>{user?.email ?? adminUser?.email ?? ''}</Text>
              <View style={styles.rolePill}>
                {isOrg ? (
                  <Building2 color={joyTheme.primaryDark} size={12} />
                ) : (
                  <User color={joyTheme.primaryDark} size={12} />
                )}
                <Text style={styles.rolePillText}>
                  {isOrg ? 'Organization' : 'Volunteer'}
                </Text>
              </View>
            </View>
          </View>

          <Pressable
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
              router.push('/edit-profile' as never);
            }}
            style={({ pressed }) => [
              styles.editProfileBtn,
              pressed && styles.rowPressed,
            ]}
          >
            <Text style={styles.editProfileBtnText}>Edit Profile</Text>
          </Pressable>

          <SectionHeader title="Account Information" />
          <View style={styles.sectionCard}>
            <SettingsRow
              label="Email"
              value={user?.email ?? adminUser?.email ?? '—'}
              icon={Mail}
              showChevron={false}
            />
            {!isOrg && profile?.phone && (
              <SettingsRow
                label="Phone"
                value={profile.phone}
                icon={Phone}
                showChevron={false}
              />
            )}
            {!isOrg && profile?.city && (
              <SettingsRow
                label="City"
                value={profile.city}
                icon={MapPin}
                showChevron={false}
              />
            )}
            {!isOrg && profile?.interests && (
              <SettingsRow
                label="Interests"
                value={profile.interests}
                icon={Hash}
                showChevron={false}
              />
            )}
            {isOrg && organization?.contact_email && (
              <SettingsRow
                label="Contact Email"
                value={organization.contact_email}
                icon={User}
                showChevron={false}
              />
            )}
            {isOrg && organization?.contact_phone && (
              <SettingsRow
                label="Phone"
                value={organization.contact_phone}
                icon={Phone}
                showChevron={false}
              />
            )}
            {isOrg && organization?.city && (
              <SettingsRow
                label="Location"
                value={`${organization.city}${organization.state ? `, ${organization.state}` : ''}`}
                icon={MapPin}
                showChevron={false}
              />
            )}
            {isOrg && organization?.website && (
              <SettingsRow
                label="Website"
                value={organization.website}
                icon={Globe}
                showChevron={false}
              />
            )}
          </View>

          <SectionHeader title="Preferences" />
          <View style={styles.sectionCard}>
            <SettingsRow
              label="Notifications"
              icon={Bell}
              onPress={() => {
                Alert.alert('Notifications', 'Notification preferences coming soon.');
              }}
            />
            <SettingsRow
              label="Privacy & Security"
              icon={Lock}
              onPress={() => {
                Alert.alert('Privacy', 'Privacy settings coming soon.');
              }}
            />
          </View>

          <SectionHeader title="Support" />
          <View style={styles.sectionCard}>
            <SettingsRow
              label="Help Center"
              icon={HelpCircle}
              onPress={() => {
                Alert.alert('Help', 'Help center coming soon.');
              }}
            />
            <SettingsRow
              label="About Joy Dealer"
              icon={Info}
              onPress={() => {
                Alert.alert('About', 'Joy Dealer — Spreading joy through community service.');
              }}
            />
          </View>

          {(profile?.is_verified || organization?.is_verified) && (
            <View style={styles.verifiedBanner}>
              <Shield color={joyTheme.success} size={18} />
              <Text style={styles.verifiedBannerText}>Verified Account</Text>
            </View>
          )}

          <View style={styles.dangerSection}>
            <Pressable
              onPress={handleSignOut}
              disabled={isSigningOut}
              style={({ pressed }) => [
                styles.signOutButton,
                pressed && styles.rowPressed,
              ]}
              testID="settings-signout-btn"
            >
              {isSigningOut ? (
                <ActivityIndicator color="#C23B22" size="small" />
              ) : (
                <LogOut color="#C23B22" size={20} />
              )}
              <Text style={styles.signOutText}>Sign Out</Text>
            </Pressable>
          </View>

          <Text style={styles.versionText}>Joy Dealer v1.0.0</Text>

          <View style={styles.bottomSpacer} />
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: joyTheme.background,
  },
  safeArea: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: joyTheme.border,
    backgroundColor: '#FFFFFF',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontFamily: fonts.extraBold,
    color: joyTheme.text,
    letterSpacing: -0.3,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 40,
    gap: 8,
  },
  accountCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 18,
    gap: 16,
    borderWidth: 1,
    borderColor: joyTheme.border,
    marginBottom: 8,
  },
  avatarWrap: {
    width: 56,
    height: 56,
    borderRadius: 20,
    backgroundColor: joyTheme.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarImage: {
    width: 56,
    height: 56,
    borderRadius: 20,
  },
  avatarText: {
    fontSize: 20,
    fontFamily: fonts.black,
    color: joyTheme.primaryDark,
  },
  accountInfo: {
    flex: 1,
    gap: 3,
  },
  accountName: {
    fontSize: 17,
    fontFamily: fonts.extraBold,
    color: joyTheme.text,
    letterSpacing: -0.2,
  },
  accountEmail: {
    fontSize: 13,
    fontFamily: fonts.semiBold,
    color: joyTheme.textMuted,
  },
  rolePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: joyTheme.primarySoft,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    alignSelf: 'flex-start',
    marginTop: 4,
  },
  rolePillText: {
    fontSize: 11,
    fontFamily: fonts.bold,
    color: joyTheme.primaryDark,
  },
  sectionHeader: {
    paddingTop: 12,
    paddingBottom: 4,
    paddingHorizontal: 4,
  },
  sectionHeaderText: {
    fontSize: 13,
    fontFamily: fonts.bold,
    color: joyTheme.textMuted,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.6,
  },
  sectionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: joyTheme.border,
  },
  settingsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: joyTheme.border,
  },
  rowPressed: {
    opacity: 0.7,
  },
  settingsIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  settingsTextWrap: {
    flex: 1,
    gap: 2,
  },
  settingsLabel: {
    fontSize: 15,
    fontFamily: fonts.semiBold,
  },
  settingsValue: {
    fontSize: 13,
    fontFamily: fonts.medium,
    color: joyTheme.textMuted,
  },
  verifiedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: 'rgba(43,182,115,0.08)',
    borderRadius: 14,
    padding: 14,
    marginTop: 8,
    borderWidth: 1,
    borderColor: 'rgba(43,182,115,0.2)',
  },
  verifiedBannerText: {
    fontSize: 14,
    fontFamily: fonts.bold,
    color: joyTheme.success,
  },
  dangerSection: {
    marginTop: 16,
  },
  signOutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: '#FFF5F5',
    borderRadius: 16,
    paddingVertical: 16,
    borderWidth: 1,
    borderColor: '#FFD4D4',
  },
  signOutText: {
    fontSize: 16,
    fontFamily: fonts.bold,
    color: '#C23B22',
  },
  versionText: {
    fontSize: 12,
    fontFamily: fonts.semiBold,
    color: joyTheme.textMuted,
    textAlign: 'center',
    marginTop: 20,
  },
  editProfileBtn: {
    backgroundColor: joyTheme.primary,
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 8,
  },
  editProfileBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontFamily: fonts.extraBold,
  },
  bottomSpacer: {
    height: 20,
  },
});
