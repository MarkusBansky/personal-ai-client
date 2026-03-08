import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Alert,
  SafeAreaView,
  Keyboard,
  Linking,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useHeaderHeight } from '@react-navigation/elements';
import uuid from 'react-native-uuid';
import Markdown from 'react-native-markdown-display';
import * as Clipboard from 'expo-clipboard';
import { Ionicons } from '@expo/vector-icons';
import { RootStackParamList } from '../../App';
import { Message, MessageVersion, Conversation, ModelInfo, LinkMeta, ToolCall, ToolResult } from '../types';
import { COLORS, SEARCH_TOOL_DEFINITION, SEARCH_SYSTEM_PROMPT_SUPPLEMENT } from '../constants';
import { streamChat, fetchModels } from '../services/ai';
import { webSearch } from '../services/search';
import { saveConversation, loadChatSearchEnabled, saveChatSearchEnabled } from '../services/storage';
import { getModelPricing, calculateCost, formatCost, formatPrice } from '../constants/pricing';
import LinkBubbles from '../components/LinkBubbles';
import ModelSelectorModal, { SelectedModel } from '../components/ModelSelectorModal';

type Props = NativeStackScreenProps<RootStackParamList, 'Chat'>;

export default function ChatScreen({ route, navigation }: Props) {
  const { agent, providers, conversation: initialConversation, webSearch: webSearchConfig } = route.params;
  const headerHeight = useHeaderHeight();

  const searchAvailable = !!webSearchConfig?.enabled;
  const [searchToggle, setSearchToggle] = useState(searchAvailable);

  useEffect(() => {
    if (searchAvailable) {
      loadChatSearchEnabled().then(setSearchToggle).catch(() => {});
    }
  }, [searchAvailable]);

  const searchEnabled = searchAvailable && searchToggle;

  const handleSearchToggle = useCallback(() => {
    setSearchToggle((prev) => {
      const next = !prev;
      saveChatSearchEnabled(next);
      return next;
    });
  }, []);

  const [messages, setMessages] = useState<Message[]>(() => {
    const systemPrompt = searchAvailable
      ? `${agent.systemPrompt}\n\n${SEARCH_SYSTEM_PROMPT_SUPPLEMENT}`
      : agent.systemPrompt;
    const systemMsg: Message = {
      id: 'system-0',
      role: 'system',
      content: systemPrompt,
      timestamp: Date.now(),
    };
    if (initialConversation) {
      return initialConversation.messages;
    }
    return [systemMsg];
  });

  // Keep the system message in sync with the search toggle for new conversations
  useEffect(() => {
    if (initialConversation) return;
    const systemPrompt = searchEnabled
      ? `${agent.systemPrompt}\n\n${SEARCH_SYSTEM_PROMPT_SUPPLEMENT}`
      : agent.systemPrompt;
    setMessages((prev) => {
      if (prev.length === 0) return prev;
      const first = prev[0];
      if (first.role !== 'system' || first.content === systemPrompt) return prev;
      return [{ ...first, content: systemPrompt }, ...prev.slice(1)];
    });
  }, [searchEnabled, agent.systemPrompt, initialConversation]);

  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [conversationId] = useState<string>(
    initialConversation?.id ?? (uuid.v4() as string),
  );
  const [availableModels, setAvailableModels] = useState<Map<string, ModelInfo[]>>(new Map());
  const [selectedModel, setSelectedModel] = useState<SelectedModel | null>(null);
  const [modelPickerVisible, setModelPickerVisible] = useState(false);

  const flatListRef = useRef<FlatList>(null);
  const abortRef = useRef<boolean>(false);

  // Copy feedback state: tracks which message IDs recently had their content copied
  const [copiedIds, setCopiedIds] = useState<Set<string>>(new Set());
  // Version display state: tracks which version index is active per message
  const [activeVersions, setActiveVersions] = useState<Map<string, number>>(new Map());
  // Retry model picker state
  const [retryModelPickerVisible, setRetryModelPickerVisible] = useState(false);
  const retryTargetIdRef = useRef<string | null>(null);
  // Version dropdown expanded state
  const [versionDropdownOpen, setVersionDropdownOpen] = useState<Set<string>>(new Set());
  // Search status indicator
  const [searchStatus, setSearchStatus] = useState<string | null>(null);

  useEffect(() => {
    navigation.setOptions({ title: agent.name });
  }, [agent, navigation]);

  // Fetch models from all enabled providers on mount
  useEffect(() => {
    const enabledProviders = providers.filter((p) => p.enabled);
    if (enabledProviders.length === 0) return;

    Promise.all(enabledProviders.map((p) => fetchModels(p))).then((results) => {
      const map = new Map<string, ModelInfo[]>();
      enabledProviders.forEach((p, i) => {
        const models = results[i];
        if (models.length > 0) map.set(p.id, models);
      });
      setAvailableModels(map);

      // Auto-select first model if none selected
      if (!selectedModel) {
        for (const [providerId, models] of map) {
          if (models.length > 0) {
            setSelectedModel({ providerId, modelId: models[0].id });
            break;
          }
        }
      }
    });
  }, [providers]);

  const selectedModelName = useMemo(() => {
    if (!selectedModel) return 'Select model';
    const models = availableModels.get(selectedModel.providerId);
    const model = models?.find((m) => m.id === selectedModel.modelId);
    return model?.name ?? selectedModel.modelId;
  }, [selectedModel, availableModels]);

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

  const stopGeneration = useCallback(() => {
    abortRef.current = true;
    setLoading(false);
  }, []);

  const copyToClipboard = useCallback(async (msgId: string, content: string) => {
    await Clipboard.setStringAsync(content);
    setCopiedIds((prev) => new Set(prev).add(msgId));
    setTimeout(() => {
      setCopiedIds((prev) => {
        const next = new Set(prev);
        next.delete(msgId);
        return next;
      });
    }, 1500);
  }, []);

  const retryMessage = useCallback(async (assistantMsgId: string, modelOverride?: SelectedModel) => {
    if (loading) return;

    const retryModel = modelOverride ?? selectedModel;
    if (!retryModel) {
      Alert.alert('No Model', 'Please select a model before retrying.');
      return;
    }

    const provider = providers.find((p) => p.id === retryModel.providerId);
    if (!provider) {
      Alert.alert('Provider Error', 'Selected provider is no longer available.');
      return;
    }

    // Find the assistant message and snapshot old content into versions
    const msgIndex = messages.findIndex((m) => m.id === assistantMsgId);
    if (msgIndex === -1) return;
    const oldMsg = messages[msgIndex];
    if (oldMsg.role !== 'assistant' || !oldMsg.content) return;

    const oldVersion: MessageVersion = {
      content: oldMsg.content,
      timestamp: oldMsg.timestamp,
      model: oldMsg.model,
      providerId: oldMsg.providerId,
      usage: oldMsg.usage,
    };

    const updatedVersions = [...(oldMsg.versions ?? []), oldVersion];

    // Reset assistant message for new generation
    const resetMsg: Message = {
      ...oldMsg,
      content: '',
      timestamp: Date.now(),
      model: retryModel.modelId,
      providerId: retryModel.providerId,
      usage: undefined,
      versions: updatedVersions,
    };

    const updatedMessages = messages.map((m) => m.id === assistantMsgId ? resetMsg : m);
    setMessages(updatedMessages);

    // Clear version selection so the latest is shown
    setActiveVersions((prev) => {
      const next = new Map(prev);
      next.delete(assistantMsgId);
      return next;
    });

    setLoading(true);
    abortRef.current = false;

    // Build context: all messages up to and including the user message before the assistant
    const contextMessages = messages.slice(0, msgIndex);

    let accumulated = '';

    try {
      await streamChat(provider, contextMessages, ({ content, done, usage }) => {
        if (abortRef.current) return;
        accumulated += content;
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantMsgId ? { ...m, content: accumulated } : m,
          ),
        );
        if (done) {
          const finalMsgs = updatedMessages.map((m) =>
            m.id === assistantMsgId
              ? { ...m, content: accumulated, usage: usage ?? undefined }
              : m,
          );
          setMessages(finalMsgs);
          persistConversation(finalMsgs);
        }
      }, retryModel.modelId, toolOptions);
    } catch (err: any) {
      if (!abortRef.current) {
        Alert.alert('Error', err?.message ?? 'Failed to get response');
        // Restore the old version on error
        const lastVersion = updatedVersions[updatedVersions.length - 1];
        const restoredMsgs = updatedMessages.map((m) =>
          m.id === assistantMsgId
            ? {
                ...m,
                content: lastVersion.content,
                timestamp: lastVersion.timestamp,
                model: lastVersion.model,
                providerId: lastVersion.providerId,
                usage: lastVersion.usage,
                versions: updatedVersions.slice(0, -1).length > 0 ? updatedVersions.slice(0, -1) : undefined,
              }
            : m,
        );
        setMessages(restoredMsgs);
      }
    } finally {
      setLoading(false);
    }
  }, [loading, messages, providers, selectedModel, persistConversation]);

  const openRetryModelPicker = useCallback((msgId: string) => {
    retryTargetIdRef.current = msgId;
    setRetryModelPickerVisible(true);
  }, []);

  const handleRetryModelSelect = useCallback((providerId: string, modelId: string) => {
    const msgId = retryTargetIdRef.current;
    setRetryModelPickerVisible(false);
    if (msgId) {
      retryMessage(msgId, { providerId, modelId });
    }
  }, [retryMessage]);

  const switchVersion = useCallback((msgId: string, versionIndex: number | null) => {
    setActiveVersions((prev) => {
      const next = new Map(prev);
      if (versionIndex === null) {
        next.delete(msgId);
      } else {
        next.set(msgId, versionIndex);
      }
      return next;
    });
  }, []);

  const toggleVersionDropdown = useCallback((msgId: string) => {
    setVersionDropdownOpen((prev) => {
      const next = new Set(prev);
      if (next.has(msgId)) next.delete(msgId);
      else next.add(msgId);
      return next;
    });
  }, []);

  const handleReferencesLoaded = useCallback((msgId: string, refs: LinkMeta[]) => {
    setMessages((prev) => {
      const updated = prev.map((m) =>
        m.id === msgId ? { ...m, references: refs } : m,
      );
      persistConversation(updated);
      return updated;
    });
  }, [persistConversation]);

  const handleToolCalls = useCallback(async (toolCalls: ToolCall[]): Promise<ToolResult[]> => {
    if (!webSearchConfig) return [];

    const results: ToolResult[] = [];
    for (const tc of toolCalls) {
      if (tc.name === 'web_search') {
        try {
          const args = JSON.parse(tc.arguments || '{}');
          const query = args.query ?? '';
          setSearchStatus(`Searching: "${query}"`);
          const searchResults = await webSearch(webSearchConfig, query);
          results.push({
            toolCallId: tc.id,
            name: tc.name,
            content: JSON.stringify(searchResults.map((r) => ({
              title: r.title,
              url: r.url,
              content: r.content,
              engine: r.engine,
            }))),
          });
        } catch (err: any) {
          results.push({
            toolCallId: tc.id,
            name: tc.name,
            content: JSON.stringify({ error: err?.message ?? 'Search failed' }),
          });
        }
      } else {
        results.push({
          toolCallId: tc.id,
          name: tc.name,
          content: JSON.stringify({ error: `Unknown tool: ${tc.name}` }),
        });
      }
    }
    setSearchStatus(null);
    return results;
  }, [webSearchConfig]);

  const toolOptions = useMemo(() => {
    if (!searchEnabled) return undefined;
    return {
      tools: [SEARCH_TOOL_DEFINITION],
      onToolCall: handleToolCalls,
    };
  }, [searchEnabled, handleToolCalls]);

  const sendMessage = useCallback(async () => {
    const text = input.trim();
    if (!text || loading) return;

    if (!selectedModel) {
      Alert.alert('No Model', 'Please select a model before sending a message.');
      return;
    }

    const provider = providers.find((p) => p.id === selectedModel.providerId);
    if (!provider) {
      Alert.alert('Provider Error', 'Selected provider is no longer available.');
      return;
    }

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
      model: selectedModel.modelId,
      providerId: selectedModel.providerId,
    };

    const newMessages = [...messages, userMsg, assistantMsg];
    setMessages(newMessages);
    setInput('');
    setLoading(true);
    abortRef.current = false;

    let accumulated = '';

    try {
      await streamChat(provider, [...messages, userMsg], ({ content, done, usage }) => {
        if (abortRef.current) return;
        accumulated += content;
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantMsg.id ? { ...m, content: accumulated } : m,
          ),
        );
        if (done) {
          const finalMsgs = newMessages.map((m) =>
            m.id === assistantMsg.id ? { ...m, content: accumulated, usage: usage ?? undefined } : m,
          );
          setMessages(finalMsgs);
          persistConversation(finalMsgs);
        }
      }, selectedModel.modelId, toolOptions);
    } catch (err: any) {
      if (!abortRef.current) {
        Alert.alert('Error', err?.message ?? 'Failed to get response');
        setMessages((prev) => prev.filter((m) => m.id !== assistantMsg.id));
      }
    } finally {
      setLoading(false);
    }
  }, [input, loading, messages, providers, selectedModel, persistConversation]);

  const markdownStyles = useMemo(
    () =>
      StyleSheet.create({
        body: { color: COLORS.text, fontSize: 15, lineHeight: 22 },
        heading1: { color: COLORS.text, fontSize: 24, fontWeight: '700', marginTop: 8, marginBottom: 4 },
        heading2: { color: COLORS.text, fontSize: 20, fontWeight: '700', marginTop: 8, marginBottom: 4 },
        heading3: { color: COLORS.text, fontSize: 18, fontWeight: '600', marginTop: 6, marginBottom: 2 },
        heading4: { color: COLORS.text, fontSize: 16, fontWeight: '600', marginTop: 4, marginBottom: 2 },
        strong: { fontWeight: '700' },
        em: { fontStyle: 'italic' },
        link: { color: COLORS.primaryLight, textDecorationLine: 'underline' },
        blockquote: {
          backgroundColor: COLORS.surfaceLight,
          borderLeftWidth: 3,
          borderLeftColor: COLORS.primaryLight,
          paddingHorizontal: 10,
          paddingVertical: 4,
          marginVertical: 6,
          borderRadius: 4,
        },
        code_inline: {
          backgroundColor: COLORS.surfaceLight,
          color: COLORS.primaryLight,
          borderRadius: 4,
          paddingHorizontal: 5,
          paddingVertical: 1,
          fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
          fontSize: 13,
        },
        code_block: {
          backgroundColor: COLORS.background,
          color: COLORS.text,
          borderRadius: 8,
          padding: 12,
          fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
          fontSize: 13,
          lineHeight: 20,
          marginVertical: 6,
        },
        fence: {
          backgroundColor: COLORS.background,
          color: COLORS.text,
          borderRadius: 8,
          padding: 12,
          fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
          fontSize: 13,
          lineHeight: 20,
          marginVertical: 6,
        },
        table: { borderWidth: 1, borderColor: COLORS.border, borderRadius: 4, marginVertical: 6 },
        thead: { backgroundColor: COLORS.surfaceLight },
        th: { padding: 6, borderRightWidth: 1, borderColor: COLORS.border },
        td: { padding: 6, borderRightWidth: 1, borderColor: COLORS.border },
        tr: { borderBottomWidth: 1, borderColor: COLORS.border, flexDirection: 'row' },
        bullet_list: { marginVertical: 4 },
        ordered_list: { marginVertical: 4 },
        list_item: { flexDirection: 'row', marginVertical: 2 },
        hr: { backgroundColor: COLORS.border, height: 1, marginVertical: 8 },
        paragraph: { marginVertical: 2 },
      }),
    [],
  );

  const onLinkPress = useCallback((url: string) => {
    Linking.openURL(url);
    return false;
  }, []);

  const [expandedUsage, setExpandedUsage] = useState<Set<string>>(new Set());

  const toggleUsage = useCallback((msgId: string) => {
    setExpandedUsage((prev) => {
      const next = new Set(prev);
      if (next.has(msgId)) next.delete(msgId);
      else next.add(msgId);
      return next;
    });
  }, []);

  const renderMessage = useCallback(
    ({ item }: { item: Message }) => {
      const isUser = item.role === 'user';
      const isCopied = copiedIds.has(item.id);
      const hasVersions = !isUser && item.versions && item.versions.length > 0;
      const activeVersionIdx = activeVersions.get(item.id);
      const isVersionDropdownShown = versionDropdownOpen.has(item.id);

      // Resolve displayed content: if viewing a past version, use that version's data
      let displayContent = item.content;
      let displayModel = item.model;
      let displayUsage = item.usage;
      if (hasVersions && activeVersionIdx !== undefined && item.versions![activeVersionIdx]) {
        const v = item.versions![activeVersionIdx];
        displayContent = v.content;
        displayModel = v.model;
        displayUsage = v.usage;
      }

      const totalVersionCount = hasVersions ? item.versions!.length + 1 : 1;
      const currentVersionNum = activeVersionIdx !== undefined ? activeVersionIdx + 1 : totalVersionCount;

      const showUsage = !isUser && displayUsage && displayContent;
      const isExpanded = expandedUsage.has(item.id);
      const pricing = displayModel ? getModelPricing(displayModel) : null;
      const cost = displayUsage ? calculateCost(displayUsage.inputTokens, displayUsage.outputTokens, pricing) : null;
      const showActions = !isUser ? !!displayContent : true;

      return (
        <View style={styles.messageRow}>
          <View style={styles.senderInfo}>
            <View style={isUser ? styles.userAvatar : styles.agentAvatar}>
              {isUser ? (
              <Ionicons name="person" size={16} color={COLORS.text} />
            ) : (
              <Text style={styles.avatarText}>{agent.icon}</Text>
            )}
            </View>
            <View>
              <Text style={styles.senderName}>{isUser ? 'You' : agent.name}</Text>
              {!isUser && displayModel && (
                <Text style={styles.modelLabel}>{displayModel}</Text>
              )}
            </View>
          </View>
          {isUser ? (
            <>
              <View style={styles.userBubble}>
                <Text style={styles.userBubbleText}>{item.content}</Text>
              </View>
              <View style={[styles.actionRow, { marginTop: 6 }]}>
                <TouchableOpacity
                  style={styles.actionButton}
                  onPress={() => copyToClipboard(item.id, item.content)}
                  activeOpacity={0.6}
                >
                  <Ionicons
                    name={isCopied ? 'checkmark' : 'copy-outline'}
                    size={18}
                    color={isCopied ? COLORS.secondary : COLORS.textMuted}
                  />
                </TouchableOpacity>
              </View>
            </>
          ) : (
            <View style={styles.assistantContent}>
              {displayContent ? (
                <>
                  <Markdown style={markdownStyles} onLinkPress={onLinkPress}>
                    {displayContent}
                  </Markdown>
                  <View style={styles.assistantToolbar}>
                    {showActions && (
                      <View style={styles.actionRow}>
                        <LinkBubbles
                          content={displayContent}
                          references={item.references}
                          onReferencesLoaded={(refs) => handleReferencesLoaded(item.id, refs)}
                        />
                        <TouchableOpacity
                          style={styles.actionButton}
                          onPress={() => copyToClipboard(item.id, displayContent)}
                          activeOpacity={0.6}
                        >
                          <Ionicons
                            name={isCopied ? 'checkmark' : 'copy-outline'}
                            size={18}
                            color={isCopied ? COLORS.secondary : COLORS.textMuted}
                          />
                        </TouchableOpacity>
                        <View style={[styles.retryGroup, loading && styles.actionButtonDisabled]}>
                          <TouchableOpacity
                            style={styles.retryButton}
                            onPress={() => retryMessage(item.id)}
                            disabled={loading}
                            activeOpacity={0.6}
                          >
                            <Ionicons name="refresh" size={18} color={COLORS.textMuted} />
                          </TouchableOpacity>
                          <View style={styles.retryDivider} />
                          <TouchableOpacity
                            style={styles.retryDropdownButton}
                            onPress={() => openRetryModelPicker(item.id)}
                            disabled={loading}
                            activeOpacity={0.6}
                          >
                            <Ionicons name="chevron-down" size={14} color={COLORS.textMuted} />
                          </TouchableOpacity>
                        </View>
                      </View>
                    )}
                  </View>
                </>
              ) : (
                <View>
                  {searchStatus && (
                    <View style={styles.searchStatusRow}>
                      <Ionicons name="search" size={14} color={COLORS.secondary} />
                      <Text style={styles.searchStatusText}>{searchStatus}</Text>
                    </View>
                  )}
                  <View style={styles.typingIndicator}>
                    <View style={styles.typingDot} />
                    <View style={[styles.typingDot, styles.typingDotDelay]} />
                    <View style={[styles.typingDot, styles.typingDotDelay2]} />
                  </View>
                </View>
              )}
              {hasVersions && (
                <View style={styles.versionContainer}>
                  <TouchableOpacity
                    style={styles.versionPill}
                    onPress={() => toggleVersionDropdown(item.id)}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.versionPillText}>
                      Version {currentVersionNum} of {totalVersionCount}
                    </Text>
                    <Ionicons name={isVersionDropdownShown ? 'chevron-up' : 'chevron-down'} size={12} color={COLORS.textMuted} style={{ marginLeft: 4 }} />
                  </TouchableOpacity>
                  {isVersionDropdownShown && (
                    <View style={styles.versionDropdown}>
                      {item.versions!.map((v, idx) => {
                        const isActive = activeVersionIdx === idx;
                        const vDate = new Date(v.timestamp);
                        return (
                          <TouchableOpacity
                            key={idx}
                            style={[styles.versionItem, isActive && styles.versionItemActive]}
                            onPress={() => {
                              switchVersion(item.id, idx);
                              toggleVersionDropdown(item.id);
                            }}
                            activeOpacity={0.7}
                          >
                            <Text style={styles.versionItemText}>
                              v{idx + 1}{v.model ? ` · ${v.model}` : ''}
                            </Text>
                            <Text style={styles.versionItemDate}>
                              {vDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                      <TouchableOpacity
                        style={[styles.versionItem, activeVersionIdx === undefined && styles.versionItemActive]}
                        onPress={() => {
                          switchVersion(item.id, null);
                          toggleVersionDropdown(item.id);
                        }}
                        activeOpacity={0.7}
                      >
                        <Text style={styles.versionItemText}>
                          v{totalVersionCount} (latest){item.model ? ` · ${item.model}` : ''}
                        </Text>
                        <Text style={styles.versionItemDate}>
                          {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              )}
              {showUsage && (
                <TouchableOpacity
                  style={styles.usageContainer}
                  onPress={() => toggleUsage(item.id)}
                  activeOpacity={0.7}
                >
                  <View style={styles.usageCompactRow}>
                    <Ionicons name="arrow-up" size={13} color={COLORS.textMuted} />
                    <Text style={styles.usageCompact}>
                      {displayUsage!.inputTokens}{' '}
                    </Text>
                    <Ionicons name="arrow-down" size={13} color={COLORS.textMuted} />
                    <Text style={styles.usageCompact}>
                      {displayUsage!.outputTokens} tokens
                      {cost != null ? ` · ${formatCost(cost)}` : ''}
                      {displayUsage!.totalDuration ? ` · ${(displayUsage!.totalDuration / 1000).toFixed(1)}s` : ''}
                    </Text>
                  </View>
                  {isExpanded && (
                    <View style={styles.usageDetail}>
                      <Text style={styles.usageDetailText}>
                        Input tokens: {displayUsage!.inputTokens}
                      </Text>
                      <Text style={styles.usageDetailText}>
                        Output tokens: {displayUsage!.outputTokens}
                      </Text>
                      {pricing && (
                        <>
                          <Text style={styles.usageDetailText}>
                            Input cost: {formatCost(displayUsage!.inputTokens * pricing.input / 1_000_000)}
                            {' '}({formatPrice(pricing.input)}/MTok)
                          </Text>
                          <Text style={styles.usageDetailText}>
                            Output cost: {formatCost(displayUsage!.outputTokens * pricing.output / 1_000_000)}
                            {' '}({formatPrice(pricing.output)}/MTok)
                          </Text>
                          {cost != null && (
                            <Text style={styles.usageDetailText}>
                              Total cost: {formatCost(cost)}
                            </Text>
                          )}
                        </>
                      )}
                      {displayUsage!.totalDuration != null && (
                        <Text style={styles.usageDetailText}>
                          Duration: {(displayUsage!.totalDuration / 1000).toFixed(2)}s
                        </Text>
                      )}
                      {displayUsage!.generationDuration != null && (
                        <Text style={styles.usageDetailText}>
                          Generation: {(displayUsage!.generationDuration / 1000).toFixed(2)}s
                        </Text>
                      )}
                      {displayUsage!.tokensPerSecond != null && (
                        <Text style={styles.usageDetailText}>
                          Speed: {displayUsage!.tokensPerSecond.toFixed(1)} tok/s
                        </Text>
                      )}
                    </View>
                  )}
                </TouchableOpacity>
              )}
            </View>
          )}
        </View>
      );
    },
    [agent, markdownStyles, onLinkPress, expandedUsage, toggleUsage, copiedIds, activeVersions, versionDropdownOpen, loading, copyToClipboard, retryMessage, openRetryModelPicker, switchVersion, toggleVersionDropdown, handleReferencesLoaded, searchStatus],
  );

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={headerHeight}
      >
        <FlatList
          ref={flatListRef}
          data={visibleMessages}
          keyExtractor={(m) => m.id}
          renderItem={renderMessage}
          contentContainerStyle={styles.messageList}
          onContentSizeChange={scrollToBottom}
          keyboardDismissMode="on-drag"
          keyboardShouldPersistTaps="handled"
          onScrollBeginDrag={Keyboard.dismiss}
        />
        <View style={styles.inputCard}>
          <TextInput
            style={styles.input}
            value={input}
            onChangeText={setInput}
            placeholder={`Message ${agent.name}...`}
            placeholderTextColor={COLORS.textMuted}
            multiline
            maxLength={4000}
            returnKeyType="default"
          />
          <View style={styles.inputActions}>
            <TouchableOpacity
              style={styles.modelButton}
              onPress={() => setModelPickerVisible(true)}
              activeOpacity={0.7}
            >
              <Text style={styles.modelButtonText} numberOfLines={1}>
                {selectedModelName}
              </Text>
              <Ionicons name="chevron-down" size={14} color={COLORS.textMuted} />
            </TouchableOpacity>
            <View style={styles.inputActionsRight}>
              {searchAvailable && (
                <TouchableOpacity
                  style={[styles.searchToggle, searchToggle && styles.searchToggleActive]}
                  onPress={handleSearchToggle}
                  activeOpacity={0.7}
                >
                  <Ionicons
                    name="globe-outline"
                    size={18}
                    color={searchToggle ? COLORS.secondary : COLORS.textMuted}
                  />
                </TouchableOpacity>
              )}
              {loading ? (
                <TouchableOpacity
                  style={styles.stopButton}
                  onPress={stopGeneration}
                >
                  <View style={styles.stopIcon} />
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  style={[styles.sendButton, !input.trim() && styles.sendDisabled]}
                  onPress={sendMessage}
                  disabled={!input.trim()}
                >
                  <Ionicons name="arrow-up" size={22} color={COLORS.background} />
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View>
        <ModelSelectorModal
          visible={modelPickerVisible}
          models={availableModels}
          selectedModel={selectedModel}
          onSelect={(providerId, modelId) => setSelectedModel({ providerId, modelId })}
          onClose={() => setModelPickerVisible(false)}
        />
        <ModelSelectorModal
          visible={retryModelPickerVisible}
          models={availableModels}
          selectedModel={selectedModel}
          onSelect={handleRetryModelSelect}
          onClose={() => setRetryModelPickerVisible(false)}
        />
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
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
  },
  messageRow: {
    flexDirection: 'column',
    alignItems: 'flex-start',
    marginBottom: 24,
  },
  senderInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  agentAvatar: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: COLORS.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  userAvatar: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: COLORS.surfaceLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  avatarText: {
    fontSize: 13,
  },
  senderName: {
    fontSize: 13,
    color: COLORS.textSecondary,
    fontWeight: '600',
  },
  userBubble: {
    backgroundColor: COLORS.surfaceLight,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    alignSelf: 'flex-start',
    maxWidth: '85%',
  },
  userBubbleText: {
    color: COLORS.text,
    fontSize: 15,
    lineHeight: 22,
  },
  assistantContent: {
  },
  usageContainer: {
    marginTop: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: COLORS.surface,
    borderRadius: 10,
    alignSelf: 'flex-start',
  },
  usageCompactRow: {
    flexDirection: 'row' as const,
    alignItems: 'center',
  },
  usageCompact: {
    color: COLORS.textMuted,
    fontSize: 13,
  },
  usageDetail: {
    marginTop: 6,
    paddingTop: 6,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: COLORS.border,
  },
  usageDetailText: {
    color: COLORS.textMuted,
    fontSize: 13,
    lineHeight: 20,
  },
  typingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 8,
  },
  searchStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 2,
  },
  searchStatusText: {
    color: COLORS.secondary,
    fontSize: 13,
    fontStyle: 'italic',
  },
  typingDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: COLORS.textMuted,
    opacity: 0.6,
  },
  typingDotDelay: {
    opacity: 0.4,
  },
  typingDotDelay2: {
    opacity: 0.2,
  },
  inputCard: {
    marginHorizontal: 12,
    marginBottom: 12,
    backgroundColor: COLORS.surface,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
  },
  input: {
    color: COLORS.text,
    fontSize: 15,
    lineHeight: 22,
    maxHeight: 120,
    minHeight: 24,
    paddingTop: 0,
    paddingBottom: 0,
  },
  inputActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
  },
  inputActionsRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  searchToggle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.surfaceLight,
  },
  searchToggleActive: {
    backgroundColor: COLORS.secondary + '22',
  },
  modelButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surfaceLight,
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 10,
    maxWidth: '60%',
  },
  modelButtonText: {
    color: COLORS.textSecondary,
    fontSize: 14,
    marginRight: 4,
    flexShrink: 1,
  },
  modelButtonArrow: {
    color: COLORS.textMuted,
    fontSize: 12,
  },
  modelLabel: {
    color: COLORS.textMuted,
    fontSize: 12,
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendDisabled: {
    backgroundColor: COLORS.primaryDark,
    opacity: 0.5,
  },
  sendIcon: {
    color: COLORS.background,
    fontSize: 18,
    fontWeight: '700',
  },
  stopButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stopIcon: {
    width: 14,
    height: 14,
    borderRadius: 2,
    backgroundColor: COLORS.background,
  },
  assistantToolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  actionButton: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: COLORS.surface,
  },
  actionButtonDisabled: {
    opacity: 0.35,
  },
  retryGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: 10,
    height: 40,
  },
  retryButton: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
    height: 40,
  },
  retryDivider: {
    width: StyleSheet.hairlineWidth,
    height: 22,
    backgroundColor: COLORS.primaryDark,
  },
  retryDropdownButton: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
    height: 40,
  },
  versionContainer: {
    marginTop: 6,
    alignSelf: 'flex-start',
  },
  versionPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  versionPillText: {
    color: COLORS.textMuted,
    fontSize: 13,
    marginRight: 4,
  },
  versionPillArrow: {
    color: COLORS.textMuted,
    fontSize: 10,
  },
  versionDropdown: {
    marginTop: 4,
    backgroundColor: COLORS.surface,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    overflow: 'hidden',
  },
  versionItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.border,
  },
  versionItemActive: {
    backgroundColor: COLORS.surfaceLight,
  },
  versionItemText: {
    color: COLORS.text,
    fontSize: 14,
    flex: 1,
  },
  versionItemDate: {
    color: COLORS.textMuted,
    fontSize: 13,
    marginLeft: 8,
  },
});
