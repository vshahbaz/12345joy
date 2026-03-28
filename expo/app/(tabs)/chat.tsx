import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import {
  MessageCircle,
  Search,
  Building2,
  Megaphone,
  Send,
  Plus,
  ChevronRight,
  X,
  PenSquare,
} from 'lucide-react-native';
import React, { useCallback, useMemo, useState, useRef } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  Animated as RNAnimated,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { joyTheme } from '@/constants/joyTheme';
import { resolveImageUrl } from '@/lib/imageUtils';
import { useAuth } from '@/providers/AuthProvider';
import {
  fetchConversations,
  fetchOrgVolunteers,
  fetchAllOrganizations,
  fetchAnnouncementHistory,
  fetchNotifications,
  fetchFollowing,
  fetchFollowingOrganizations,
} from '@/lib/api';
import type { DbProfile, DbOrganization, DbNotification, ConversationThread } from '@/types/database';

type PrimaryTab = 'chats' | 'announcements';

function formatRelativeTime(dateStr?: string): string {
  if (!dateStr) return '';
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  if (diffMins < 1) return 'Now';
  if (diffMins < 60) return `${diffMins}m`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays}d`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}w`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export default function ChatScreen() {
  const router = useRouter();
  const { role, organization, user, adminUser } = useAuth();
  const isOrg = role === 'organization';
  const orgId = organization?.id ?? '';
  const userId = user?.id ?? adminUser?.id ?? '';

  const [primaryTab, setPrimaryTab] = useState<PrimaryTab>('chats');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [searchFocused, setSearchFocused] = useState<boolean>(false);
  const [showNewChatModal, setShowNewChatModal] = useState<boolean>(false);
  const [newChatSearch, setNewChatSearch] = useState<string>('');
  const searchAnim = useRef(new RNAnimated.Value(0)).current;

  const conversationsQuery = useQuery({
    queryKey: ['conversations', userId],
    queryFn: () => fetchConversations(userId),
    enabled: !!userId,
  });

  const volunteersQuery = useQuery({
    queryKey: ['org-volunteers', orgId],
    queryFn: () => fetchOrgVolunteers(orgId),
    enabled: isOrg && !!orgId && showNewChatModal,
  });

  const allOrgsQuery = useQuery({
    queryKey: ['all-organizations'],
    queryFn: fetchAllOrganizations,
    enabled: !isOrg && showNewChatModal,
  });

  const followingPeopleQuery = useQuery({
    queryKey: ['following-people', userId],
    queryFn: () => fetchFollowing(userId),
    enabled: !isOrg && !!userId && showNewChatModal,
  });

  const followingOrgsQuery = useQuery({
    queryKey: ['following-orgs', userId],
    queryFn: () => fetchFollowingOrganizations(userId),
    enabled: !isOrg && !!userId && showNewChatModal,
  });

  const announcementsQuery = useQuery({
    queryKey: ['announcement-history', orgId],
    queryFn: () => fetchAnnouncementHistory(orgId),
    enabled: isOrg && !!orgId,
  });

  const volunteerNotificationsQuery = useQuery({
    queryKey: ['volunteer-announcements', userId],
    queryFn: async () => {
      const notifs = await fetchNotifications(userId);
      return notifs.filter((n) => n.type === 'announcement');
    },
    enabled: !isOrg && !!userId,
  });

  const conversations = useMemo(() => conversationsQuery.data ?? [], [conversationsQuery.data]);

  const filteredConversations = useMemo(() => {
    if (!searchQuery.trim()) return conversations;
    const q = searchQuery.toLowerCase();
    return conversations.filter(
      (c) => c.otherPartyName.toLowerCase().includes(q) || c.lastMessage.toLowerCase().includes(q)
    );
  }, [conversations, searchQuery]);

  const announcements = useMemo(() => {
    if (isOrg) return announcementsQuery.data ?? [];
    return volunteerNotificationsQuery.data ?? [];
  }, [isOrg, announcementsQuery.data, volunteerNotificationsQuery.data]);

  const filteredAnnouncements = useMemo(() => {
    if (!searchQuery.trim()) return announcements;
    const q = searchQuery.toLowerCase();
    return announcements.filter(
      (a) =>
        a.title.toLowerCase().includes(q) ||
        a.message.toLowerCase().includes(q)
    );
  }, [announcements, searchQuery]);

  const totalUnread = useMemo(() => {
    return conversations.reduce((sum, c) => sum + c.unreadCount, 0);
  }, [conversations]);  // eslint-disable-line react-hooks/exhaustive-deps

  const newChatContacts = useMemo(() => {
    if (isOrg) {
      const volunteers = (volunteersQuery.data ?? []).map((v: DbProfile) => ({
        id: v.id,
        name: v.full_name ?? 'Volunteer',
        avatar: resolveImageUrl(v.avatar_url) ?? null,
        subtitle: v.city ?? 'Volunteer',
        type: 'user' as const,
      }));
      if (!newChatSearch.trim()) return volunteers;
      const q = newChatSearch.toLowerCase();
      return volunteers.filter((c) => c.name.toLowerCase().includes(q) || c.subtitle.toLowerCase().includes(q));
    }

    const people = (followingPeopleQuery.data ?? []).map((p: DbProfile) => ({
      id: p.id,
      name: p.full_name ?? 'User',
      avatar: resolveImageUrl(p.avatar_url) ?? null,
      subtitle: p.city ?? 'Volunteer',
      type: 'user' as const,
    }));
    const orgs = (allOrgsQuery.data ?? []).map((o: DbOrganization) => ({
      id: o.id,
      name: o.name ?? 'Organization',
      avatar: resolveImageUrl(o.logo_url) ?? null,
      subtitle: o.city ? `${o.city}${o.state ? `, ${o.state}` : ''}` : 'Organization',
      type: 'organization' as const,
    }));
    const all = [...people, ...orgs];
    if (!newChatSearch.trim()) return all;
    const q = newChatSearch.toLowerCase();
    return all.filter((c) => c.name.toLowerCase().includes(q) || c.subtitle.toLowerCase().includes(q));
  }, [isOrg, volunteersQuery.data, followingPeopleQuery.data, allOrgsQuery.data, newChatSearch]);

  const handlePrimaryTabChange = useCallback((tab: PrimaryTab) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setPrimaryTab(tab);
    setSearchQuery('');
  }, []);

  const handleConversationPress = useCallback((thread: ConversationThread) => {
    console.log('[Chat] Opening conversation with:', thread.otherPartyId, thread.otherPartyName, 'type:', thread.conversationType);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    router.push({
      pathname: '/conversation' as never,
      params: {
        id: thread.otherPartyId,
        name: thread.otherPartyName,
        type: thread.otherPartyType,
        avatar: thread.otherPartyAvatar ?? '',
        conversationType: thread.conversationType,
        conversationId: thread.id,
      },
    });
  }, [router]);

  const handleNewChatContactPress = useCallback((contact: { id: string; name: string; type: string; avatar: string | null }) => {
    console.log('[Chat] Starting conversation with:', contact.id, contact.name);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setShowNewChatModal(false);
    setNewChatSearch('');
    const isOrgContact = contact.type === 'organization';
    const contactIsOrg = isOrgContact;
    const convType = (isOrg || contactIsOrg) ? 'org_volunteer' : 'volunteer';
    router.push({
      pathname: '/conversation' as never,
      params: {
        id: contact.id,
        name: contact.name,
        type: isOrgContact ? 'organization' : 'user',
        avatar: contact.avatar ?? '',
        conversationType: convType,
      },
    });
  }, [router, isOrg]);

  const handleNewChat = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setShowNewChatModal(true);
  }, []);

  const handleSearchFocus = useCallback(() => {
    setSearchFocused(true);
    RNAnimated.spring(searchAnim, {
      toValue: 1,
      useNativeDriver: false,
      tension: 200,
      friction: 25,
    }).start();
  }, [searchAnim]);

  const handleSearchBlur = useCallback(() => {
    setSearchFocused(false);
    RNAnimated.spring(searchAnim, {
      toValue: 0,
      useNativeDriver: false,
      tension: 200,
      friction: 25,
    }).start();
  }, [searchAnim]);

  const searchBorderColor = searchAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [joyTheme.border, joyTheme.gold],
  });

  const conversationsRefetch = conversationsQuery.refetch;
  const announcementsRefetch = announcementsQuery.refetch;
  const volunteerNotificationsRefetch = volunteerNotificationsQuery.refetch;

  const handleRefresh = useCallback(() => {
    console.log('[Chat] Refreshing conversations');
    void conversationsRefetch();
    if (isOrg) {
      void announcementsRefetch();
    } else {
      void volunteerNotificationsRefetch();
    }
  }, [conversationsRefetch, announcementsRefetch, volunteerNotificationsRefetch, isOrg]);

  const renderConversation = useCallback(({ item, index }: { item: ConversationThread; index: number }) => {
    const initials = item.otherPartyName
      .split(' ')
      .map((n) => n[0])
      .join('')
      .slice(0, 2)
      .toUpperCase();
    const avatarUrl = resolveImageUrl(item.otherPartyAvatar);
    const isEven = index % 2 === 0;
    const hasUnread = item.unreadCount > 0;

    return (
      <Pressable
        style={({ pressed }) => [styles.conversationItem, pressed && styles.conversationItemPressed, hasUnread && styles.conversationItemUnread]}
        onPress={() => handleConversationPress(item)}
        testID={`conversation-${item.id}`}
      >
        <View style={styles.conversationInner}>
          <View style={styles.avatarContainer}>
            {avatarUrl ? (
              <Image source={{ uri: avatarUrl }} style={styles.avatar} contentFit="cover" />
            ) : (
              <LinearGradient
                colors={item.otherPartyType === 'organization'
                  ? ['#1C1C1E', '#3A3A3C']
                  : isEven ? ['#C8A24D', '#D4B568'] : ['#1A8B5E', '#2BB673']}
                style={[styles.avatar, styles.avatarGradient]}
              >
                {item.otherPartyType === 'organization' ? (
                  <Building2 color="#F9F3E3" size={18} />
                ) : (
                  <Text style={styles.avatarInitials}>{initials}</Text>
                )}
              </LinearGradient>
            )}
            {hasUnread && <View style={styles.onlineDot} />}
          </View>
          <View style={styles.conversationText}>
            <View style={styles.conversationNameRow}>
              <Text style={[styles.conversationName, hasUnread && styles.conversationNameUnread]} numberOfLines={1}>
                {item.otherPartyName}
              </Text>
              {item.otherPartyType === 'organization' && (
                <View style={styles.orgBadge}>
                  <Text style={styles.orgBadgeText}>ORG</Text>
                </View>
              )}
            </View>
            <Text style={[styles.conversationPreview, hasUnread && styles.conversationPreviewUnread]} numberOfLines={1}>
              {item.lastMessage}
            </Text>
          </View>
          <View style={styles.conversationMeta}>
            <Text style={[styles.conversationTime, hasUnread && styles.conversationTimeUnread]}>
              {formatRelativeTime(item.lastMessageAt)}
            </Text>
            {hasUnread && (
              <View style={styles.unreadBadge}>
                <Text style={styles.unreadBadgeText}>{item.unreadCount > 99 ? '99+' : item.unreadCount}</Text>
              </View>
            )}
          </View>
        </View>
      </Pressable>
    );
  }, [handleConversationPress]);

  const renderAnnouncement = useCallback(({ item }: { item: DbNotification }) => {
    const timeAgo = formatRelativeTime(item.created_at);
    const orgName = item.data?.organization_name ?? 'Organization';

    return (
      <Pressable
        style={({ pressed }) => [styles.conversationItem, pressed && styles.conversationItemPressed]}
        testID={`announcement-${item.id}`}
      >
        <View style={styles.conversationInner}>
          <View style={styles.avatarContainer}>
            <LinearGradient
              colors={['#C8A24D', '#A68635']}
              style={[styles.avatar, styles.avatarGradient]}
            >
              <Megaphone color="#FFF" size={16} />
            </LinearGradient>
          </View>
          <View style={styles.conversationText}>
            <Text style={styles.conversationName} numberOfLines={1}>{item.title}</Text>
            <Text style={styles.conversationPreview} numberOfLines={2}>{item.message}</Text>
            {!isOrg && (
              <View style={styles.announcementOrgRow}>
                <Building2 color={joyTheme.textMuted} size={11} />
                <Text style={styles.announcementOrgName}>{orgName}</Text>
              </View>
            )}
          </View>
          <View style={styles.conversationMeta}>
            <Text style={styles.conversationTime}>{timeAgo}</Text>
            {!item.read && <View style={styles.unreadDot} />}
          </View>
        </View>
      </Pressable>
    );
  }, [isOrg]);

  const renderChatsContent = () => {
    if (conversationsQuery.isLoading) {
      return (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={joyTheme.gold} />
          <Text style={styles.loadingText}>Loading conversations...</Text>
        </View>
      );
    }

    if (filteredConversations.length === 0) {
      return (
        <View style={styles.emptyState}>
          <View style={styles.emptyIconCircle}>
            <MessageCircle color={joyTheme.gold} size={32} strokeWidth={1.2} />
          </View>
          <Text style={styles.emptyTitle}>
            {searchQuery ? 'No results found' : 'No conversations yet'}
          </Text>
          <Text style={styles.emptySubtitle}>
            {searchQuery
              ? 'Try a different search term'
              : 'Start a new conversation to connect with others'}
          </Text>
          {!searchQuery && (
            <Pressable
              style={({ pressed }) => [styles.emptyActionBtn, pressed && { opacity: 0.85, transform: [{ scale: 0.97 }] }]}
              onPress={handleNewChat}
            >
              <PenSquare color="#FFF" size={14} />
              <Text style={styles.emptyActionBtnText}>New Conversation</Text>
            </Pressable>
          )}
        </View>
      );
    }

    return (
      <FlatList
        data={filteredConversations}
        renderItem={renderConversation}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={conversationsQuery.isFetching && !conversationsQuery.isLoading}
            onRefresh={handleRefresh}
            tintColor={joyTheme.gold}
          />
        }
        testID="conversations-list"
      />
    );
  };

  const renderAnnouncementsContent = () => {
    const isAnnouncementsLoading = isOrg ? announcementsQuery.isLoading : volunteerNotificationsQuery.isLoading;

    if (isAnnouncementsLoading) {
      return (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={joyTheme.gold} />
          <Text style={styles.loadingText}>Loading announcements...</Text>
        </View>
      );
    }

    if (filteredAnnouncements.length === 0) {
      return (
        <View style={styles.emptyState}>
          <View style={[styles.emptyIconCircle, { backgroundColor: joyTheme.goldSoft }]}>
            <Megaphone color={joyTheme.gold} size={32} strokeWidth={1.2} />
          </View>
          <Text style={styles.emptyTitle}>
            {searchQuery ? 'No results found' : 'No announcements yet'}
          </Text>
          <Text style={styles.emptySubtitle}>
            {searchQuery
              ? 'Try a different search term'
              : isOrg
                ? 'Send your first announcement to volunteers'
                : 'Announcements from organizations will appear here'}
          </Text>
          {isOrg && !searchQuery && (
            <Pressable
              style={({ pressed }) => [styles.emptyActionBtn, pressed && { opacity: 0.85 }]}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                router.push('/send-announcement' as never);
              }}
            >
              <Megaphone color="#FFF" size={14} />
              <Text style={styles.emptyActionBtnText}>Send Announcement</Text>
            </Pressable>
          )}
        </View>
      );
    }

    return (
      <>
        {isOrg && (
          <Pressable
            style={({ pressed }) => [styles.newAnnouncementBanner, pressed && { opacity: 0.9 }]}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
              router.push('/send-announcement' as never);
            }}
          >
            <View style={styles.newAnnouncementIcon}>
              <Send color={joyTheme.gold} size={16} />
            </View>
            <View style={styles.newAnnouncementText}>
              <Text style={styles.newAnnouncementTitle}>New Announcement</Text>
              <Text style={styles.newAnnouncementSub}>Broadcast to all volunteers</Text>
            </View>
            <ChevronRight color={joyTheme.textMuted} size={16} />
          </Pressable>
        )}
        <FlatList
          data={filteredAnnouncements}
          renderItem={renderAnnouncement}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          testID="announcements-list"
        />
      </>
    );
  };

  const newChatModalIsLoading = isOrg
    ? volunteersQuery.isLoading
    : allOrgsQuery.isLoading || followingPeopleQuery.isLoading || followingOrgsQuery.isLoading;

  return (
    <View style={styles.screen} testID="chat-screen">
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.header}>
          <View style={styles.headerRow}>
            <View style={styles.headerTitleRow}>
              <MessageCircle color={joyTheme.text} size={22} />
              <Text style={styles.headerTitle}>MESSAGES</Text>
              {totalUnread > 0 && (
                <View style={styles.headerUnreadBadge}>
                  <Text style={styles.headerUnreadText}>{totalUnread > 99 ? '99+' : totalUnread}</Text>
                </View>
              )}
            </View>
            <Pressable
              style={({ pressed }) => [styles.newChatBtn, pressed && { opacity: 0.85, transform: [{ scale: 0.96 }] }]}
              onPress={handleNewChat}
              testID="new-chat-button"
            >
              <Plus color="#FFF" size={16} strokeWidth={2.5} />
              <Text style={styles.newChatBtnText}>New</Text>
            </Pressable>
          </View>

          <View style={styles.primaryTabs}>
            <Pressable
              style={[styles.primaryTab, primaryTab === 'chats' && styles.primaryTabActive]}
              onPress={() => handlePrimaryTabChange('chats')}
              testID="primary-tab-chats"
            >
              <MessageCircle
                color={primaryTab === 'chats' ? joyTheme.gold : joyTheme.textMuted}
                size={14}
              />
              <Text style={[styles.primaryTabText, primaryTab === 'chats' && styles.primaryTabTextActive]}>
                Chats
              </Text>
              {totalUnread > 0 && primaryTab !== 'chats' && (
                <View style={styles.tabBadge}>
                  <Text style={styles.tabBadgeText}>{totalUnread}</Text>
                </View>
              )}
            </Pressable>
            <Pressable
              style={[styles.primaryTab, primaryTab === 'announcements' && styles.primaryTabActive]}
              onPress={() => handlePrimaryTabChange('announcements')}
              testID="primary-tab-announcements"
            >
              <Megaphone
                color={primaryTab === 'announcements' ? joyTheme.gold : joyTheme.textMuted}
                size={14}
              />
              <Text style={[styles.primaryTabText, primaryTab === 'announcements' && styles.primaryTabTextActive]}>
                Announcements
              </Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.body}>
          <RNAnimated.View style={[styles.searchContainer, { borderColor: searchBorderColor }]}>
            <Search color={searchFocused ? joyTheme.gold : joyTheme.textMuted} size={16} />
            <TextInput
              style={styles.searchInput}
              placeholder={primaryTab === 'chats' ? 'Search conversations...' : 'Search announcements...'}
              placeholderTextColor={joyTheme.textMuted}
              value={searchQuery}
              onChangeText={setSearchQuery}
              onFocus={handleSearchFocus}
              onBlur={handleSearchBlur}
              autoCorrect={false}
              testID="chat-search-input"
            />
            {searchQuery.length > 0 && (
              <Pressable onPress={() => setSearchQuery('')} hitSlop={8}>
                <View style={styles.clearBtn}>
                  <Text style={styles.clearBtnText}>×</Text>
                </View>
              </Pressable>
            )}
          </RNAnimated.View>

          <View style={styles.contentArea}>
            {primaryTab === 'chats' ? renderChatsContent() : renderAnnouncementsContent()}
          </View>
        </View>
      </SafeAreaView>

      <Modal
        visible={showNewChatModal}
        animationType="slide"
        transparent
        onRequestClose={() => { setShowNewChatModal(false); setNewChatSearch(''); }}
        testID="new-chat-modal"
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <SafeAreaView edges={['bottom']}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>New Conversation</Text>
                <Pressable
                  onPress={() => { setShowNewChatModal(false); setNewChatSearch(''); }}
                  hitSlop={12}
                >
                  <X color={joyTheme.text} size={22} />
                </Pressable>
              </View>

              <View style={styles.modalSearchWrap}>
                <Search color={joyTheme.textMuted} size={16} />
                <TextInput
                  style={styles.modalSearchInput}
                  placeholder={isOrg ? 'Search volunteers...' : 'Search people & organizations...'}
                  placeholderTextColor={joyTheme.textMuted}
                  value={newChatSearch}
                  onChangeText={setNewChatSearch}
                  autoCapitalize="none"
                  autoFocus
                  testID="new-chat-search-input"
                />
                {newChatSearch.length > 0 && (
                  <Pressable onPress={() => setNewChatSearch('')} hitSlop={8}>
                    <View style={styles.clearBtn}>
                      <Text style={styles.clearBtnText}>×</Text>
                    </View>
                  </Pressable>
                )}
              </View>

              {newChatModalIsLoading ? (
                <View style={styles.modalLoading}>
                  <ActivityIndicator size="small" color={joyTheme.gold} />
                  <Text style={styles.loadingText}>Loading contacts...</Text>
                </View>
              ) : newChatContacts.length === 0 ? (
                <View style={styles.modalEmpty}>
                  <Search color={joyTheme.textMuted} size={28} />
                  <Text style={styles.modalEmptyText}>
                    {newChatSearch ? 'No results found' : 'Search for people or organizations'}
                  </Text>
                </View>
              ) : (
                <FlatList
                  data={newChatContacts}
                  keyExtractor={(item) => `${item.type}-${item.id}`}
                  style={styles.modalList}
                  keyboardShouldPersistTaps="handled"
                  renderItem={({ item, index }) => {
                    const initials = item.name
                      .split(' ')
                      .map((n) => n[0])
                      .join('')
                      .slice(0, 2)
                      .toUpperCase();
                    const isEven = index % 2 === 0;

                    return (
                      <Pressable
                        style={({ pressed }) => [
                          styles.modalContactItem,
                          pressed && { backgroundColor: joyTheme.surfaceAlt },
                        ]}
                        onPress={() => handleNewChatContactPress(item)}
                        testID={`new-chat-contact-${item.id}`}
                      >
                        {item.avatar ? (
                          <Image source={{ uri: item.avatar }} style={styles.modalContactAvatar} contentFit="cover" />
                        ) : (
                          <LinearGradient
                            colors={item.type === 'organization'
                              ? ['#1C1C1E', '#3A3A3C']
                              : isEven ? ['#C8A24D', '#D4B568'] : ['#1A8B5E', '#2BB673']}
                            style={[styles.modalContactAvatar, styles.modalContactAvatarGradient]}
                          >
                            {item.type === 'organization' ? (
                              <Building2 color="#F9F3E3" size={16} />
                            ) : (
                              <Text style={styles.modalContactInitials}>{initials}</Text>
                            )}
                          </LinearGradient>
                        )}
                        <View style={styles.modalContactInfo}>
                          <Text style={styles.modalContactName} numberOfLines={1}>{item.name}</Text>
                          <Text style={styles.modalContactSub} numberOfLines={1}>
                            {item.type === 'organization' ? 'Organization' : item.subtitle}
                          </Text>
                        </View>
                        <View style={styles.modalContactAction}>
                          <MessageCircle color={joyTheme.gold} size={16} />
                        </View>
                      </Pressable>
                    );
                  }}
                />
              )}
            </SafeAreaView>
          </View>
        </View>
      </Modal>
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
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: joyTheme.border,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '900' as const,
    color: joyTheme.text,
    letterSpacing: 1,
  },
  headerUnreadBadge: {
    backgroundColor: joyTheme.gold,
    borderRadius: 10,
    paddingHorizontal: 7,
    paddingVertical: 2,
    marginLeft: 4,
  },
  headerUnreadText: {
    fontSize: 11,
    fontWeight: '700' as const,
    color: '#FFFFFF',
  },
  newChatBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: joyTheme.charcoal,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  newChatBtnText: {
    fontSize: 13,
    fontWeight: '700' as const,
    color: '#FFFFFF',
  },
  primaryTabs: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  primaryTab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: joyTheme.border,
    backgroundColor: '#FFFFFF',
  },
  primaryTabActive: {
    backgroundColor: joyTheme.goldSoft,
    borderColor: joyTheme.gold,
  },
  primaryTabText: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: joyTheme.textMuted,
  },
  primaryTabTextActive: {
    color: joyTheme.gold,
    fontWeight: '700' as const,
  },
  tabBadge: {
    backgroundColor: joyTheme.gold,
    borderRadius: 8,
    paddingHorizontal: 5,
    paddingVertical: 1,
    marginLeft: 2,
  },
  tabBadgeText: {
    fontSize: 10,
    fontWeight: '700' as const,
    color: '#FFFFFF',
  },
  body: {
    flex: 1,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 4,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 6,
    borderWidth: 1,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: joyTheme.text,
    padding: 0,
  },
  clearBtn: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#D1D5DB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  clearBtnText: {
    fontSize: 13,
    fontWeight: '700' as const,
    color: '#FFFFFF',
    marginTop: -1,
  },
  contentArea: {
    flex: 1,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
    gap: 10,
  },
  loadingText: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: joyTheme.textMuted,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
    gap: 8,
  },
  emptyIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: joyTheme.goldSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '700' as const,
    color: joyTheme.text,
  },
  emptySubtitle: {
    fontSize: 14,
    color: joyTheme.textMuted,
    textAlign: 'center',
    lineHeight: 20,
  },
  emptyActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: joyTheme.charcoal,
    borderRadius: 12,
    paddingHorizontal: 20,
    paddingVertical: 12,
    marginTop: 12,
  },
  emptyActionBtnText: {
    fontSize: 14,
    fontWeight: '700' as const,
    color: '#FFFFFF',
  },
  listContent: {
    paddingTop: 4,
    paddingBottom: 100,
  },
  conversationItem: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    marginTop: 6,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: joyTheme.border,
  },
  conversationItemPressed: {
    backgroundColor: joyTheme.surfaceAlt,
  },
  conversationItemUnread: {
    borderColor: joyTheme.goldLight,
    borderLeftWidth: 3,
    borderLeftColor: joyTheme.gold,
  },
  conversationInner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 12,
  },
  avatarContainer: {
    position: 'relative' as const,
  },
  avatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
  },
  avatarGradient: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitials: {
    fontSize: 15,
    fontWeight: '800' as const,
    color: '#FFFFFF',
  },
  onlineDot: {
    position: 'absolute' as const,
    bottom: 0,
    right: 0,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: joyTheme.gold,
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  conversationText: {
    flex: 1,
    gap: 3,
  },
  conversationNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  conversationName: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: joyTheme.text,
    flex: 1,
  },
  conversationNameUnread: {
    fontWeight: '800' as const,
  },
  orgBadge: {
    backgroundColor: joyTheme.charcoal,
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  orgBadgeText: {
    fontSize: 9,
    fontWeight: '700' as const,
    color: joyTheme.goldLight,
    letterSpacing: 0.5,
  },
  conversationPreview: {
    fontSize: 13,
    color: joyTheme.textMuted,
    lineHeight: 18,
  },
  conversationPreviewUnread: {
    fontWeight: '500' as const,
    color: joyTheme.text,
  },
  conversationMeta: {
    alignItems: 'flex-end',
    gap: 6,
  },
  conversationTime: {
    fontSize: 11,
    fontWeight: '500' as const,
    color: joyTheme.textMuted,
  },
  conversationTimeUnread: {
    color: joyTheme.gold,
    fontWeight: '700' as const,
  },
  unreadBadge: {
    backgroundColor: joyTheme.gold,
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 5,
  },
  unreadBadgeText: {
    fontSize: 10,
    fontWeight: '700' as const,
    color: '#FFFFFF',
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: joyTheme.gold,
  },
  announcementOrgRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  announcementOrgName: {
    fontSize: 11,
    fontWeight: '500' as const,
    color: joyTheme.textMuted,
  },
  newAnnouncementBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginHorizontal: 16,
    marginTop: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: joyTheme.goldSoft,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: joyTheme.gold,
  },
  newAnnouncementIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  newAnnouncementText: {
    flex: 1,
    gap: 1,
  },
  newAnnouncementTitle: {
    fontSize: 13,
    fontWeight: '700' as const,
    color: joyTheme.text,
  },
  newAnnouncementSub: {
    fontSize: 11,
    fontWeight: '500' as const,
    color: joyTheme.textMuted,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '80%',
    paddingTop: 8,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: joyTheme.border,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800' as const,
    color: joyTheme.text,
  },
  modalSearchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginHorizontal: 20,
    marginVertical: 12,
    backgroundColor: joyTheme.surfaceAlt,
    borderRadius: 12,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: joyTheme.border,
  },
  modalSearchInput: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 15,
    color: joyTheme.text,
  },
  modalLoading: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
    gap: 10,
  },
  modalEmpty: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
    paddingHorizontal: 32,
    gap: 10,
  },
  modalEmptyText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: joyTheme.textMuted,
    textAlign: 'center',
  },
  modalList: {
    maxHeight: 400,
  },
  modalContactItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: joyTheme.border,
  },
  modalContactAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  modalContactAvatarGradient: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalContactInitials: {
    fontSize: 14,
    fontWeight: '800' as const,
    color: '#FFFFFF',
  },
  modalContactInfo: {
    flex: 1,
    gap: 2,
  },
  modalContactName: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: joyTheme.text,
  },
  modalContactSub: {
    fontSize: 12,
    fontWeight: '500' as const,
    color: joyTheme.textMuted,
  },
  modalContactAction: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: joyTheme.goldSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
