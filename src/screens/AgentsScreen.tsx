import React, { useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
} from 'react-native';
import { CompositeScreenProps } from '@react-navigation/native';
import { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList, TabParamList } from '../../App';
import { Agent, Provider } from '../types';
import { COLORS } from '../constants';

type Props = CompositeScreenProps<
  BottomTabScreenProps<TabParamList, 'Agents'>,
  NativeStackScreenProps<RootStackParamList>
>;

interface AgentsScreenProps {
  agents: Agent[];
  providers: Provider[];
  navigation: Props['navigation'];
}

export default function AgentsScreen({ agents, providers, navigation }: AgentsScreenProps) {
  const getProvider = useCallback(
    (providerId: string): Provider | undefined => providers.find((p) => p.id === providerId),
    [providers],
  );

  const handleAgentPress = useCallback(
    (agent: Agent) => {
      const provider = getProvider(agent.providerId) ?? providers[0];
      if (!provider) {
        return;
      }
      navigation.navigate('Chat', { agent, provider });
    },
    [getProvider, providers, navigation],
  );

  const handleEditAgent = useCallback(
    (agent: Agent) => {
      navigation.navigate('EditAgent', { agent, providers });
    },
    [navigation, providers],
  );

  const handleNewAgent = useCallback(() => {
    navigation.navigate('EditAgent', { agent: null, providers });
  }, [navigation, providers]);

  const renderAgent = useCallback(
    ({ item }: { item: Agent }) => {
      const provider = getProvider(item.providerId);
      return (
        <TouchableOpacity
          style={[styles.agentCard, { borderLeftColor: item.color }]}
          onPress={() => handleAgentPress(item)}
          activeOpacity={0.8}
        >
          <View style={[styles.iconContainer, { backgroundColor: item.color + '33' }]}>
            <Text style={styles.icon}>{item.icon}</Text>
          </View>
          <View style={styles.agentInfo}>
            <Text style={styles.agentName}>{item.name}</Text>
            <Text style={styles.agentDesc} numberOfLines={2}>
              {item.description}
            </Text>
            {provider && (
              <View style={styles.providerBadge}>
                <Text style={styles.providerBadgeText}>{provider.name}</Text>
              </View>
            )}
          </View>
          <TouchableOpacity
            style={styles.editButton}
            onPress={() => handleEditAgent(item)}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Text style={styles.editIcon}>✎</Text>
          </TouchableOpacity>
        </TouchableOpacity>
      );
    },
    [getProvider, handleAgentPress, handleEditAgent],
  );

  return (
    <SafeAreaView style={styles.container}>
      <FlatList
        data={agents}
        keyExtractor={(a) => a.id}
        renderItem={renderAgent}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          <Text style={styles.sectionTitle}>Your Agents</Text>
        }
        ListFooterComponent={
          <TouchableOpacity style={styles.addButton} onPress={handleNewAgent}>
            <Text style={styles.addButtonText}>+ New Agent</Text>
          </TouchableOpacity>
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
    gap: 12,
  },
  sectionTitle: {
    color: COLORS.text,
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 4,
  },
  agentCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 14,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    borderLeftWidth: 4,
    gap: 12,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: {
    fontSize: 24,
  },
  agentInfo: {
    flex: 1,
    gap: 3,
  },
  agentName: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: '600',
  },
  agentDesc: {
    color: COLORS.textSecondary,
    fontSize: 13,
    lineHeight: 18,
  },
  providerBadge: {
    alignSelf: 'flex-start',
    backgroundColor: COLORS.surfaceLight,
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginTop: 2,
  },
  providerBadgeText: {
    color: COLORS.textMuted,
    fontSize: 11,
  },
  editButton: {
    padding: 4,
  },
  editIcon: {
    color: COLORS.textMuted,
    fontSize: 18,
  },
  addButton: {
    backgroundColor: COLORS.primary,
    borderRadius: 14,
    padding: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  addButtonText: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: '600',
  },
});
