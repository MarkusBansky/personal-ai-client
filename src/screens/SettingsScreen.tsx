import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  Alert,
  SafeAreaView,
  Switch,
  ActivityIndicator,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import uuid from 'react-native-uuid';
import { RootStackParamList } from '../../App';
import { Provider, ProviderType, SearxngConfig, SearxngRequestType } from '../types';
import { Ionicons } from '@expo/vector-icons';
import { validateProvider } from '../services/ai';
import { validateSearxng } from '../services/searxng';
import { COLORS } from '../constants';

type Props = NativeStackScreenProps<RootStackParamList, 'Settings'>;

const PROVIDER_TYPES: { value: ProviderType; label: string; hasApiKey: boolean }[] = [
  { value: 'ollama', label: 'Ollama', hasApiKey: false },
  { value: 'vllm', label: 'vLLM', hasApiKey: false },
  { value: 'openai', label: 'OpenAI', hasApiKey: true },
  { value: 'anthropic', label: 'Anthropic', hasApiKey: true },
  { value: 'mistral', label: 'Mistral AI', hasApiKey: true },
  { value: 'custom', label: 'Custom (OpenAI-compatible)', hasApiKey: true },
];

const DEFAULT_BASE_URLS: Record<ProviderType, string> = {
  ollama: 'http://localhost:11434',
  vllm: 'http://localhost:8000',
  openai: 'https://api.openai.com/v1',
  anthropic: 'https://api.anthropic.com',
  mistral: 'https://api.mistral.ai/v1',
  custom: '',
};

const DEFAULT_MODELS: Record<ProviderType, string> = {
  ollama: 'llama3.2',
  vllm: 'meta-llama/Llama-3.1-8B-Instruct',
  openai: 'gpt-4o',
  anthropic: 'claude-3-5-sonnet-20241022',
  mistral: 'mistral-large-latest',
  custom: '',
};

const SEARXNG_REQUEST_TYPES: { value: SearxngRequestType; label: string; description: string }[] = [
  { value: 'json_api', label: 'JSON API', description: 'Recommended. Uses /search?format=json endpoint.' },
  { value: 'html_get', label: 'HTML GET', description: 'Fetches HTML search results via GET request.' },
  { value: 'html_post', label: 'HTML POST', description: 'Submits search query via POST form.' },
];

interface ProviderFormState {
  id: string;
  type: ProviderType;
  name: string;
  baseUrl: string;
  apiKey: string;
  model: string;
  enabled: boolean;
  expanded: boolean;
}

interface SettingsScreenProps {
  route: Props['route'];
  navigation: Props['navigation'];
  providers: Provider[];
  onProvidersChange: (providers: Provider[]) => void;
  searxng?: SearxngConfig;
  onSearxngChange: (config: SearxngConfig | undefined) => void;
}

