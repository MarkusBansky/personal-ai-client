import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppSettings, Conversation, Provider, Agent } from '../types';
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

export async function loadSettings(): Promise<AppSettings> {
  try {
    const raw = await AsyncStorage.getItem(KEYS.SETTINGS);
    if (!raw) return defaultSettings;
    const stored = JSON.parse(raw) as Partial<AppSettings>;
    return {
      ...defaultSettings,
      ...stored,
      providers: stored.providers ?? defaultSettings.providers,
      agents: stored.agents ?? defaultSettings.agents,
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
