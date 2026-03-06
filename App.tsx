import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { Agent, AppSettings, Conversation, Provider } from './src/types';
import { COLORS } from './src/constants';
import { loadSettings, saveSettings, loadConversations } from './src/services/storage';

import AgentsScreen from './src/screens/AgentsScreen';
import ChatScreen from './src/screens/ChatScreen';
import EditAgentScreen from './src/screens/EditAgentScreen';
import HistoryScreen from './src/screens/HistoryScreen';
import SettingsScreen from './src/screens/SettingsScreen';

// ── Navigation param types ────────────────────────────────────────────────────
export type RootStackParamList = {
  Tabs: undefined;
  Chat: { agent: Agent; provider: Provider; conversation?: Conversation };
  EditAgent: { agent: Agent | null; providers: Provider[] };
  Settings: undefined;
};

export type TabParamList = {
  Agents: undefined;
  History: undefined;
  Settings: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<TabParamList>();

// ── Custom dark nav theme ─────────────────────────────────────────────────────
const DarkTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    background: COLORS.background,
    card: COLORS.surface,
    text: COLORS.text,
    border: COLORS.border,
    primary: COLORS.primary,
    notification: COLORS.primary,
  },
};

// ── Tab icons (text emoji) ────────────────────────────────────────────────────
function tabIcon(name: keyof TabParamList, focused: boolean): string {
  switch (name) {
    case 'Agents': return focused ? '🤖' : '🤖';
    case 'History': return focused ? '💬' : '💬';
    case 'Settings': return focused ? '⚙️' : '⚙️';
  }
}

export default function App() {
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);

  useEffect(() => {
    (async () => {
      const [s, c] = await Promise.all([loadSettings(), loadConversations()]);
      setSettings(s);
      setConversations(c);
    })();
  }, []);

  const updateSettings = useCallback(
    async (patch: Partial<AppSettings>) => {
      if (!settings) return;
      const next = { ...settings, ...patch };
      setSettings(next);
      await saveSettings(next);
    },
    [settings],
  );

  const handleAgentSave = useCallback(
    async (agent: Agent) => {
      if (!settings) return;
      const idx = settings.agents.findIndex((a) => a.id === agent.id);
      const agents = idx >= 0
        ? settings.agents.map((a) => (a.id === agent.id ? agent : a))
        : [...settings.agents, agent];
      await updateSettings({ agents });
    },
    [settings, updateSettings],
  );

  const handleAgentDelete = useCallback(
    async (agentId: string) => {
      if (!settings) return;
      await updateSettings({ agents: settings.agents.filter((a) => a.id !== agentId) });
    },
    [settings, updateSettings],
  );

  const handleProvidersChange = useCallback(
    async (providers: Provider[]) => {
      await updateSettings({ providers });
    },
    [updateSettings],
  );

  if (!settings) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>Loading…</Text>
      </View>
    );
  }

  // settings is guaranteed non-null here (early return above)
  const s = settings;

  // Tabs sub-navigator (with state passed via render props)
  function TabNavigator() {
    return (
      <Tab.Navigator
        screenOptions={({ route }) => ({
          headerShown: false,
          tabBarIcon: ({ focused }) => (
            <Text style={{ fontSize: 20 }}>
              {tabIcon(route.name as keyof TabParamList, focused)}
            </Text>
          ),
          tabBarStyle: {
            backgroundColor: COLORS.surface,
            borderTopColor: COLORS.border,
          },
          tabBarActiveTintColor: COLORS.primary,
          tabBarInactiveTintColor: COLORS.textMuted,
          tabBarLabelStyle: { fontSize: 11, marginBottom: 2 },
        })}
      >
        <Tab.Screen name="Agents">
          {(props) => (
            <AgentsScreen
              {...props}
              agents={s.agents}
              providers={s.providers}
            />
          )}
        </Tab.Screen>
        <Tab.Screen name="History">
          {(props) => (
            <HistoryScreen
              {...props}
              conversations={conversations}
              agents={s.agents}
              providers={s.providers}
              onConversationsChange={setConversations}
            />
          )}
        </Tab.Screen>
        <Tab.Screen name="Settings">
          {(props) => (
            <SettingsScreen
              {...props}
              providers={s.providers}
              onProvidersChange={handleProvidersChange}
            />
          )}
        </Tab.Screen>
      </Tab.Navigator>
    );
  }

  return (
    <SafeAreaProvider>
      <NavigationContainer theme={DarkTheme}>
        <StatusBar style="light" />
        <Stack.Navigator
          screenOptions={{
            headerStyle: { backgroundColor: COLORS.surface },
            headerTintColor: COLORS.text,
            headerShadowVisible: false,
          }}
        >
          <Stack.Screen
            name="Tabs"
            component={TabNavigator}
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="Chat"
            component={ChatScreen}
            options={{ title: 'Chat' }}
          />
          <Stack.Screen
            name="EditAgent"
            options={({ route }) => ({
              title: route.params.agent ? 'Edit Agent' : 'New Agent',
            })}
          >
            {(props) => (
              <EditAgentScreen
                {...props}
                onSave={handleAgentSave}
                onDelete={handleAgentDelete}
              />
            )}
          </Stack.Screen>
          <Stack.Screen
            name="Settings"
            options={{ headerShown: false }}
          >
            {(props) => (
              <SettingsScreen
                {...props}
                providers={s.providers}
                onProvidersChange={handleProvidersChange}
              />
            )}
          </Stack.Screen>
        </Stack.Navigator>
      </NavigationContainer>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    backgroundColor: COLORS.background,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  loadingText: {
    color: COLORS.textSecondary,
    fontSize: 16,
  },
});
