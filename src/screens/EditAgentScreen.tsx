import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Alert,
  SafeAreaView,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import uuid from 'react-native-uuid';
import { RootStackParamList } from '../../App';
import { Agent, AgentType } from '../types';
import { COLORS, DEFAULT_SYSTEM_PROMPTS, AGENT_ICONS, AGENT_COLORS } from '../constants';

type Props = NativeStackScreenProps<RootStackParamList, 'EditAgent'>;

const AGENT_TYPES: { value: AgentType; label: string }[] = [
  { value: 'chat', label: '💬 Chat' },
  { value: 'researcher', label: '🔬 Researcher' },
  { value: 'coding', label: '💻 Coding' },
  { value: 'custom', label: '🤖 Custom' },
];

const EMOJI_OPTIONS = ['💬', '🔬', '💻', '🤖', '🧠', '📚', '✍️', '🎨', '🔧', '🌐', '⚡', '🦾'];

interface EditAgentScreenProps {
  route: Props['route'];
  navigation: Props['navigation'];
  onSave: (agent: Agent) => void;
  onDelete: (agentId: string) => void;
}

export default function EditAgentScreen({
  route,
  navigation,
  onSave,
  onDelete,
}: EditAgentScreenProps) {
  const { agent: existingAgent } = route.params;
  const isNew = !existingAgent;

  const [name, setName] = useState(existingAgent?.name ?? '');
  const [description, setDescription] = useState(existingAgent?.description ?? '');
  const [agentType, setAgentType] = useState<AgentType>(existingAgent?.type ?? 'custom');
  const [systemPrompt, setSystemPrompt] = useState(
    existingAgent?.systemPrompt ?? DEFAULT_SYSTEM_PROMPTS.custom,
  );
  const [icon, setIcon] = useState(existingAgent?.icon ?? '🤖');
  const [color, setColor] = useState(existingAgent?.color ?? AGENT_COLORS.custom);

  const handleTypeChange = useCallback((type: AgentType) => {
    setAgentType(type);
    setIcon(AGENT_ICONS[type] ?? '🤖');
    setColor(AGENT_COLORS[type] ?? COLORS.primary);
    if (systemPrompt === DEFAULT_SYSTEM_PROMPTS[agentType] || systemPrompt === '') {
      setSystemPrompt(DEFAULT_SYSTEM_PROMPTS[type] ?? '');
    }
  }, [agentType, systemPrompt]);

  const handleSave = useCallback(() => {
    if (!name.trim()) {
      Alert.alert('Validation', 'Please enter an agent name.');
      return;
    }

    const agent: Agent = {
      id: existingAgent?.id ?? (uuid.v4() as string),
      name: name.trim(),
      type: agentType,
      description: description.trim(),
      systemPrompt: systemPrompt.trim(),
      icon,
      color,
    };

    onSave(agent);
    navigation.goBack();
  }, [name, description, agentType, systemPrompt, icon, color, existingAgent, onSave, navigation]);

  const handleDelete = useCallback(() => {
    if (!existingAgent) return;
    Alert.alert('Delete Agent', `Delete "${existingAgent.name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          onDelete(existingAgent.id);
          navigation.goBack();
        },
      },
    ]);
  }, [existingAgent, onDelete, navigation]);

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {/* Icon picker */}
        <Text style={styles.label}>Icon</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.emojiRow}>
          {EMOJI_OPTIONS.map((e) => (
            <TouchableOpacity
              key={e}
              style={[styles.emojiOption, icon === e && styles.emojiSelected]}
              onPress={() => setIcon(e)}
            >
              <Text style={styles.emojiText}>{e}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Name */}
        <Text style={styles.label}>Name *</Text>
        <TextInput
          style={styles.input}
          value={name}
          onChangeText={setName}
          placeholder="Agent name"
          placeholderTextColor={COLORS.textMuted}
          maxLength={50}
        />

        {/* Description */}
        <Text style={styles.label}>Description</Text>
        <TextInput
          style={styles.input}
          value={description}
          onChangeText={setDescription}
          placeholder="What does this agent do?"
          placeholderTextColor={COLORS.textMuted}
          maxLength={200}
        />

        {/* Type */}
        <Text style={styles.label}>Agent Type</Text>
        <View style={styles.chipRow}>
          {AGENT_TYPES.map(({ value, label }) => (
            <TouchableOpacity
              key={value}
              style={[styles.chip, agentType === value && styles.chipActive]}
              onPress={() => handleTypeChange(value)}
            >
              <Text style={[styles.chipText, agentType === value && styles.chipTextActive]}>
                {label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* System Prompt */}
        <Text style={styles.label}>System Prompt</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          value={systemPrompt}
          onChangeText={setSystemPrompt}
          placeholder="System instructions for this agent..."
          placeholderTextColor={COLORS.textMuted}
          multiline
          maxLength={2000}
          textAlignVertical="top"
        />

        {/* Save */}
        <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
          <Text style={styles.saveButtonText}>{isNew ? 'Create Agent' : 'Save Changes'}</Text>
        </TouchableOpacity>

        {!isNew && (
          <TouchableOpacity style={styles.deleteButton} onPress={handleDelete}>
            <Text style={styles.deleteButtonText}>Delete Agent</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  content: {
    padding: 16,
    gap: 8,
    paddingBottom: 40,
  },
  label: {
    color: COLORS.textSecondary,
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 8,
  },
  input: {
    backgroundColor: COLORS.surface,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: COLORS.text,
    fontSize: 15,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  textArea: {
    height: 160,
    paddingTop: 12,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    backgroundColor: COLORS.surface,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  chipActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  chipText: {
    color: COLORS.textSecondary,
    fontSize: 14,
  },
  chipTextActive: {
    color: COLORS.white,
    fontWeight: '600',
  },
  emojiRow: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  emojiOption: {
    width: 44,
    height: 44,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  emojiSelected: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.primary + '33',
  },
  emojiText: {
    fontSize: 22,
  },
  saveButton: {
    backgroundColor: COLORS.primary,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginTop: 16,
  },
  saveButtonText: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: '700',
  },
  deleteButton: {
    backgroundColor: 'transparent',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.danger,
    marginTop: 8,
  },
  deleteButtonText: {
    color: COLORS.danger,
    fontSize: 16,
    fontWeight: '600',
  },
});
