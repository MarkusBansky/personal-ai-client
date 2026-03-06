export type ProviderType = 'openai' | 'anthropic' | 'mistral' | 'ollama' | 'vllm' | 'custom';

export type AgentType = 'chat' | 'researcher' | 'coding' | 'custom';

export interface Provider {
  id: string;
  type: ProviderType;
  name: string;
  baseUrl: string;
  apiKey: string;
  model: string;
}

export interface Agent {
  id: string;
  name: string;
  type: AgentType;
  description: string;
  systemPrompt: string;
  providerId: string;
  icon: string;
  color: string;
}

export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
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
}
