import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  Camera,
  Globe,
  Hash,
  Mail,
  MapPin,
  Phone,
  Save,
  User,
  Building2,
  FileText,
  AtSign,
} from 'lucide-react-native';
import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { fonts } from '@/constants/fonts';
import { joyTheme } from '@/constants/joyTheme';
import { resolveImageUrl } from '@/lib/imageUtils';
import { useAuth } from '@/providers/AuthProvider';
import { updateProfile, updateOrganization, uploadPhotoToStorage } from '@/lib/api';

function InputRow({
  label,
  value,
  onChangeText,
  icon: Icon,
  placeholder,
  keyboardType,
  multiline,
  autoCapitalize,
}: {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  icon: React.ComponentType<{ color?: string; size?: number }>;
  placeholder?: string;
  keyboardType?: 'default' | 'email-address' | 'phone-pad' | 'url';
  multiline?: boolean;
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
}) {
  return (
    <View style={styles.inputGroup}>
      <Text style={styles.label}>{label}</Text>
      <View style={[styles.inputWrap, multiline && styles.textAreaWrap]}>
        <Icon color={joyTheme.textMuted} size={18} />
        <TextInput
          style={[styles.input, multiline && styles.textArea]}
          placeholder={placeholder}
          placeholderTextColor={joyTheme.textMuted}
          value={value}
          onChangeText={onChangeText}
          keyboardType={keyboardType ?? 'default'}
          multiline={multiline}
          numberOfLines={multiline ? 4 : 1}
          textAlignVertical={multiline ? 'top' : 'center'}
          autoCapitalize={autoCapitalize ?? 'sentences'}
        />
      </View>
    </View>
  );
}

