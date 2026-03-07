import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppSettings, Conversation, Provider, Agent, WebSearchConfig } from '../types';
import { DEFAULT_AGENTS, DEFAULT_PROVIDERS } from '../constants';

const KEYS = {
  SETTINGS: '@pai_settings',
  CONVERSATIONS: '@pai_conversations',
};

const defaultSettings: AppSettings = {
  providers: DEFAULT_PROVIDERS,
  agents: DEFAULT_AGENTS,
  activeConversationId: null,
  theme: 'dark',
};

/**
 * Resolve the webSearch config from stored settings, migrating from
 * the legacy `searxng` field if present.
 */
function resolveWebSearchConfig(stored: Record<string, unknown>): WebSearchConfig | undefined {
  // Already migrated
  if (stored.webSearch) return stored.webSearch as WebSearchConfig;

  const legacy = stored.searxng as { enabled?: boolean; baseUrl?: string; requestType?: string } | undefined;
  if (!legacy) return undefined;

  return {
    enabled: legacy.enabled ?? false,
    activeProvider: 'searxng',
    searxng: {
      baseUrl: legacy.baseUrl ?? '',
      requestType: (legacy.requestType as 'json_api' | 'html_get' | 'html_post') ?? 'json_api',
    },
  };
}

export async function loadSettings(): Promise<AppSettings> {
  try {
    const raw = await AsyncStorage.getItem(KEYS.SETTINGS);
    if (!raw) return defaultSettings;
    const stored = JSON.parse(raw) as Record<string, unknown>;
    const webSearch = resolveWebSearchConfig(stored);
    return {
      ...defaultSettings,
      ...stored,
      providers: ((stored.providers ?? defaultSettings.providers) as Provider[]).map((p) => ({
        ...p,
        enabled: p.enabled ?? true,
      })),
      agents: (stored.agents as Agent[] | undefined) ?? defaultSettings.agents,
      webSearch,
    };
  } catch {
    return defaultSettings;
  }
}

export async function saveSettings(settings: AppSettings): Promise<void> {
  await AsyncStorage.setItem(KEYS.SETTINGS, JSON.stringify(settings));
}

export async function loadConversations(): Promise<Conversation[]> {
  try {
    const raw = await AsyncStorage.getItem(KEYS.CONVERSATIONS);
    if (!raw) return [];
    return JSON.parse(raw) as Conversation[];
  } catch {
    return [];
  }
}

export async function saveConversations(conversations: Conversation[]): Promise<void> {
  await AsyncStorage.setItem(KEYS.CONVERSATIONS, JSON.stringify(conversations));
}

export async function saveConversation(conversation: Conversation): Promise<void> {
  const all = await loadConversations();
  const idx = all.findIndex((c) => c.id === conversation.id);
  if (idx >= 0) {
    all[idx] = conversation;
  } else {
    all.unshift(conversation);
  }
  await saveConversations(all);
}

export async function deleteConversation(id: string): Promise<void> {
  const all = await loadConversations();
  await saveConversations(all.filter((c) => c.id !== id));
}
