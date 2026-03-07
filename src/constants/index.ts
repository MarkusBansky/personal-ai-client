import { Agent, Provider, ToolDefinition } from '../types';

export const COLORS = {
  primary: '#71717a',
  primaryLight: '#a1a1aa',
  primaryDark: '#52525b',
  secondary: '#10B981',
  danger: '#EF4444',
  warning: '#F59E0B',
  background: '#09090b',
  surface: '#18181b',
  surfaceLight: '#27272a',
  border: '#27272a',
  text: '#fafafa',
  textSecondary: '#a1a1aa',
  textMuted: '#71717a',
  userBubble: '#27272a',
  assistantBubble: '#18181b',
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
  chat: '#818cf8',
  researcher: '#34d399',
  coding: '#fbbf24',
  custom: '#a78bfa',
};

export const DEFAULT_PROVIDERS: Provider[] = [
  {
    id: 'ollama-local',
    type: 'ollama',
    name: 'Ollama (Local)',
    baseUrl: 'http://localhost:11434',
    apiKey: '',
    model: 'llama3.2',
    enabled: true,
  },
];

export const DEFAULT_AGENTS: Agent[] = [
  {
    id: 'agent-chat',
    name: 'Chat',
    type: 'chat',
    description: 'General purpose conversational assistant',
    systemPrompt: DEFAULT_SYSTEM_PROMPTS.chat,
    icon: '💬',
    color: '#818cf8',
  },
  {
    id: 'agent-researcher',
    name: 'Researcher',
    type: 'researcher',
    description: 'Deep research and analysis on any topic',
    systemPrompt: DEFAULT_SYSTEM_PROMPTS.researcher,
    icon: '🔬',
    color: '#34d399',
  },
  {
    id: 'agent-coding',
    name: 'Coding',
    type: 'coding',
    description: 'Expert programming and code review assistant',
    systemPrompt: DEFAULT_SYSTEM_PROMPTS.coding,
    icon: '💻',
    color: '#fbbf24',
  },
];

export const SEARCH_TOOL_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'web_search',
    description:
      'Search the web for current information. Use this tool to find up-to-date facts, news, documentation, or any information that may not be in your training data. Returns a list of search results with titles, URLs, and content snippets.',
    parameters: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'The search query to look up on the web.',
        },
      },
      required: ['query'],
    },
  },
};

export const SEARCH_SYSTEM_PROMPT_SUPPLEMENT =
  'You have access to a web_search tool that lets you search the internet. Use it to find current, accurate information before answering questions that may require up-to-date knowledge, real-time data, or facts you are uncertain about. Always cite the sources from search results in your answers.';