export default function SettingsScreen({
  navigation,
  providers,
  onProvidersChange,
  searxng,
  onSearxngChange,
}: SettingsScreenProps) {
  const [forms, setForms] = useState<ProviderFormState[]>(() =>
    providers.map((p) => ({ ...p, expanded: false })),
  );
  const [validatingId, setValidatingId] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  // SearXNG form state
  const [searxngExpanded, setSearxngExpanded] = useState(false);
  const [searxngUrl, setSearxngUrl] = useState(searxng?.baseUrl ?? '');
  const [searxngRequestType, setSearxngRequestType] = useState<SearxngRequestType>(searxng?.requestType ?? 'json_api');
  const [searxngValidating, setSearxngValidating] = useState(false);

  const updateForm = useCallback(
    (id: string, patch: Partial<ProviderFormState>) => {
      setForms((prev) => prev.map((f) => (f.id === id ? { ...f, ...patch } : f)));
    },
    [],
  );

  const handleSaveProvider = useCallback(
    async (form: ProviderFormState) => {
      if (!form.name.trim() || !form.baseUrl.trim()) {
        Alert.alert('Validation', 'Name and Base URL are required.');
        return;
      }

      setValidatingId(form.id);
      const provider: Provider = {
        id: form.id,
        type: form.type,
        name: form.name.trim(),
        baseUrl: form.baseUrl.trim(),
        apiKey: form.apiKey.trim(),
        model: form.model.trim(),
        enabled: form.enabled,
      };
      const result = await validateProvider(provider);
      setValidatingId(null);

      if (!result.ok) {
        Alert.alert(
          'Connection Failed',
          `Could not reach the provider API.\n\n${result.error}`,
        );
        return;
      }

      const updated = forms.map((f): Provider => ({
        id: f.id,
        type: f.type,
        name: f.name.trim(),
        baseUrl: f.baseUrl.trim(),
        apiKey: f.apiKey.trim(),
        model: f.model.trim(),
        enabled: f.enabled,
      }));
      onProvidersChange(updated);
      updateForm(form.id, { expanded: false });
      Alert.alert('Saved', `${form.name} configuration saved.`);
    },
    [forms, onProvidersChange, updateForm],
  );

  const handleToggleEnabled = useCallback(
    async (form: ProviderFormState) => {
      if (form.enabled) {
        // Disabling — no check needed
        updateForm(form.id, { enabled: false });
        const updated = forms.map((f): Provider => ({
          id: f.id,
          type: f.type,
          name: f.name.trim(),
          baseUrl: f.baseUrl.trim(),
          apiKey: f.apiKey.trim(),
          model: f.model.trim(),
          enabled: f.id === form.id ? false : f.enabled,
        }));
        onProvidersChange(updated);
        return;
      }

      // Enabling — validate API first
      if (!form.baseUrl.trim()) {
        Alert.alert('Cannot Enable', 'Base URL is required. Configure the provider first.');
        return;
      }

      setTogglingId(form.id);
      const provider: Provider = {
        id: form.id,
        type: form.type,
        name: form.name.trim(),
        baseUrl: form.baseUrl.trim(),
        apiKey: form.apiKey.trim(),
        model: form.model.trim(),
        enabled: true,
      };
      const result = await validateProvider(provider);
      setTogglingId(null);

      if (!result.ok) {
        Alert.alert(
          'Cannot Enable',
          `API check failed — the provider is not reachable.\n\n${result.error}`,
        );
        return;
      }

      updateForm(form.id, { enabled: true });
      const updated = forms.map((f): Provider => ({
        id: f.id,
        type: f.type,
        name: f.name.trim(),
        baseUrl: f.baseUrl.trim(),
        apiKey: f.apiKey.trim(),
        model: f.model.trim(),
        enabled: f.id === form.id ? true : f.enabled,
      }));
      onProvidersChange(updated);
    },
    [forms, onProvidersChange, updateForm],
  );

  const handleAddProvider = useCallback(() => {
    const newForm: ProviderFormState = {
      id: uuid.v4() as string,
      type: 'custom',
      name: '',
      baseUrl: '',
      apiKey: '',
      model: '',
      enabled: false,
      expanded: true,
    };
    setForms((prev) => [...prev, newForm]);
  }, []);

  const handleDeleteProvider = useCallback(
    (id: string) => {
      Alert.alert('Delete Provider', 'Remove this provider?', [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            const updated = forms.filter((f) => f.id !== id);
            setForms(updated);
            onProvidersChange(
              updated.map((f) => ({
                id: f.id,
                type: f.type,
                name: f.name,
                baseUrl: f.baseUrl,
                apiKey: f.apiKey,
                model: f.model,
                enabled: f.enabled,
              })),
            );
          },
        },
      ]);
    },
    [forms, onProvidersChange],
  );

  const handleSaveSearxng = useCallback(async () => {
    if (!searxngUrl.trim()) {
      Alert.alert('Validation', 'Server URL is required.');
      return;
    }

    setSearxngValidating(true);
    const config: SearxngConfig = {
      enabled: true,
      baseUrl: searxngUrl.trim(),
      requestType: searxngRequestType,
    };

    const result = await validateSearxng(config);
    setSearxngValidating(false);

    if (!result.valid) {
      Alert.alert(
        'Connection Failed',
        `Could not validate SearXNG server.\n\n${result.error}`,
      );
      return;
    }

    onSearxngChange(config);
    setSearxngExpanded(false);
    Alert.alert('Saved', 'SearXNG search configuration saved and validated.');
  }, [searxngUrl, searxngRequestType, onSearxngChange]);

  const handleRemoveSearxng = useCallback(() => {
    Alert.alert('Remove Search', 'Remove SearXNG configuration?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: () => {
          onSearxngChange(undefined);
          setSearxngUrl('');
          setSearxngRequestType('json_api');
          setSearxngExpanded(false);
        },
      },
    ]);
  }, [onSearxngChange]);

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.pageTitle}>Settings</Text>

        <Text style={styles.sectionTitle}>AI Providers</Text>
        <Text style={styles.sectionSubtitle}>
          Configure connections to your AI providers (vLLM, Ollama, Anthropic, Mistral, OpenAI, etc.)
        </Text>

        {forms.map((form) => (
          <View key={form.id} style={styles.providerCard}>
            <TouchableOpacity
              style={styles.providerHeader}
              onPress={() => updateForm(form.id, { expanded: !form.expanded })}
              activeOpacity={0.8}
            >
              <View style={styles.providerHeaderLeft}>
                <Text style={styles.providerName}>
                  {form.name || 'Unnamed Provider'}
                </Text>
                <Text style={styles.providerType}>{form.type}</Text>
              </View>
              <View style={styles.providerHeaderRight}>
                {togglingId === form.id ? (
                  <ActivityIndicator color={COLORS.primary} size="small" />
                ) : (
                  <Switch
                    value={form.enabled}
                    onValueChange={() => handleToggleEnabled(form)}
                    trackColor={{ false: COLORS.surfaceLight, true: COLORS.secondary + '66' }}
                    thumbColor={form.enabled ? COLORS.secondary : COLORS.textMuted}
                  />
                )}
                <Ionicons name={form.expanded ? 'chevron-up' : 'chevron-down'} size={14} color={COLORS.textMuted} />
              </View>
            </TouchableOpacity>

            {form.expanded && (
              <View style={styles.providerForm}>
                <Text style={styles.fieldLabel}>Type</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.typeRow}>
                  {PROVIDER_TYPES.map(({ value, label }) => (
                    <TouchableOpacity
                      key={value}
                      style={[styles.typeChip, form.type === value && styles.typeChipActive]}
                      onPress={() =>
                        updateForm(form.id, {
                          type: value,
                          baseUrl: form.baseUrl || DEFAULT_BASE_URLS[value],
                          model: form.model || DEFAULT_MODELS[value],
                        })
                      }
                    >
                      <Text style={[styles.typeChipText, form.type === value && styles.typeChipTextActive]}>
                        {label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>

                <Text style={styles.fieldLabel}>Display Name *</Text>
                <TextInput
                  style={styles.input}
                  value={form.name}
                  onChangeText={(v) => updateForm(form.id, { name: v })}
                  placeholder="e.g. My Ollama Server"
                  placeholderTextColor={COLORS.textMuted}
                />

                <Text style={styles.fieldLabel}>Base URL *</Text>
                <TextInput
                  style={styles.input}
                  value={form.baseUrl}
                  onChangeText={(v) => updateForm(form.id, { baseUrl: v })}
                  placeholder={DEFAULT_BASE_URLS[form.type] || 'https://...'}
                  placeholderTextColor={COLORS.textMuted}
                  autoCapitalize="none"
                  keyboardType="url"
                />

                <Text style={styles.fieldLabel}>Model</Text>
                <TextInput
                  style={styles.input}
                  value={form.model}
                  onChangeText={(v) => updateForm(form.id, { model: v })}
                  placeholder={DEFAULT_MODELS[form.type] || 'model-name'}
                  placeholderTextColor={COLORS.textMuted}
                  autoCapitalize="none"
                />

                {PROVIDER_TYPES.find((t) => t.value === form.type)?.hasApiKey && (
                  <>
                    <Text style={styles.fieldLabel}>API Key</Text>
                    <TextInput
                      style={styles.input}
                      value={form.apiKey}
                      onChangeText={(v) => updateForm(form.id, { apiKey: v })}
                      placeholder="sk-..."
                      placeholderTextColor={COLORS.textMuted}
                      secureTextEntry
                      autoCapitalize="none"
                    />
                  </>
                )}

                <View style={styles.formActions}>
                  <TouchableOpacity
                    style={[styles.saveButton, validatingId === form.id && styles.saveButtonDisabled]}
                    onPress={() => handleSaveProvider(form)}
                    disabled={validatingId === form.id}
                  >
                    {validatingId === form.id ? (
                      <ActivityIndicator color={COLORS.white} size="small" />
                    ) : (
                      <Text style={styles.saveButtonText}>Save</Text>
                    )}
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.deleteProviderButton}
                    onPress={() => handleDeleteProvider(form.id)}
                  >
                    <Text style={styles.deleteProviderText}>Remove</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>
        ))}

        <TouchableOpacity style={styles.addButton} onPress={handleAddProvider}>
          <Text style={styles.addButtonText}>+ Add Provider</Text>
        </TouchableOpacity>

        <View style={styles.infoCard}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
            <Ionicons name="information-circle-outline" size={16} color={COLORS.text} style={{ marginRight: 6 }} />
            <Text style={[styles.infoTitle, { marginBottom: 0 }]}>Connecting to vLLM / Ollama</Text>
          </View>
          <Text style={styles.infoText}>
            For local servers, ensure your device can reach the host machine.{'\n'}
            • iOS/Android on same WiFi: use your machine's local IP (e.g. 192.168.1.x){'\n'}
            • Android emulator: use 10.0.2.2 instead of localhost{'\n'}
            • iOS simulator: use localhost or 127.0.0.1
          </Text>
        </View>

        {/* ── SearXNG Web Search Section ── */}
        <Text style={[styles.sectionTitle, { marginTop: 16 }]}>Web Search (SearXNG)</Text>
        <Text style={styles.sectionSubtitle}>
          Connect a SearXNG instance to give your AI agents web search capabilities via tool calling.
        </Text>

        <View style={styles.providerCard}>
          <TouchableOpacity
            style={styles.providerHeader}
            onPress={() => setSearxngExpanded(!searxngExpanded)}
            activeOpacity={0.8}
          >
            <View style={styles.providerHeaderLeft}>
              <Text style={styles.providerName}>
                {searxng?.enabled ? 'SearXNG Connected' : 'Not Configured'}
              </Text>
              <Text style={styles.providerType}>
                {searxng?.enabled ? searxng.baseUrl : 'tap to configure'}
              </Text>
            </View>
            <View style={styles.providerHeaderRight}>
              {searxng?.enabled && (
                <View style={[styles.statusDot, styles.statusActive]} />
              )}
              <Ionicons name={searxngExpanded ? 'chevron-up' : 'chevron-down'} size={14} color={COLORS.textMuted} />
            </View>
          </TouchableOpacity>

          {searxngExpanded && (
            <View style={styles.providerForm}>
              <Text style={styles.fieldLabel}>Server URL *</Text>
              <TextInput
                style={styles.input}
                value={searxngUrl}
                onChangeText={setSearxngUrl}
                placeholder="https://searxng.example.com"
                placeholderTextColor={COLORS.textMuted}
                autoCapitalize="none"
                keyboardType="url"
              />

              <Text style={styles.fieldLabel}>Request Type</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.typeRow}>
                {SEARXNG_REQUEST_TYPES.map(({ value, label }) => (
                  <TouchableOpacity
                    key={value}
                    style={[styles.typeChip, searxngRequestType === value && styles.typeChipActive]}
                    onPress={() => setSearxngRequestType(value)}
                  >
                    <Text style={[styles.typeChipText, searxngRequestType === value && styles.typeChipTextActive]}>
                      {label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
              <Text style={styles.searxngHintText}>
                {SEARXNG_REQUEST_TYPES.find((t) => t.value === searxngRequestType)?.description}
              </Text>

              <View style={styles.formActions}>
                <TouchableOpacity
                  style={[styles.saveButton, searxngValidating && styles.saveButtonDisabled]}
                  onPress={handleSaveSearxng}
                  disabled={searxngValidating}
                >
                  {searxngValidating ? (
                    <ActivityIndicator color={COLORS.white} size="small" />
                  ) : (
                    <Text style={styles.saveButtonText}>Validate & Save</Text>
                  )}
                </TouchableOpacity>
                {searxng?.enabled && (
                  <TouchableOpacity
                    style={styles.deleteProviderButton}
                    onPress={handleRemoveSearxng}
                  >
                    <Text style={styles.deleteProviderText}>Remove</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          )}
        </View>

        <View style={styles.infoCard}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
            <Ionicons name="search-outline" size={16} color={COLORS.text} style={{ marginRight: 6 }} />
            <Text style={[styles.infoTitle, { marginBottom: 0 }]}>About SearXNG Search</Text>
          </View>
          <Text style={styles.infoText}>
            When configured, a web_search tool is automatically provided to AI models that support tool/function calling.{'\n'}
            • The AI will search the web when it needs up-to-date information{'\n'}
            • Search results include titles, URLs, and content snippets{'\n'}
            • JSON API mode is recommended for best reliability{'\n'}
            • Self-host SearXNG or use a public instance
          </Text>
        </View>
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
    gap: 12,
    paddingBottom: 40,
  },
  pageTitle: {
    color: COLORS.text,
    fontSize: 28,
    fontWeight: '700',
    marginBottom: 8,
  },
  sectionTitle: {
    color: COLORS.text,
    fontSize: 18,
    fontWeight: '700',
  },
  sectionSubtitle: {
    color: COLORS.textSecondary,
    fontSize: 13,
    lineHeight: 18,
  },
  providerCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  providerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    justifyContent: 'space-between',
  },
  providerHeaderLeft: {
    flex: 1,
  },
  providerHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  providerName: {
    color: COLORS.text,
    fontSize: 15,
    fontWeight: '600',
  },
  providerType: {
    color: COLORS.textMuted,
    fontSize: 12,
    textTransform: 'uppercase',
    marginTop: 2,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusActive: {
    backgroundColor: COLORS.secondary,
  },
  statusInactive: {
    backgroundColor: COLORS.textMuted,
  },
  chevron: {
    color: COLORS.textMuted,
    fontSize: 12,
  },
  providerForm: {
    padding: 14,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    gap: 8,
  },
  fieldLabel: {
    color: COLORS.textSecondary,
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 4,
  },
  input: {
    backgroundColor: COLORS.surfaceLight,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: COLORS.text,
    fontSize: 14,
  },
  typeRow: {
    flexDirection: 'row',
  },
  typeChip: {
    backgroundColor: COLORS.surfaceLight,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginRight: 8,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  typeChipActive: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.primary + '33',
  },
  typeChipText: {
    color: COLORS.textSecondary,
    fontSize: 13,
  },
  typeChipTextActive: {
    color: COLORS.primaryLight,
    fontWeight: '600',
  },
  formActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 8,
  },
  saveButton: {
    flex: 1,
    backgroundColor: COLORS.primary,
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
  },
  saveButtonText: {
    color: COLORS.white,
    fontWeight: '700',
    fontSize: 14,
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  deleteProviderButton: {
    backgroundColor: 'transparent',
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.danger,
  },
  deleteProviderText: {
    color: COLORS.danger,
    fontWeight: '600',
    fontSize: 14,
  },
  addButton: {
    backgroundColor: COLORS.surfaceLight,
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: COLORS.border,
  },
  addButtonText: {
    color: COLORS.primary,
    fontSize: 15,
    fontWeight: '600',
  },
  infoCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: 14,
    borderLeftWidth: 3,
    borderLeftColor: COLORS.primary,
    marginTop: 8,
  },
  infoTitle: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  infoText: {
    color: COLORS.textSecondary,
    fontSize: 13,
    lineHeight: 20,
  },
  searxngHintText: {
    color: COLORS.textMuted,
    fontSize: 12,
    marginTop: 2,
  },
});
