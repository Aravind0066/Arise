import { useAppearance, useThemedStyles } from '../lib/AppearanceContext';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BottomNavigation } from '../components/BottomNavigation';
import { chatWithAI } from '../lib/api';
import type { ChatInput } from '../lib/hunterTypes';
import { clearChatDraftIfMatches, getChatDraft, setChatDraft } from '../lib/chatDraftStore';
import { useInternetConnectivity } from '../lib/ConnectivityContext';
import { onlineRequestErrorMessage } from '../lib/connectivityRules';
import { OfflineNotice } from '../components/OfflineNotice';
import { normalizeChatReply, sanitizeStoredAssistantReply } from '../lib/chatResponse';
import {
  appendChatMessage,
  deleteChatConversation,
  getActiveChatId,
  getChatConversations,
  saveChatConversation,
  setActiveChatId,
} from '../lib/hunterStorage';
import type { HunterChatConversation, HunterChatMessage } from '../lib/hunterTypes';

type MessageRole = 'user' | 'assistant' | 'error';

interface Message {
  id: string;
  role: MessageRole;
  content: string;
  isFallback?: boolean;
  createdAt?: string;
}

function renderInlineMarkdown(text: string, keyPrefix: string, boldStyle: object): React.ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, index) =>
    part.startsWith('**') && part.endsWith('**') ? (
      <Text key={`${keyPrefix}-${index}`} style={boldStyle}>
        {part.slice(2, -2)}
      </Text>
    ) : (
      <React.Fragment key={`${keyPrefix}-${index}`}>{part}</React.Fragment>
    )
  );
}

function safeChatErrorText(value: string): string {
  if (value.length > 360 || /(?:^|\n)\s*at\s+\S+|stack trace|node_modules\/|\bTypeError:|\bReferenceError:/i.test(value)) {
    return 'Hunter AI could not complete that request. Please retry.';
  }
  return value;
}

