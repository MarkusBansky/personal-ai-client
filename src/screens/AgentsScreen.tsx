import React, { useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  Alert,
} from 'react-native';
import { CompositeScreenProps } from '@react-navigation/native';
import { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList, TabParamList } from '../../App';
import { Ionicons } from '@expo/vector-icons';
import { Agent, Provider, SearxngConfig } from '../types';
import { COLORS } from '../constants';

type Props = CompositeScreenProps<
  BottomTabScreenProps<TabParamList, 'Agents'>,
  NativeStackScreenProps<RootStackParamList>
>;

interface AgentsScreenProps {
  agents: Agent[];
  providers: Provider[];
  searxng?: SearxngConfig;
  navigation: Props['navigation'];
}

export default function AgentsScreen({ agents, providers, searxng, navigation }: AgentsScreenProps) {
  const enabledProviders = providers.filter((p) => p.enabled);

  const handleAgentPress = useCallback(
    (agent: Agent) => {
      if (enabledProviders.length === 0) {
        Alert.alert('No Provider', 'No enabled providers available. Enable a provider in Settings first.');
        return;
      }
      navigation.navigate('Chat', { agent, providers, searxng });
    },
    [enabledProviders, providers, searxng, navigation],
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
          </View>
          <TouchableOpacity
            style={styles.editButton}
            onPress={() => handleEditAgent(item)}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="create-outline" size={18} color={COLORS.textMuted} />
          </TouchableOpacity>
        </TouchableOpacity>
      );
    },
    [handleAgentPress, handleEditAgent],
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
