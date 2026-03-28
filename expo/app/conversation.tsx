import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  Send,
  Building2,
  MoreVertical,
} from 'lucide-react-native';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
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
import {
  fetchMessages,
  sendMessage,
  markMessagesRead,
  findOrCreateOrgVolunteerConversation,
} from '@/lib/api';
import type { DbMessage } from '@/types/database';

function formatMessageTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  const timeStr = date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });

  if (diffDays === 0) return timeStr;
  if (diffDays === 1) return `Yesterday ${timeStr}`;
  if (diffDays < 7) {
    const dayName = date.toLocaleDateString('en-US', { weekday: 'short' });
    return `${dayName} ${timeStr}`;
  }
  return `${date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} ${timeStr}`;
}

function shouldShowDateSeparator(currentMsg: DbMessage, prevMsg: DbMessage | null): boolean {
  if (!prevMsg) return true;
  const curr = new Date(currentMsg.created_at);
  const prev = new Date(prevMsg.created_at);
  return curr.toDateString() !== prev.toDateString();
}

function formatDateSeparator(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return date.toLocaleDateString('en-US', { weekday: 'long' });
  return date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
}

export default function ConversationScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user, adminUser, role } = useAuth();
  const params = useLocalSearchParams<{ id: string; name: string; type: string; avatar: string; conversationType: string; conversationId: string }>();
  const otherPartyId = params.id ?? '';
  const otherPartyName = params.name ?? 'User';
  const otherPartyType = (params.type ?? 'user') as 'user' | 'organization';
  const otherPartyAvatar = params.avatar ?? '';
  const conversationType = params.conversationType ?? 'volunteer';
  const passedConversationId = params.conversationId ?? '';
  const userId = user?.id ?? adminUser?.id ?? '';
  const isOrg = role === 'organization';

  const [messageText, setMessageText] = useState<string>('');
  const flatListRef = useRef<FlatList<DbMessage>>(null);

  const messagesQuery = useQuery({
    queryKey: ['messages', userId, otherPartyId, conversationType, passedConversationId],
    queryFn: () => fetchMessages(userId, otherPartyId, conversationType, passedConversationId || undefined),
    enabled: !!userId && !!otherPartyId,
    refetchInterval: 5000,
  });

  const messages = messagesQuery.data ?? [];

  const messagesLength = messages.length;

  useEffect(() => {
    if (userId && otherPartyId && messagesLength > 0) {
      console.log('[Conversation] Marking messages as read, type:', conversationType);
      void markMessagesRead(userId, otherPartyId, conversationType, passedConversationId || undefined);
      void queryClient.invalidateQueries({ queryKey: ['conversations', userId] });
    }
  }, [userId, otherPartyId, messagesLength, queryClient, conversationType, passedConversationId]);

  const sendMutation = useMutation({
    mutationFn: async (content: string) => {
      const senderType = isOrg ? 'organization' : 'user';
      const receiverType = otherPartyType;

      if (conversationType === 'org_volunteer') {
        let convoId = passedConversationId;
        if (!convoId) {
          const orgId = isOrg ? userId : otherPartyId;
          const volId = isOrg ? otherPartyId : userId;
          convoId = await findOrCreateOrgVolunteerConversation(orgId, volId) ?? '';
        }
        if (!convoId) throw new Error('Could not find or create org-volunteer conversation');
        return sendMessage(userId, otherPartyId, content, senderType, receiverType, 'org_volunteer', convoId);
      }

      return sendMessage(userId, otherPartyId, content, senderType, receiverType, 'volunteer');
    },
    onSuccess: () => {
      console.log('[Conversation] Message sent, refetching');
      void messagesQuery.refetch();
      void queryClient.invalidateQueries({ queryKey: ['conversations', userId] });
    },
  });

  const handleSend = useCallback(() => {
    const trimmed = messageText.trim();
    if (!trimmed || sendMutation.isPending) return;
    console.log('[Conversation] Sending message:', trimmed.substring(0, 50));
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setMessageText('');
    sendMutation.mutate(trimmed);
  }, [messageText, sendMutation]);

  const handleBack = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    router.back();
  }, [router]);

  const handleViewProfile = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    if (otherPartyType === 'organization') {
      router.push({ pathname: '/org-profile' as never, params: { id: otherPartyId } });
    } else {
      router.push({ pathname: '/user-profile' as never, params: { id: otherPartyId } });
    }
  }, [router, otherPartyId, otherPartyType]);

  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: false });
      }, 100);
    }
  }, [messages.length]);

  const resolvedAvatar = resolveImageUrl(otherPartyAvatar);
  const initials = otherPartyName
    .split(' ')
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  const messagesRef = useRef<DbMessage[]>(messages);
  messagesRef.current = messages;

  const renderMessage = useCallback(({ item, index }: { item: DbMessage; index: number }) => {
    const isMine = item.sender_id === userId;
    const prevMsg = index > 0 ? messagesRef.current[index - 1] : null;
    const showDate = shouldShowDateSeparator(item, prevMsg);

    return (
      <View>
        {showDate && (
          <View style={styles.dateSeparator}>
            <View style={styles.dateSeparatorLine} />
            <Text style={styles.dateSeparatorText}>{formatDateSeparator(item.created_at)}</Text>
            <View style={styles.dateSeparatorLine} />
          </View>
        )}
        <View style={[styles.messageBubbleRow, isMine && styles.messageBubbleRowMine]}>
          <View style={[styles.messageBubble, isMine ? styles.messageBubbleMine : styles.messageBubbleTheirs]}>
            <Text style={[styles.messageText, isMine && styles.messageTextMine]}>
              {item.content}
            </Text>
            <Text style={[styles.messageTime, isMine && styles.messageTimeMine]}>
              {formatMessageTime(item.created_at)}
            </Text>
          </View>
        </View>
      </View>
    );
  }, [userId]);

  return (
    <View style={styles.screen} testID="conversation-screen">
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.header}>
          <Pressable
            onPress={handleBack}
            hitSlop={12}
            style={({ pressed }) => [styles.backBtn, pressed && { opacity: 0.6 }]}
          >
            <ArrowLeft color={joyTheme.text} size={22} />
          </Pressable>

          <Pressable style={styles.headerProfile} onPress={handleViewProfile}>
            {resolvedAvatar ? (
              <Image source={{ uri: resolvedAvatar }} style={styles.headerAvatar} contentFit="cover" />
            ) : (
              <LinearGradient
                colors={otherPartyType === 'organization'
                  ? ['#1C1C1E', '#3A3A3C']
                  : ['#C8A24D', '#D4B568']}
                style={[styles.headerAvatar, styles.headerAvatarGradient]}
              >
                {otherPartyType === 'organization' ? (
                  <Building2 color="#F9F3E3" size={14} />
                ) : (
                  <Text style={styles.headerAvatarInitials}>{initials}</Text>
                )}
              </LinearGradient>
            )}
            <View style={styles.headerInfo}>
              <Text style={styles.headerName} numberOfLines={1}>{otherPartyName}</Text>
              <Text style={styles.headerSubtitle}>
                {otherPartyType === 'organization' ? 'Organization' : 'Tap to view profile'}
              </Text>
            </View>
          </Pressable>

          <View style={styles.headerActions}>
            <Pressable
              onPress={handleViewProfile}
              hitSlop={8}
              style={({ pressed }) => [styles.headerActionBtn, pressed && { opacity: 0.6 }]}
            >
              <MoreVertical color={joyTheme.textMuted} size={20} />
            </Pressable>
          </View>
        </View>

        <KeyboardAvoidingView
          style={styles.keyboardAvoid}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={0}
        >
          {messagesQuery.isLoading ? (
            <View style={styles.centered}>
              <ActivityIndicator size="large" color={joyTheme.gold} />
              <Text style={styles.loadingText}>Loading messages...</Text>
            </View>
          ) : messages.length === 0 ? (
            <View style={styles.emptyChat}>
              <View style={styles.emptyChatIconCircle}>
                {resolvedAvatar ? (
                  <Image source={{ uri: resolvedAvatar }} style={styles.emptyChatAvatar} contentFit="cover" />
                ) : (
                  <LinearGradient
                    colors={otherPartyType === 'organization'
                      ? ['#1C1C1E', '#3A3A3C']
                      : ['#C8A24D', '#D4B568']}
                    style={styles.emptyChatAvatar}
                  >
                    {otherPartyType === 'organization' ? (
                      <Building2 color="#F9F3E3" size={28} />
                    ) : (
                      <Text style={styles.emptyChatInitials}>{initials}</Text>
                    )}
                  </LinearGradient>
                )}
              </View>
              <Text style={styles.emptyChatName}>{otherPartyName}</Text>
              <Text style={styles.emptyChatSubtitle}>
                Send a message to start the conversation
              </Text>
            </View>
          ) : (
            <FlatList
              ref={flatListRef}
              data={messages}
              renderItem={renderMessage}
              keyExtractor={(item) => item.id}
              contentContainerStyle={styles.messagesList}
              showsVerticalScrollIndicator={false}
              onContentSizeChange={() => {
                flatListRef.current?.scrollToEnd({ animated: false });
              }}
              testID="messages-list"
            />
          )}

          <SafeAreaView edges={['bottom']} style={styles.inputSafeArea}>
            <View style={styles.inputContainer}>
              <TextInput
                style={styles.textInput}
                placeholder="Type a message..."
                placeholderTextColor={joyTheme.textMuted}
                value={messageText}
                onChangeText={setMessageText}
                multiline
                maxLength={2000}
                testID="message-input"
              />
              <Pressable
                onPress={handleSend}
                disabled={!messageText.trim() || sendMutation.isPending}
                style={({ pressed }) => [
                  styles.sendBtn,
                  (!messageText.trim() || sendMutation.isPending) && styles.sendBtnDisabled,
                  pressed && messageText.trim() && { opacity: 0.8, transform: [{ scale: 0.95 }] },
                ]}
                testID="send-button"
              >
                {sendMutation.isPending ? (
                  <ActivityIndicator size="small" color="#FFF" />
                ) : (
                  <Send color="#FFF" size={18} />
                )}
              </Pressable>
            </View>
          </SafeAreaView>
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
  safeArea: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: joyTheme.border,
    gap: 8,
  },
  backBtn: {
    padding: 4,
  },
  headerProfile: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  headerAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  headerAvatarGradient: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerAvatarInitials: {
    fontSize: 13,
    fontFamily: fonts.extraBold,
    color: '#FFFFFF',
  },
  headerInfo: {
    flex: 1,
    gap: 1,
  },
  headerName: {
    fontSize: 16,
    fontFamily: fonts.bold,
    color: joyTheme.text,
  },
  headerSubtitle: {
    fontSize: 12,
    fontFamily: fonts.medium,
    color: joyTheme.textMuted,
  },
  headerActions: {
    flexDirection: 'row',
    gap: 4,
  },
  headerActionBtn: {
    padding: 6,
  },
  keyboardAvoid: {
    flex: 1,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 10,
  },
  loadingText: {
    fontSize: 13,
    fontFamily: fonts.semiBold,
    color: joyTheme.textMuted,
  },
  emptyChat: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
    gap: 8,
  },
  emptyChatIconCircle: {
    marginBottom: 8,
  },
  emptyChatAvatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyChatInitials: {
    fontSize: 24,
    fontFamily: fonts.extraBold,
    color: '#FFFFFF',
  },
  emptyChatName: {
    fontSize: 20,
    fontFamily: fonts.extraBold,
    color: joyTheme.text,
  },
  emptyChatSubtitle: {
    fontSize: 14,
    fontFamily: fonts.medium,
    color: joyTheme.textMuted,
    textAlign: 'center',
    lineHeight: 20,
  },
  messagesList: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
  },
  dateSeparator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginVertical: 16,
  },
  dateSeparatorLine: {
    flex: 1,
    height: 1,
    backgroundColor: joyTheme.border,
  },
  dateSeparatorText: {
    fontSize: 12,
    fontFamily: fonts.semiBold,
    color: joyTheme.textMuted,
  },
  messageBubbleRow: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    marginBottom: 6,
  },
  messageBubbleRowMine: {
    justifyContent: 'flex-end',
  },
  messageBubble: {
    maxWidth: '78%',
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  messageBubbleMine: {
    backgroundColor: joyTheme.charcoal,
    borderBottomRightRadius: 4,
  },
  messageBubbleTheirs: {
    backgroundColor: '#FFFFFF',
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: joyTheme.border,
  },
  messageText: {
    fontSize: 15,
    fontFamily: fonts.regular,
    color: joyTheme.text,
    lineHeight: 21,
  },
  messageTextMine: {
    color: '#FFFFFF',
  },
  messageTime: {
    fontSize: 10,
    fontFamily: fonts.medium,
    color: joyTheme.textMuted,
    marginTop: 4,
    alignSelf: 'flex-end' as const,
  },
  messageTimeMine: {
    color: 'rgba(255,255,255,0.55)',
  },
  inputSafeArea: {
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: joyTheme.border,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8,
  },
  textInput: {
    flex: 1,
    backgroundColor: joyTheme.surfaceAlt,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 15,
    fontFamily: fonts.regular,
    color: joyTheme.text,
    maxHeight: 120,
    borderWidth: 1,
    borderColor: joyTheme.border,
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: joyTheme.charcoal,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnDisabled: {
    backgroundColor: joyTheme.border,
  },
});