function AssistantMessage({ content }: { content: string }) {
  const { theme } = useAppearance();
  const themedStyles = useThemedStyles(styles);
  const themedBoldStyle = [themedStyles.markdownBold, { color: theme.textPrimary }];
  const blocks: React.ReactNode[] = [];
  let listItems: { text: string; ordered: boolean }[] = [];

  const flushList = () => {
    if (!listItems.length) return;
    const items = listItems;
    listItems = [];
    blocks.push(
      <View key={`list-${blocks.length}`} style={themedStyles.markdownList}>
        {items.map((item, index) => (
          <View key={`item-${index}`} style={themedStyles.markdownListRow}>
            <Text style={[themedStyles.aiBubbleText, { color: theme.textPrimary }]}>{item.ordered ? `${index + 1}.` : '•'}</Text>
            <Text style={[themedStyles.aiBubbleText, themedStyles.markdownListText, { color: theme.textPrimary }]}>
              {renderInlineMarkdown(item.text, `list-${blocks.length}-${index}`, themedBoldStyle)}
            </Text>
          </View>
        ))}
      </View>
    );
  };

  content.split(/\r?\n/).forEach((line, index) => {
    const listMatch = line.match(/^\s*(?:(\d+)\.|[-*])\s+(.+)$/);
    if (listMatch) {
      const ordered = /^\s*\d+\./.test(line);
      if (listItems.length && listItems[0].ordered !== ordered) flushList();
      listItems.push({ text: listMatch[2], ordered });
      return;
    }
    flushList();

    const headingMatch = line.match(/^\s{0,3}(#{1,3})\s+(.+?)\s*#*\s*$/);
    if (headingMatch) {
      blocks.push(
        <Text key={`heading-${index}`} style={[themedStyles.aiBubbleText, themedStyles.markdownHeading, { color: theme.accent }]}>
          {renderInlineMarkdown(headingMatch[2], `heading-${index}`, themedBoldStyle)}
        </Text>
      );
    } else if (line.trim()) {
      blocks.push(
        <Text key={`line-${index}`} style={[themedStyles.aiBubbleText, { color: theme.textPrimary }]}>
          {renderInlineMarkdown(line, `line-${index}`, themedBoldStyle)}
        </Text>
      );
    } else {
      blocks.push(<View key={`space-${index}`} style={themedStyles.markdownSpacer} />);
    }
  });
  flushList();
  return <View style={[themedStyles.markdownMessage, { maxWidth: '100%' }]}>{blocks}</View>;
}

const WELCOME_TEXT =
  'Greetings, Hunter. I can assist with quest strategy, study techniques, fitness routines, habit formation, and general nutrition guidance. Ask anything.';

const SUGGESTED_STARTERS = [
  'How do I build a study habit?',
  'Suggest a morning fitness routine',
  'How can I improve discipline?',
  'What should I eat before a workout?',
];

export default function ChatScreen() {
  const { theme } = useAppearance();
  const themedStyles = useThemedStyles(styles);
  const router = useRouter();
  const { status: internetStatus, refresh } = useInternetConnectivity();
  const scrollRef = useRef<ScrollView>(null);
  const screenProgress = useRef(new Animated.Value(0)).current;

  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content: WELCOME_TEXT,
    },
  ]);
  const [input, setInput] = useState(getChatDraft());
  const [sending, setSending] = useState(false);
  const [conversations, setConversations] = useState<HunterChatConversation[]>([]);
  const [activeConversationId, setActiveConversationIdState] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [chatReady, setChatReady] = useState(false);
  const sendingRef = useRef(false);

  const toDisplayMessage = useCallback((message: HunterChatMessage): Message => ({
    ...message,
    content: message.role === 'assistant'
      ? sanitizeStoredAssistantReply(message.content)
      : message.role === 'error' ? safeChatErrorText(message.content) : message.content,
    isFallback: message.fallback,
  }), []);

  const restoreChats = useCallback(async () => {
    const [saved, savedActive] = await Promise.all([getChatConversations(), getActiveChatId()]);
    setConversations(saved);
    const active = saved.find((item) => item.id === savedActive) || saved[0];
    if (active) {
      setActiveConversationIdState(active.id);
      await setActiveChatId(active.id);
      setMessages(active.messages.length ? active.messages.map(toDisplayMessage) : [{ id: 'welcome', role: 'assistant', content: WELCOME_TEXT }]);
    } else {
      setActiveConversationIdState(null);
      setMessages([{ id: 'welcome', role: 'assistant', content: WELCOME_TEXT }]);
    }
    setChatReady(true);
  }, [toDisplayMessage]);

  useEffect(() => { void restoreChats(); }, [restoreChats]);

  const newChat = useCallback(async () => {
    if (sendingRef.current) return;
    const now = new Date().toISOString();
    const conversation: HunterChatConversation = {
      id: `chat_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      title: 'New chat', createdAt: now, updatedAt: now, messages: [],
    };
    await saveChatConversation(conversation);
    await setActiveChatId(conversation.id);
    setConversations((previous) => [conversation, ...previous]);
    setActiveConversationIdState(conversation.id);
    setMessages([{ id: 'welcome', role: 'assistant', content: WELCOME_TEXT }]);
    setSidebarOpen(false);
  }, []);

  const selectConversation = useCallback(async (conversation: HunterChatConversation) => {
    if (sendingRef.current) return;
    await setActiveChatId(conversation.id);
    setActiveConversationIdState(conversation.id);
    setMessages(conversation.messages.length
      ? conversation.messages.map(toDisplayMessage)
      : [{ id: 'welcome', role: 'assistant', content: WELCOME_TEXT }]);
    setSidebarOpen(false);
  }, [toDisplayMessage]);

  const removeConversation = useCallback(async (id: string) => {
    const remaining = await deleteChatConversation(id);
    setConversations(remaining);
    if (activeConversationId === id) {
      const next = remaining[0];
      setActiveConversationIdState(next?.id || null);
      await setActiveChatId(next?.id || null);
      setMessages(next?.messages.length
        ? next.messages.map(toDisplayMessage)
        : [{ id: 'welcome', role: 'assistant', content: WELCOME_TEXT }]);
    }
  }, [activeConversationId, toDisplayMessage]);

  useEffect(() => {
    Animated.timing(screenProgress, {
      toValue: 1,
      duration: 280,
      useNativeDriver: Platform.OS !== 'web',
    }).start();
  }, [screenProgress]);

  const scrollToBottom = useCallback(() => {
    // Small delay so the new message is rendered before we scroll
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 80);
  }, []);

  const sendMessage = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || sendingRef.current || !chatReady) return;
      sendingRef.current = true;
      setSending(true);

      let conversationId = activeConversationId;
      const historyEntries = messages
        .filter((m) => m.role === 'user' || m.role === 'assistant')
        .filter((m) => m.id !== 'welcome')
        .slice(-10)
        .map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content }));
      try {
      if (!conversationId) {
        const now = new Date().toISOString();
        const conversation: HunterChatConversation = {
          id: `chat_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
          title: 'New chat', createdAt: now, updatedAt: now, messages: [],
        };
        await saveChatConversation(conversation);
        conversationId = conversation.id;
        setActiveConversationIdState(conversationId);
        await setActiveChatId(conversationId);
        setConversations((previous) => [conversation, ...previous]);
      }

      const userMsg: Message = {
        id: `user_${Date.now()}`,
        role: 'user',
        content: trimmed,
        createdAt: new Date().toISOString(),
      };

      await appendChatMessage(conversationId, userMsg as HunterChatMessage);
      setConversations(await getChatConversations());

      setMessages((prev) => [...prev, userMsg]);
      setChatDraft(text);
      setInput('');
      scrollToBottom();
      } catch {
        sendingRef.current = false;
        setSending(false);
        setInput(text);
        return;
      }

      try {
        const payload: ChatInput = {
          message: trimmed,
          history: historyEntries.length > 0 ? historyEntries : undefined,
        };

        const res = await chatWithAI(payload);

        if (!res.success) {
          setInput(text);
          setChatDraft(text);
          const errMsg: Message = {
            id: `err_${Date.now()}`,
            role: 'error',
            content: 'Hunter AI could not complete that response. Please retry.',
            createdAt: new Date().toISOString(),
          };
          await appendChatMessage(conversationId, errMsg as HunterChatMessage);
          setConversations(await getChatConversations());
          setMessages((prev) => [...prev, errMsg]);
          scrollToBottom();
          return;
        }

        // Backend sends reply at top level; wrapper also supports data.reply
        const isFallback = res.fallback === true || res.data?.fallback === true;
        const rawReply = res.reply ?? res.data?.reply;
        const replyText = isFallback ? null : normalizeChatReply(rawReply);
        if (!replyText) {
          throw new Error(isFallback
            ? 'A fallback response was not shown as live Hunter AI. Please retry when Ollama is available.'
            : 'Hunter AI returned an invalid response. Please retry.');
        }
        clearChatDraftIfMatches(text);

        const aiMsg: Message = {
          id: `ai_${Date.now()}`,
          role: 'assistant',
          content: replyText,
          isFallback: false,
          createdAt: new Date().toISOString(),
        };
        await appendChatMessage(conversationId, { ...aiMsg, role: 'assistant', fallback: false } as HunterChatMessage);
        setConversations(await getChatConversations());
        setMessages((prev) => [...prev, aiMsg]);
        scrollToBottom();
      } catch (err: any) {
        setInput(text);
        setChatDraft(text);
        const currentStatus = await refresh();
        const errMsg: Message = {
          id: `err_${Date.now()}`,
          role: 'error',
          content: safeChatErrorText(onlineRequestErrorMessage(err, currentStatus)),
          createdAt: new Date().toISOString(),
        };
        await appendChatMessage(conversationId, errMsg as HunterChatMessage);
        setConversations(await getChatConversations());
        setMessages((prev) => [...prev, errMsg]);
        scrollToBottom();
      } finally {
        sendingRef.current = false;
        setSending(false);
      }
    },
    [messages, sending, scrollToBottom, refresh, activeConversationId, chatReady]
  );

  const handleSend = () => sendMessage(input);

  const handleStarter = (text: string) => {
    setInput(text);
    sendMessage(text);
  };

  const handleRetry = useCallback(() => {
    // Find last user message and re-send it
    const lastUser = [...messages].reverse().find((m) => m.role === 'user');
    if (lastUser) {
      // Remove the error message, then re-send
      setMessages((prev) => prev.filter((m) => m.role !== 'error'));
      sendMessage(lastUser.content);
    }
  }, [messages, sendMessage]);

  const hasErrorAtEnd = messages.length > 0 && messages[messages.length - 1].role === 'error';

  return (
    <Animated.View
      style={[
        themedStyles.root,
        {
          opacity: screenProgress,
          transform: [{ translateY: screenProgress.interpolate({ inputRange: [0, 1], outputRange: [18, 0] }) }],
        },
      ]}
    >
      <SafeAreaView style={themedStyles.safe} edges={['top']}>
        <KeyboardAvoidingView
          style={themedStyles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={0}
        >
          {/* ── Header ── */}
          <View style={themedStyles.header}>
            <Pressable style={themedStyles.menuBtn} onPress={() => setSidebarOpen((open) => !open)} accessibilityLabel="Toggle chat history" disabled={!chatReady}>
              <Text style={themedStyles.menuBtnText}>{sidebarOpen ? '×' : '☰'}</Text>
            </Pressable>
            <Pressable style={themedStyles.backBtn} onPress={() => router.back()}>
              <Text style={themedStyles.backBtnText}>← BACK</Text>
            </Pressable>
            <View style={themedStyles.headerCenter}>
              <Text style={themedStyles.systemTag}>Hunter AI</Text>
              <Text style={themedStyles.headerTitle}>HUNTER AI</Text>
            </View>

            <View style={[themedStyles.statusDot, sending && themedStyles.statusDotActive]} />
          </View>

          {sidebarOpen && (
            <View style={themedStyles.sidebar}>
              <View style={themedStyles.sidebarHeader}>
                <Text style={themedStyles.sidebarTitle}>CHAT HISTORY</Text>
                <Pressable style={themedStyles.newChatBtn} onPress={newChat} disabled={sending || !chatReady}>
                  <Text style={themedStyles.newChatBtnText}>＋ NEW CHAT</Text>
                </Pressable>
              </View>
              <ScrollView style={themedStyles.sidebarList}>
                {conversations.map((conversation) => (
                  <View key={conversation.id} style={[themedStyles.conversationRow, activeConversationId === conversation.id && themedStyles.conversationRowActive]}>
                    <Pressable style={themedStyles.conversationSelect} onPress={() => selectConversation(conversation)} disabled={sending}>
                      <Text style={themedStyles.conversationTitle} numberOfLines={1}>{conversation.title}</Text>
                      <Text style={themedStyles.conversationDate}>{new Date(conversation.updatedAt).toLocaleString()}</Text>
                    </Pressable>
                    <Pressable style={themedStyles.deleteChatBtn} onPress={() => void removeConversation(conversation.id)} accessibilityLabel="Delete conversation" disabled={sending}>
                      <Text style={themedStyles.deleteChatText}>×</Text>
                    </Pressable>
                  </View>
                ))}
                {conversations.length === 0 && <Text style={themedStyles.sidebarEmpty}>No saved conversations yet.</Text>}
              </ScrollView>
            </View>
          )}

          <OfflineNotice visible={internetStatus === 'offline'} />

          {/* ── Conversation ── */}
          <ScrollView
            ref={scrollRef}
            style={themedStyles.messageList}
            contentContainerStyle={themedStyles.messageListContent}
            keyboardShouldPersistTaps="handled"
            onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: false })}
          >
            {/* Suggested starters – shown only while conversation is just the welcome */}
            {messages.length === 1 && (
              <View style={themedStyles.startersSection}>
                <Text style={themedStyles.startersLabel}>QUICK QUERIES</Text>
                <View style={themedStyles.startersList}>
                  {SUGGESTED_STARTERS.map((s) => (
                    <Pressable
                      key={s}
                      style={themedStyles.starterChip}
                      onPress={() => handleStarter(s)}
                      disabled={sending}
                    >
                      <Text style={themedStyles.starterChipText}>{s}</Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            )}

            {/* Messages */}
            {messages.map((msg) => {
              if (msg.role === 'user') {
                return (
                  <View key={msg.id} style={themedStyles.userBubbleRow}>
                    <View style={[themedStyles.userBubble, { backgroundColor: theme.buttonBackground, borderColor: theme.borderActive }]}>
                      <Text style={[themedStyles.userBubbleText, { color: theme.buttonText }]}>{msg.content}</Text>
                    </View>
                  </View>
                );
              }
              if (msg.role === 'error') {
                return (
                  <View key={msg.id} style={themedStyles.errorBubble}>
                    <Text style={themedStyles.errorBubbleText}>⚠ {msg.content}</Text>
                    <Pressable style={themedStyles.retryBtn} onPress={handleRetry} disabled={sending}>
                      <Text style={themedStyles.retryBtnText}>RETRY ⟳</Text>
                    </Pressable>
                  </View>
                );
              }
              // assistant
              return (
                <View key={msg.id} style={themedStyles.aiBubbleRow}>
                  <View style={themedStyles.aiBubbleAvatar}>
                    <Text style={themedStyles.aiBubbleAvatarText}>AI</Text>
                  </View>
                  <View style={[themedStyles.aiBubble, { backgroundColor: theme.surface, borderColor: theme.border, overflow: 'hidden' }]}>
                    {msg.isFallback && (
                      <View style={themedStyles.fallbackTag}>
                        <Text style={themedStyles.fallbackTagText}>LOCAL FALLBACK · NOT LIVE HUNTER AI</Text>
                      </View>
                    )}
                    <AssistantMessage content={msg.content} />
                  </View>
                </View>
              );
            })}

            {/* Typing indicator */}
            {sending && (
              <View style={themedStyles.aiBubbleRow}>
                <View style={themedStyles.aiBubbleAvatar}>
                  <Text style={themedStyles.aiBubbleAvatarText}>AI</Text>
                </View>
                <View style={[themedStyles.typingBubble, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                  <Text style={[themedStyles.typingText, { color: theme.accent }]}>⚡ PROCESSING...</Text>
                </View>
              </View>
            )}

            {/* Disclaimer shown once after the first AI reply */}
            {messages.length >= 2 && (
              <View style={themedStyles.disclaimer}>
                <Text style={themedStyles.disclaimerText}>
                  AI responses may be inaccurate. Not a substitute for professional medical or nutritional advice.
                </Text>
              </View>
            )}
          </ScrollView>

          {/* ── Retry shortcut (shown when last message is an error) ── */}
          {hasErrorAtEnd && (
            <View style={themedStyles.retryBar}>
              <Text style={themedStyles.retryBarLabel}>Retry this Hunter AI request.</Text>
              <Pressable style={themedStyles.retryBarBtn} onPress={handleRetry} disabled={sending}>
                <Text style={themedStyles.retryBarBtnText}>RETRY ⟳</Text>
              </Pressable>
            </View>
          )}

          {/* ── Input bar ── */}
          <View style={themedStyles.inputBar}>
            <TextInput
              value={input}
              onChangeText={(text) => {
                setInput(text);
                setChatDraft(text);
              }}
              placeholder="Ask Hunter AI..."
              placeholderTextColor={theme.textSecondary}
              style={themedStyles.inputField}
              multiline
              maxLength={2000}
              autoFocus
              returnKeyType="send"
              blurOnSubmit={false}
              onSubmitEditing={() => {
                if (Platform.OS !== 'web') handleSend();
              }}
              onKeyPress={(event) => {
                if (Platform.OS !== 'web' || event.nativeEvent.key !== 'Enter') return;
                const webEvent = event as unknown as { shiftKey?: boolean; preventDefault?: () => void };
                if (!webEvent.shiftKey) {
                  webEvent.preventDefault?.();
                  handleSend();
                }
              }}
              editable={!sending && chatReady}
            />
            <Pressable
              style={[
                themedStyles.sendBtn,
                (sending || !input.trim()) && themedStyles.sendBtnDisabled,
              ]}
              onPress={handleSend}
              disabled={sending || !chatReady || !input.trim()}
            >
              <Text style={themedStyles.sendBtnText}>{sending ? '...' : '➔'}</Text>
            </Pressable>
          </View>
        </KeyboardAvoidingView>

        <BottomNavigation active="tools" />
      </SafeAreaView>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#040b14',
  },
  safe: {
    flex: 1,
  },
  flex: {
    flex: 1,
  },
  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#102030',
    gap: 10,
  },
  menuBtn: { width: 32, height: 32, borderRadius: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: '#0b1e30', borderWidth: 1, borderColor: '#1c3d5e' },
  menuBtnText: { color: '#00f3ff', fontSize: 17, fontWeight: '900' },
  sidebar: { position: 'absolute', zIndex: 10, top: 60, bottom: 0, left: 0, width: 300, maxWidth: '85%', padding: 14, backgroundColor: '#071626', borderRightWidth: 1, borderColor: '#1c3d5e' },
  sidebarHeader: { gap: 10, paddingBottom: 12, borderBottomWidth: 1, borderColor: '#1c3d5e' },
  sidebarTitle: { color: '#00f3ff', fontSize: 10, fontWeight: '900', letterSpacing: 1.4 },
  newChatBtn: { padding: 10, borderRadius: 7, backgroundColor: '#0b1e30', borderWidth: 1, borderColor: '#00f3ff' },
  newChatBtnText: { color: '#00f3ff', fontSize: 10, fontWeight: '900', textAlign: 'center' },
  sidebarList: { flex: 1 },
  conversationRow: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 9, paddingHorizontal: 8, borderBottomWidth: 1, borderColor: '#102030' },
  conversationRowActive: { backgroundColor: '#0b1e30' },
  conversationSelect: { flex: 1 },
  conversationTitle: { color: '#e5f5ff', fontSize: 12, fontWeight: '700' },
  conversationDate: { color: '#7795ad', fontSize: 9, marginTop: 3 },
  deleteChatBtn: { width: 26, height: 26, alignItems: 'center', justifyContent: 'center' },
  deleteChatText: { color: '#ff6475', fontSize: 19, fontWeight: '800' },
  sidebarEmpty: { color: '#9eb5c9', fontSize: 12, paddingVertical: 18 },
  backBtn: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: '#0b1e30',
    borderWidth: 1,
    borderColor: '#1c3d5e',
  },
  backBtnText: {
    color: '#00f3ff',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  headerCenter: {
    flex: 1,
  },
  systemTag: {
    color: '#00f3ff',
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 1.5,
    marginBottom: 1,
  },
  headerTitle: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: 1,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#2a4a68',
  },
  statusDotActive: {
    backgroundColor: '#00f3ff',
  },
  // Message list
  messageList: {
    flex: 1,
  },
  messageListContent: {
    paddingHorizontal: 14,
    paddingTop: 14,
    paddingBottom: 14,
    gap: 12,
  },
  // Suggested starters
  startersSection: {
    marginBottom: 8,
  },
  startersLabel: {
    color: '#3a5e78',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1.5,
    marginBottom: 8,
  },
  startersList: {
    gap: 8,
  },
  starterChip: {
    backgroundColor: '#071626',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#183654',
    paddingVertical: 9,
    paddingHorizontal: 14,
  },
  starterChipText: {
    color: '#7fa8c4',
    fontSize: 12,
    lineHeight: 17,
  },
  // User bubble
  userBubbleRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    minWidth: 0,
  },
  userBubble: {
    backgroundColor: '#00f3ff',
    borderRadius: 14,
    borderBottomRightRadius: 4,
    borderWidth: 1,
    borderColor: '#00f3ff',
    paddingVertical: 10,
    paddingHorizontal: 14,
    maxWidth: '80%',
    minWidth: 0,
    flexShrink: 1,
  },
  userBubbleText: {
    color: '#02111d',
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '600',
    flexShrink: 1,
  },
  // AI bubble
  aiBubbleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    minWidth: 0,
  },
  aiBubbleAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#0c2642',
    borderWidth: 1,
    borderColor: '#00f3ff',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
    flexShrink: 0,
  },
  aiBubbleAvatarText: {
    color: '#00f3ff',
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  aiBubble: {
    backgroundColor: '#071626',
    borderRadius: 14,
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: '#163b5e',
    paddingVertical: 10,
    paddingHorizontal: 14,
    maxWidth: '80%',
    minWidth: 0,
    flexShrink: 1,
    gap: 6,
  },
  fallbackTag: {
    backgroundColor: '#fbb03b22',
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#fbb03b',
    paddingVertical: 2,
    paddingHorizontal: 6,
    alignSelf: 'flex-start',
  },
  fallbackTagText: {
    color: '#fbb03b',
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  aiBubbleText: {
    color: '#c8dff0',
    fontSize: 13,
    lineHeight: 20,
    flexShrink: 1,
  },
  markdownMessage: {
    gap: 4,
    minWidth: 0,
  },
  markdownBold: {
    fontWeight: '800',
  },
  markdownHeading: {
    color: '#00f3ff',
    fontWeight: '800',
    marginTop: 3,
  },
  markdownList: {
    gap: 3,
    marginVertical: 2,
  },
  markdownListRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 7,
    minWidth: 0,
  },
  markdownListText: {
    flex: 1,
    minWidth: 0,
  },
  markdownSpacer: {
    height: 5,
  },
  // Typing indicator
  typingBubble: {
    backgroundColor: '#071626',
    borderRadius: 14,
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: '#163b5e',
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  typingText: {
    color: '#00f3ff',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
  },
  // Error bubble
  errorBubble: {
    backgroundColor: '#120609',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#ff5376',
    paddingVertical: 10,
    paddingHorizontal: 14,
    gap: 8,
  },
  errorBubbleText: {
    color: '#c0748a',
    fontSize: 12,
    lineHeight: 18,
  },
  retryBtn: {
    alignSelf: 'flex-start',
    paddingVertical: 5,
    paddingHorizontal: 14,
    borderRadius: 7,
    borderWidth: 1,
    borderColor: '#ff5376',
    backgroundColor: '#1a050a',
  },
  retryBtnText: {
    color: '#ff5376',
    fontSize: 10,
    fontWeight: '900',
  },
  // Disclaimer
  disclaimer: {
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#0d1f30',
    marginTop: 4,
  },
  disclaimerText: {
    color: '#2e4e66',
    fontSize: 10,
    lineHeight: 15,
    textAlign: 'center',
  },
  // Retry bar (shown when last msg is error)
  retryBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#120609',
    borderTopWidth: 1,
    borderTopColor: '#ff5376',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  retryBarLabel: {
    color: '#c0748a',
    fontSize: 11,
    fontWeight: '700',
  },
  retryBarBtn: {
    paddingVertical: 5,
    paddingHorizontal: 14,
    borderRadius: 7,
    borderWidth: 1,
    borderColor: '#ff5376',
    backgroundColor: '#1a050a',
  },
  retryBarBtnText: {
    color: '#ff5376',
    fontSize: 10,
    fontWeight: '900',
  },
  // Input bar
  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: '#102030',
    backgroundColor: '#040b14',
    // leave room above bottom nav
    marginBottom: 64,
  },
  inputField: {
    flex: 1,
    backgroundColor: '#071626',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#1a3d62',
    paddingHorizontal: 14,
    paddingVertical: 10,
    color: '#ffffff',
    fontSize: 13,
    lineHeight: 19,
    maxHeight: 100,
  },
  sendBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#00f3ff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnDisabled: {
    backgroundColor: '#0e2c3e',
  },
  sendBtnText: {
    color: '#02111d',
    fontSize: 16,
    fontWeight: '900',
  },
});
