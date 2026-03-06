import { Message, Provider } from '../../types';

export interface StreamChunk {
  content: string;
  done: boolean;
}

export type StreamCallback = (chunk: StreamChunk) => void;

// ── OpenAI-compatible (OpenAI, vLLM, Ollama, custom) ──────────────────────────
async function callOpenAICompatible(
  provider: Provider,
  messages: Message[],
  onStream: StreamCallback,
): Promise<void> {
  const endpoint = `${provider.baseUrl.replace(/\/$/, '')}/chat/completions`;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (provider.apiKey) {
    headers['Authorization'] = `Bearer ${provider.apiKey}`;
  }

  const body = JSON.stringify({
    model: provider.model,
    messages: (() => {
      let systemFound = false;
      return messages
        .filter((m) => {
          if (m.role !== 'system') return true;
          if (!systemFound) { systemFound = true; return true; }
          return false;
        })
        .map((m) => ({ role: m.role, content: m.content }));
    })(),
    stream: true,
  });

  const response = await fetch(endpoint, { method: 'POST', headers, body });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`HTTP ${response.status}: ${text}`);
  }

  if (!response.body) {
    throw new Error('No response body');
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed === 'data: [DONE]') continue;
      if (!trimmed.startsWith('data: ')) continue;

      try {
        const json = JSON.parse(trimmed.slice(6));
        const content = json?.choices?.[0]?.delta?.content;
        if (content) {
          onStream({ content, done: false });
        }
      } catch {
        // ignore malformed SSE lines
      }
    }
  }

  onStream({ content: '', done: true });
}

// ── Ollama native API (/api/chat) ─────────────────────────────────────────────
async function callOllama(
  provider: Provider,
  messages: Message[],
  onStream: StreamCallback,
): Promise<void> {
  const endpoint = `${provider.baseUrl.replace(/\/$/, '')}/api/chat`;
  const body = JSON.stringify({
    model: provider.model,
    messages: messages.map((m) => ({ role: m.role, content: m.content })),
    stream: true,
  });

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`HTTP ${response.status}: ${text}`);
  }

  if (!response.body) throw new Error('No response body');

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';

    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        const json = JSON.parse(line);
        const content = json?.message?.content;
        if (content) onStream({ content, done: false });
        if (json?.done) onStream({ content: '', done: true });
      } catch {
        // ignore
      }
    }
  }

  onStream({ content: '', done: true });
}

// ── Anthropic Messages API ────────────────────────────────────────────────────
async function callAnthropic(
  provider: Provider,
  messages: Message[],
  onStream: StreamCallback,
): Promise<void> {
  const endpoint = `${provider.baseUrl.replace(/\/$/, '')}/v1/messages`;

  const systemMessage = messages.find((m) => m.role === 'system');
  const conversationMessages = messages
    .filter((m) => m.role !== 'system')
    .map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content }));

  const body = JSON.stringify({
    model: provider.model,
    max_tokens: 8192,
    ...(systemMessage ? { system: systemMessage.content } : {}),
    messages: conversationMessages,
    stream: true,
  });

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': provider.apiKey,
      'anthropic-version': '2023-06-01',
    },
    body,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`HTTP ${response.status}: ${text}`);
  }

  if (!response.body) throw new Error('No response body');

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith('data: ')) continue;
      try {
        const json = JSON.parse(trimmed.slice(6));
        if (json.type === 'content_block_delta') {
          const content = json?.delta?.text;
          if (content) onStream({ content, done: false });
        } else if (json.type === 'message_stop') {
          onStream({ content: '', done: true });
        }
      } catch {
        // ignore
      }
    }
  }

  onStream({ content: '', done: true });
}

// ── Public API ────────────────────────────────────────────────────────────────
export async function streamChat(
  provider: Provider,
  messages: Message[],
  onStream: StreamCallback,
): Promise<void> {
  switch (provider.type) {
    case 'anthropic':
      return callAnthropic(provider, messages, onStream);
    case 'ollama':
      return callOllama(provider, messages, onStream);
    case 'openai':
    case 'mistral':
    case 'vllm':
    case 'custom':
    default:
      return callOpenAICompatible(provider, messages, onStream);
  }
}
