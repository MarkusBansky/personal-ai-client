import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  StyleSheet,
  Alert,
  SafeAreaView,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import uuid from 'react-native-uuid';
import { RootStackParamList } from '../../App';
import { Message, Conversation, Agent, Provider } from '../types';
import { COLORS } from '../constants';
import { streamChat } from '../services/ai';
import { saveConversation } from '../services/storage';

type Props = NativeStackScreenProps<RootStackParamList, 'Chat'>;

export default function ChatScreen({ route, navigation }: Props) {
  const { agent, provider, conversation: initialConversation } = route.params;

  const [messages, setMessages] = useState<Message[]>(() => {
    const systemMsg: Message = {
      id: 'system-0',
      role: 'system',
      content: agent.systemPrompt,
      timestamp: Date.now(),
    };
    if (initialConversation) {
      return initialConversation.messages;
    }
    return [systemMsg];
  });

  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [conversationId] = useState<string>(
    initialConversation?.id ?? (uuid.v4() as string),
  );

  const flatListRef = useRef<FlatList>(null);
  const abortRef = useRef<boolean>(false);

  useEffect(() => {
    navigation.setOptions({ title: agent.name });
  }, [agent, navigation]);

  const visibleMessages = messages.filter((m) => m.role !== 'system');

  const scrollToBottom = useCallback(() => {
    setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 50);
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages.length]);

  const persistConversation = useCallback(
    async (msgs: Message[]) => {
      const conv: Conversation = {
        id: conversationId,
        agentId: agent.id,
        title: msgs.find((m) => m.role === 'user')?.content.slice(0, 60) ?? agent.name,
        messages: msgs,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      await saveConversation(conv);
    },
    [conversationId, agent],
  );

  const sendMessage = useCallback(async () => {
    const text = input.trim();
    if (!text || loading) return;

    const userMsg: Message = {
      id: uuid.v4() as string,
      role: 'user',
      content: text,
      timestamp: Date.now(),
    };

    const assistantMsg: Message = {
      id: uuid.v4() as string,
      role: 'assistant',
      content: '',
      timestamp: Date.now(),
    };

    const newMessages = [...messages, userMsg, assistantMsg];
    setMessages(newMessages);
    setInput('');
    setLoading(true);
    abortRef.current = false;

    let accumulated = '';

    try {
      await streamChat(provider, [...messages, userMsg], ({ content, done }) => {
        if (abortRef.current) return;
        accumulated += content;
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantMsg.id ? { ...m, content: accumulated } : m,
          ),
        );
        if (done) {
          const finalMsgs = newMessages.map((m) =>
            m.id === assistantMsg.id ? { ...m, content: accumulated } : m,
          );
          persistConversation(finalMsgs);
        }
      });
    } catch (err: any) {
      Alert.alert('Error', err?.message ?? 'Failed to get response');
      setMessages((prev) => prev.filter((m) => m.id !== assistantMsg.id));
    } finally {
      setLoading(false);
    }
  }, [input, loading, messages, provider, persistConversation]);

  const renderMessage = useCallback(
    ({ item }: { item: Message }) => {
      const isUser = item.role === 'user';
      return (
        <View style={[styles.messageRow, isUser ? styles.userRow : styles.assistantRow]}>
          {!isUser && (
            <View style={styles.agentAvatar}>
              <Text style={styles.agentAvatarText}>{agent.icon}</Text>
            </View>
          )}
          <View
            style={[
              styles.bubble,
              isUser ? styles.userBubble : styles.assistantBubble,
            ]}
          >
            {item.content ? (
              <Text style={[styles.bubbleText, isUser && styles.userBubbleText]}>
                {item.content}
              </Text>
            ) : (
              <ActivityIndicator size="small" color={COLORS.primaryLight} />
            )}
          </View>
        </View>
      );
    },
    [agent],
  );

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={90}
      >
        <FlatList
          ref={flatListRef}
          data={visibleMessages}
          keyExtractor={(m) => m.id}
          renderItem={renderMessage}
          contentContainerStyle={styles.messageList}
          onContentSizeChange={scrollToBottom}
        />
        <View style={styles.inputRow}>
          <TextInput
            style={styles.input}
            value={input}
            onChangeText={setInput}
            placeholder="Message..."
            placeholderTextColor={COLORS.textMuted}
            multiline
            maxLength={4000}
            returnKeyType="default"
          />
          <TouchableOpacity
            style={[styles.sendButton, (!input.trim() || loading) && styles.sendDisabled]}
            onPress={sendMessage}
            disabled={!input.trim() || loading}
          >
            {loading ? (
              <ActivityIndicator size="small" color={COLORS.white} />
            ) : (
              <Text style={styles.sendIcon}>↑</Text>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  messageList: {
    padding: 16,
    paddingBottom: 8,
  },
  messageRow: {
    flexDirection: 'row',
    marginBottom: 12,
    alignItems: 'flex-end',
  },
  userRow: {
    justifyContent: 'flex-end',
  },
  assistantRow: {
    justifyContent: 'flex-start',
  },
  agentAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  agentAvatarText: {
    fontSize: 16,
  },
  bubble: {
    maxWidth: '78%',
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 10,
    minHeight: 36,
  },
  userBubble: {
    backgroundColor: COLORS.userBubble,
    borderBottomRightRadius: 4,
  },
  assistantBubble: {
    backgroundColor: COLORS.surface,
    borderBottomLeftRadius: 4,
  },
  bubbleText: {
    color: COLORS.text,
    fontSize: 15,
    lineHeight: 22,
  },
  userBubbleText: {
    color: COLORS.white,
  },
  inputRow: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    backgroundColor: COLORS.background,
    alignItems: 'flex-end',
    gap: 8,
  },
  input: {
    flex: 1,
    backgroundColor: COLORS.surface,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    color: COLORS.text,
    fontSize: 15,
    maxHeight: 120,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendDisabled: {
    opacity: 0.4,
  },
  sendIcon: {
    color: COLORS.white,
    fontSize: 20,
    fontWeight: '700',
  },
});
