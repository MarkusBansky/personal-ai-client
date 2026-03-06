import { Agent, Provider } from '../types';

export const COLORS = {
  primary: '#6366F1',
  primaryLight: '#818CF8',
  primaryDark: '#4F46E5',
  secondary: '#10B981',
  danger: '#EF4444',
  warning: '#F59E0B',
  background: '#0F172A',
  surface: '#1E293B',
  surfaceLight: '#334155',
  border: '#334155',
  text: '#F1F5F9',
  textSecondary: '#94A3B8',
  textMuted: '#64748B',
  userBubble: '#6366F1',
  assistantBubble: '#1E293B',
  white: '#FFFFFF',
};

export const DEFAULT_SYSTEM_PROMPTS: Record<string, string> = {
  chat: `You are a helpful, friendly AI assistant. Answer questions clearly and concisely.`,
  researcher: `You are an expert research assistant. When given a topic or question:
1. Break it down systematically
2. Provide well-structured, comprehensive answers with key facts
3. Cite sources when possible and acknowledge uncertainty
4. Summarize findings clearly`,
  coding: `You are an expert software engineer and coding assistant. When helping with code:
1. Write clean, well-commented, production-ready code
2. Explain your approach and key decisions
3. Point out potential edge cases and bugs
4. Follow best practices for the relevant language/framework
5. Provide examples when helpful`,
  custom: `You are a helpful AI assistant.`,
};

export const AGENT_ICONS: Record<string, string> = {
  chat: '💬',
  researcher: '🔬',
  coding: '💻',
  custom: '🤖',
};

export const AGENT_COLORS: Record<string, string> = {
  chat: '#6366F1',
  researcher: '#10B981',
  coding: '#F59E0B',
  custom: '#8B5CF6',
};

export const DEFAULT_PROVIDERS: Provider[] = [
  {
    id: 'ollama-local',
    type: 'ollama',
    name: 'Ollama (Local)',
    baseUrl: 'http://localhost:11434',
    apiKey: '',
    model: 'llama3.2',
  },
  {
    id: 'vllm-local',
    type: 'vllm',
    name: 'vLLM (Local)',
    baseUrl: 'http://localhost:8000',
    apiKey: '',
    model: 'meta-llama/Llama-3.1-8B-Instruct',
  },
  {
    id: 'openai-default',
    type: 'openai',
    name: 'OpenAI',
    baseUrl: 'https://api.openai.com/v1',
    apiKey: '',
    model: 'gpt-4o',
  },
  {
    id: 'anthropic-default',
    type: 'anthropic',
    name: 'Anthropic',
    baseUrl: 'https://api.anthropic.com',
    apiKey: '',
    model: 'claude-3-5-sonnet-20241022',
  },
  {
    id: 'mistral-default',
    type: 'mistral',
    name: 'Mistral AI',
    baseUrl: 'https://api.mistral.ai/v1',
    apiKey: '',
    model: 'mistral-large-latest',
  },
];

export const DEFAULT_AGENTS: Agent[] = [
  {
    id: 'agent-chat',
    name: 'Chat',
    type: 'chat',
    description: 'General purpose conversational assistant',
    systemPrompt: DEFAULT_SYSTEM_PROMPTS.chat,
    providerId: 'ollama-local',
    icon: '💬',
    color: '#6366F1',
  },
  {
    id: 'agent-researcher',
    name: 'Researcher',
    type: 'researcher',
    description: 'Deep research and analysis on any topic',
    systemPrompt: DEFAULT_SYSTEM_PROMPTS.researcher,
    providerId: 'ollama-local',
    icon: '🔬',
    color: '#10B981',
  },
  {
    id: 'agent-coding',
    name: 'Coding',
    type: 'coding',
    description: 'Expert programming and code review assistant',
    systemPrompt: DEFAULT_SYSTEM_PROMPTS.coding,
    providerId: 'ollama-local',
    icon: '💻',
    color: '#F59E0B',
  },
];
