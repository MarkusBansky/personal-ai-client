import React, { useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Alert,
  SafeAreaView,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../App';
import { Conversation, Agent, Provider } from '../types';
import { COLORS } from '../constants';
import { deleteConversation } from '../services/storage';

interface HistoryScreenProps {
  conversations: Conversation[];
  agents: Agent[];
  providers: Provider[];
  navigation: any;
  onConversationsChange: (conversations: Conversation[]) => void;
}

function formatDate(ts: number): string {
  const d = new Date(ts);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  if (diff < 60000) return 'Just now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return d.toLocaleDateString();
}

export default function HistoryScreen({
  conversations,
  agents,
  providers,
  navigation,
  onConversationsChange,
}: HistoryScreenProps) {
  const getAgent = useCallback(
    (agentId: string): Agent | undefined => agents.find((a) => a.id === agentId),
    [agents],
  );

  const getProvider = useCallback(
    (providerId: string): Provider | undefined => providers.find((p) => p.id === providerId),
    [providers],
  );

  const handleOpen = useCallback(
    (conv: Conversation) => {
      const agent = getAgent(conv.agentId);
      if (!agent) return;
      const provider = getProvider(agent.providerId) ?? providers[0];
      if (!provider) return;
      navigation.navigate('Chat', { agent, provider, conversation: conv });
    },
    [getAgent, getProvider, providers, navigation],
  );

  const handleDelete = useCallback(
    (conv: Conversation) => {
      Alert.alert('Delete Conversation', `Delete "${conv.title}"?`, [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            await deleteConversation(conv.id);
            onConversationsChange(conversations.filter((c) => c.id !== conv.id));
          },
        },
      ]);
    },
    [conversations, onConversationsChange],
  );

  const renderItem = useCallback(
    ({ item }: { item: Conversation }) => {
      const agent = getAgent(item.agentId);
      const lastMsg = item.messages.filter((m) => m.role !== 'system').at(-1);
      return (
        <TouchableOpacity
          style={styles.card}
          onPress={() => handleOpen(item)}
          onLongPress={() => handleDelete(item)}
          activeOpacity={0.8}
        >
          <View style={styles.cardLeft}>
            <Text style={styles.cardIcon}>{agent?.icon ?? '💬'}</Text>
          </View>
          <View style={styles.cardContent}>
            <View style={styles.cardTop}>
              <Text style={styles.cardTitle} numberOfLines={1}>
                {item.title}
              </Text>
              <Text style={styles.cardDate}>{formatDate(item.updatedAt)}</Text>
            </View>
            {lastMsg && (
              <Text style={styles.cardPreview} numberOfLines={1}>
                {lastMsg.role === 'user' ? 'You: ' : ''}{lastMsg.content}
              </Text>
            )}
            {agent && (
              <View style={[styles.agentBadge, { backgroundColor: agent.color + '33' }]}>
                <Text style={[styles.agentBadgeText, { color: agent.color }]}>
                  {agent.name}
                </Text>
              </View>
            )}
          </View>
        </TouchableOpacity>
      );
    },
    [getAgent, handleOpen, handleDelete],
  );

  return (
    <SafeAreaView style={styles.container}>
      <FlatList
        data={conversations}
        keyExtractor={(c) => c.id}
        renderItem={renderItem}
        contentContainerStyle={styles.list}
        ListHeaderComponent={<Text style={styles.pageTitle}>History</Text>}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyIcon}>💭</Text>
            <Text style={styles.emptyTitle}>No conversations yet</Text>
            <Text style={styles.emptySubtitle}>
              Start a chat from the Agents tab
            </Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  list: {
    padding: 16,
    gap: 10,
  },
  pageTitle: {
    color: COLORS.text,
    fontSize: 28,
    fontWeight: '700',
    marginBottom: 8,
  },
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: 14,
    flexDirection: 'row',
    gap: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  cardLeft: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: COLORS.surfaceLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardIcon: {
    fontSize: 20,
  },
  cardContent: {
    flex: 1,
    gap: 4,
  },
  cardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  cardTitle: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: '600',
    flex: 1,
    marginRight: 8,
  },
  cardDate: {
    color: COLORS.textMuted,
    fontSize: 12,
  },
  cardPreview: {
    color: COLORS.textSecondary,
    fontSize: 13,
  },
  agentBadge: {
    alignSelf: 'flex-start',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  agentBadgeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  empty: {
    alignItems: 'center',
    paddingVertical: 60,
    gap: 12,
  },
  emptyIcon: {
    fontSize: 48,
  },
  emptyTitle: {
    color: COLORS.text,
    fontSize: 18,
    fontWeight: '600',
  },
  emptySubtitle: {
    color: COLORS.textSecondary,
    fontSize: 14,
  },
});