export default function EditProfileScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user, role, profile, organization, refreshProfile } = useAuth();

  const isOrg = role === 'organization';

  const [fullName, setFullName] = useState<string>(profile?.full_name ?? '');
  const [username, setUsername] = useState<string>(profile?.username ?? '');
  const [phone, setPhone] = useState<string>(isOrg ? (organization?.contact_phone ?? '') : (profile?.phone ?? ''));
  const [city, setCity] = useState<string>(isOrg ? (organization?.city ?? '') : (profile?.city ?? ''));
  const [interests, setInterests] = useState<string>(profile?.interests ?? '');

  const [orgName, setOrgName] = useState<string>(organization?.name ?? '');
  const [contactName, setContactName] = useState<string>('');
  const [contactEmail, setContactEmail] = useState<string>(organization?.contact_email ?? '');
  const [orgState, setOrgState] = useState<string>(organization?.state ?? '');
  const [orgWebsite, setOrgWebsite] = useState<string>(organization?.website ?? '');
  const [orgAddress, setOrgAddress] = useState<string>('');
  const [orgDescription, setOrgDescription] = useState<string>(organization?.description ?? '');
  const [avatarUri, setAvatarUri] = useState<string | null>(null);

  const avatarUploadMutation = useMutation({
    mutationFn: async () => {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (result.canceled || !result.assets?.[0]) {
        throw new Error('CANCELLED');
      }

      const asset = result.assets[0];
      setAvatarUri(asset.uri);

      const userId = user?.id ?? 'unknown';
      const storagePath = `avatars/${userId}_${Date.now()}.jpg`;
      const publicUrl = await uploadPhotoToStorage('avatars', storagePath, asset.uri, 'image/jpeg');

      if (isOrg && organization) {
        await updateOrganization(organization.id, { logo_url: publicUrl });
      } else if (user) {
        await updateProfile(user.id, { avatar_url: publicUrl });
      }

      return publicUrl;
    },
    onSuccess: () => {
      console.log('[EditProfile] Avatar uploaded successfully');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      void refreshProfile();
      void queryClient.invalidateQueries({ queryKey: ['leaderboard'] });
    },
    onError: (err: Error) => {
      if (err.message === 'CANCELLED') return;
      console.error('[EditProfile] Avatar upload error:', err.message);
      Alert.alert('Upload Failed', err.message || 'Failed to upload photo.');
      setAvatarUri(null);
    },
  });

  const updateProfileMutation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error('Not authenticated');
      if (isOrg && organization) {
        await updateOrganization(organization.id, {
          name: orgName.trim() || undefined,
          contact_email: contactEmail.trim() || undefined,
          contact_phone: phone.trim() || undefined,
          city: city.trim() || undefined,
          state: orgState.trim() || undefined,
          website: orgWebsite.trim() || undefined,
          description: orgDescription.trim() || undefined,
        });
      } else {
        await updateProfile(user.id, {
          full_name: fullName.trim() || undefined,
          username: username.trim() || undefined,
          phone: phone.trim() || undefined,
          city: city.trim() || undefined,
          interests: interests.trim() || undefined,
        });
      }
    },
    onSuccess: () => {
      console.log('[EditProfile] Profile updated successfully');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      void queryClient.invalidateQueries({ queryKey: ['user-events'] });
      void queryClient.invalidateQueries({ queryKey: ['user-rank'] });
      void queryClient.invalidateQueries({ queryKey: ['profile-points'] });
      void queryClient.invalidateQueries({ queryKey: ['followers-count'] });
      void queryClient.invalidateQueries({ queryKey: ['following-count'] });
      void queryClient.invalidateQueries({ queryKey: ['org-stats'] });
      void queryClient.invalidateQueries({ queryKey: ['org-events'] });
      void queryClient.invalidateQueries({ queryKey: ['leaderboard'] });
      void refreshProfile();
      Alert.alert('Saved!', 'Your profile has been updated.', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    },
    onError: (error: Error) => {
      console.error('[EditProfile] Update error:', error.message);
      Alert.alert('Error', error.message || 'Failed to update profile.');
    },
  });

  const handleSave = useCallback(() => {
    console.log('[EditProfile] Saving profile changes');
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    updateProfileMutation.mutate();
  }, [updateProfileMutation]);

  const displayName = isOrg ? orgName : fullName;
  const initials = (displayName || 'JD')
    .split(' ')
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <View style={styles.screen} testID="edit-profile-screen">
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.header}>
          <Pressable
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
              router.back();
            }}
            style={styles.headerBtn}
            hitSlop={12}
          >
            <ArrowLeft color={joyTheme.text} size={22} />
          </Pressable>
          <Text style={styles.headerTitle}>Edit Profile</Text>
          <Pressable
            onPress={handleSave}
            style={styles.saveBtn}
            hitSlop={12}
            disabled={updateProfileMutation.isPending}
          >
            {updateProfileMutation.isPending ? (
              <ActivityIndicator color={joyTheme.primary} size="small" />
            ) : (
              <Save color={joyTheme.primary} size={20} />
            )}
          </Pressable>
        </View>

        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <ScrollView
            contentContainerStyle={styles.content}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.avatarSection}>
              {avatarUri ? (
                <Image source={{ uri: avatarUri }} style={styles.avatar} contentFit="cover" />
              ) : isOrg && resolveImageUrl(organization?.logo_url) ? (
                <Image source={{ uri: resolveImageUrl(organization?.logo_url)! }} style={styles.avatar} contentFit="cover" />
              ) : resolveImageUrl(profile?.avatar_url) ? (
                <Image source={{ uri: resolveImageUrl(profile?.avatar_url)! }} style={styles.avatar} contentFit="cover" />
              ) : (
                <View style={styles.avatarPlaceholder}>
                  <Text style={styles.avatarText}>{initials}</Text>
                </View>
              )}
              <Pressable
                style={styles.changePhotoBtn}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                  avatarUploadMutation.mutate();
                }}
                disabled={avatarUploadMutation.isPending}
              >
                {avatarUploadMutation.isPending ? (
                  <ActivityIndicator color={joyTheme.primary} size="small" />
                ) : (
                  <>
                    <Camera color={joyTheme.primary} size={16} />
                    <Text style={styles.changePhotoText}>Change Photo</Text>
                  </>
                )}
              </Pressable>
            </View>

            {!isOrg ? (
              <>
                <InputRow
                  label="Full Name"
                  value={fullName}
                  onChangeText={setFullName}
                  icon={User}
                  placeholder="Your full name"
                  autoCapitalize="words"
                />
                <InputRow
                  label="Username"
                  value={username}
                  onChangeText={setUsername}
                  icon={AtSign}
                  placeholder="@username"
                  autoCapitalize="none"
                />
                <InputRow
                  label="Phone"
                  value={phone}
                  onChangeText={setPhone}
                  icon={Phone}
                  placeholder="(555) 123-4567"
                  keyboardType="phone-pad"
                />
                <InputRow
                  label="City"
                  value={city}
                  onChangeText={setCity}
                  icon={MapPin}
                  placeholder="e.g. Miami"
                />
                <InputRow
                  label="Interests"
                  value={interests}
                  onChangeText={setInterests}
                  icon={Hash}
                  placeholder="e.g. education, environment, food"
                />
              </>
            ) : (
              <>
                <InputRow
                  label="Organization Name"
                  value={orgName}
                  onChangeText={setOrgName}
                  icon={Building2}
                  placeholder="Organization name"
                />
                <InputRow
                  label="Contact Person"
                  value={contactName}
                  onChangeText={setContactName}
                  icon={User}
                  placeholder="Primary contact name"
                  autoCapitalize="words"
                />
                <InputRow
                  label="Contact Email"
                  value={contactEmail}
                  onChangeText={setContactEmail}
                  icon={Mail}
                  placeholder="contact@org.com"
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
                <InputRow
                  label="Phone"
                  value={phone}
                  onChangeText={setPhone}
                  icon={Phone}
                  placeholder="(555) 123-4567"
                  keyboardType="phone-pad"
                />
                <InputRow
                  label="City"
                  value={city}
                  onChangeText={setCity}
                  icon={MapPin}
                  placeholder="City"
                />
                <InputRow
                  label="State"
                  value={orgState}
                  onChangeText={setOrgState}
                  icon={MapPin}
                  placeholder="FL"
                  autoCapitalize="characters"
                />
                <InputRow
                  label="Address"
                  value={orgAddress}
                  onChangeText={setOrgAddress}
                  icon={MapPin}
                  placeholder="123 Main St"
                />
                <InputRow
                  label="Website"
                  value={orgWebsite}
                  onChangeText={setOrgWebsite}
                  icon={Globe}
                  placeholder="https://yourorg.org"
                  keyboardType="url"
                  autoCapitalize="none"
                />
                <InputRow
                  label="Description"
                  value={orgDescription}
                  onChangeText={setOrgDescription}
                  icon={FileText}
                  placeholder="Tell people about your organization..."
                  multiline
                />
              </>
            )}

            <Pressable
              onPress={handleSave}
              disabled={updateProfileMutation.isPending}
              style={({ pressed }) => [
                styles.submitButton,
                pressed && { opacity: 0.9 },
                updateProfileMutation.isPending && { opacity: 0.6 },
              ]}
            >
              {updateProfileMutation.isPending ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={styles.submitButtonText}>Save Changes</Text>
              )}
            </Pressable>

            <View style={styles.bottomSpacer} />
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: joyTheme.background,
  },
  flex: {
    flex: 1,
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
  headerBtn: {
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
  saveBtn: {
    width: 40,
    height: 40,
    borderRadius: 14,
    backgroundColor: joyTheme.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 40,
    gap: 18,
  },
  avatarSection: {
    alignItems: 'center',
    gap: 12,
    paddingBottom: 8,
  },
  avatar: {
    width: 96,
    height: 96,
    borderRadius: 34,
    borderWidth: 3,
    borderColor: joyTheme.border,
  },
  avatarPlaceholder: {
    width: 96,
    height: 96,
    borderRadius: 34,
    backgroundColor: joyTheme.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: joyTheme.border,
  },
  avatarText: {
    fontSize: 34,
    fontFamily: fonts.black,
    color: joyTheme.primaryDark,
  },
  changePhotoBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: joyTheme.primarySoft,
  },
  changePhotoText: {
    fontSize: 14,
    fontFamily: fonts.bold,
    color: joyTheme.primaryDark,
  },
  inputGroup: {
    gap: 8,
  },
  label: {
    fontSize: 14,
    fontFamily: fonts.bold,
    color: joyTheme.text,
    paddingLeft: 4,
  },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
    borderWidth: 1,
    borderColor: joyTheme.border,
  },
  textAreaWrap: {
    alignItems: 'flex-start',
    minHeight: 100,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: joyTheme.text,
    padding: 0,
  },
  textArea: {
    minHeight: 72,
  },
  submitButton: {
    backgroundColor: joyTheme.primary,
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontFamily: fonts.extraBold,
  },
  bottomSpacer: {
    height: 20,
  },
});
