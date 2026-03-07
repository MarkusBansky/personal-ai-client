export type ProviderType = 'openai' | 'anthropic' | 'mistral' | 'ollama' | 'vllm' | 'custom';

export type AgentType = 'chat' | 'researcher' | 'coding' | 'custom';

export type SearxngRequestType = 'json_api' | 'html_get' | 'html_post';

export type SearchProviderType = 'searxng' | 'tavily' | 'exa' | 'bing';

export interface SearxngConfig {
  baseUrl: string;
  requestType: SearxngRequestType;
}

export interface TavilyConfig {
  apiKey: string;
}

export interface ExaConfig {
  apiKey: string;
}

export interface BingConfig {
  apiKey: string;
}

export interface WebSearchConfig {
  enabled: boolean;
  activeProvider: SearchProviderType;
  searxng?: SearxngConfig;
  tavily?: TavilyConfig;
  exa?: ExaConfig;
  bing?: BingConfig;
}

export interface SearchResult {
  title: string;
  url: string;
  content: string;
  engine: string;
}

export interface ToolDefinition {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

export interface ToolCall {
  id: string;
  name: string;
  arguments: string;
}

export interface ToolResult {
  toolCallId: string;
  name: string;
  content: string;
}

export interface Provider {
  id: string;
  type: ProviderType;
  name: string;
  baseUrl: string;
  apiKey: string;
  model: string;
  enabled: boolean;
}

export interface ModelInfo {
  id: string;
  name: string;
  providerId: string;
  providerName: string;
  inputPrice?: number;
  outputPrice?: number;
}

export interface UsageInfo {
  inputTokens: number;
  outputTokens: number;
  totalDuration?: number;
  generationDuration?: number;
  tokensPerSecond?: number;
}

export interface Agent {
  id: string;
  name: string;
  type: AgentType;
  description: string;
  systemPrompt: string;
  icon: string;
  color: string;
}

export interface LinkMeta {
  url: string;
  title: string;
  favicon: string;
}

export interface MessageVersion {
  content: string;
  timestamp: number;
  model?: string;
  providerId?: string;
  usage?: UsageInfo;
}

export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  timestamp: number;
  model?: string;
  providerId?: string;
  usage?: UsageInfo;
  versions?: MessageVersion[];
  references?: LinkMeta[];
  toolCalls?: ToolCall[];
  toolCallId?: string;
}

export interface Conversation {
  id: string;
  agentId: string;
  title: string;
  messages: Message[];
  createdAt: number;
  updatedAt: number;
}

export interface AppSettings {
  providers: Provider[];
  agents: Agent[];
  activeConversationId: string | null;
  theme: 'light' | 'dark';
  webSearch?: WebSearchConfig;
}
