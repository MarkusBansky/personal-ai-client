import { fetch } from 'expo/fetch';
import { Message, ModelInfo, Provider, UsageInfo, ToolDefinition, ToolCall, ToolResult } from '../../types';
import { getModelPricing } from '../../constants/pricing';

export interface StreamChunk {
  content: string;
  done: boolean;
  usage?: UsageInfo;
  toolCalls?: ToolCall[];
}

export type StreamCallback = (chunk: StreamChunk) => void;
export type ToolCallHandler = (toolCalls: ToolCall[]) => Promise<ToolResult[]>;

interface StreamOptions {
  tools?: ToolDefinition[];
  onToolCall?: ToolCallHandler;
}

// ── OpenAI-compatible (OpenAI, vLLM, Ollama, custom) ──────────────────────────
async function callOpenAICompatible(
  provider: Provider,
  messages: Message[],
  onStream: StreamCallback,
  modelOverride?: string,
  options?: StreamOptions,
): Promise<void> {
  const endpoint = `${provider.baseUrl.replace(/\/$/, '')}/chat/completions`;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (provider.apiKey) {
    headers['Authorization'] = `Bearer ${provider.apiKey}`;
  }

  const apiMessages = (() => {
    let systemFound = false;
    return messages
      .filter((m) => {
        if (m.role === 'tool') return true;
        if (m.role !== 'system') return true;
        if (!systemFound) { systemFound = true; return true; }
        return false;
      })
      .map((m) => {
        if (m.role === 'tool') {
          return { role: 'tool' as const, content: m.content, tool_call_id: m.toolCallId };
        }
        if (m.role === 'assistant' && m.toolCalls && m.toolCalls.length > 0) {
          return {
            role: 'assistant' as const,
            content: m.content || null,
            tool_calls: m.toolCalls.map((tc) => ({
              id: tc.id,
              type: 'function' as const,
              function: { name: tc.name, arguments: tc.arguments },
            })),
          };
        }
        return { role: m.role, content: m.content };
      });
  })();

  const bodyObj: Record<string, unknown> = {
    model: modelOverride ?? provider.model,
    messages: apiMessages,
    stream: true,
    stream_options: { include_usage: true },
  };

  if (options?.tools && options.tools.length > 0) {
    bodyObj.tools = options.tools;
  }

  const body = JSON.stringify(bodyObj);

  const response = await fetch(endpoint, { method: 'POST', headers, body });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`HTTP ${response.status}: ${text}`);
  }

  if (!response.body) {
    throw new Error('No response body');
  }

  const startTime = Date.now();
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let usageInfo: UsageInfo | undefined;

  // Tool call accumulation
  const toolCallsMap = new Map<number, { id: string; name: string; arguments: string }>();
  let hasToolCalls = false;

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
        const delta = json?.choices?.[0]?.delta;

        if (delta?.content) {
          onStream({ content: delta.content, done: false });
        }

        // Accumulate tool calls from streaming deltas
        if (delta?.tool_calls) {
          hasToolCalls = true;
          for (const tc of delta.tool_calls) {
            const idx = tc.index ?? 0;
            if (!toolCallsMap.has(idx)) {
              toolCallsMap.set(idx, { id: tc.id ?? '', name: tc.function?.name ?? '', arguments: '' });
            }
            const existing = toolCallsMap.get(idx)!;
            if (tc.id) existing.id = tc.id;
            if (tc.function?.name) existing.name = tc.function.name;
            if (tc.function?.arguments) existing.arguments += tc.function.arguments;
          }
        }

        // Capture usage from the final chunk
        if (json?.usage) {
          const elapsed = Date.now() - startTime;
          usageInfo = {
            inputTokens: json.usage.prompt_tokens ?? 0,
            outputTokens: json.usage.completion_tokens ?? 0,
            totalDuration: elapsed,
            tokensPerSecond: elapsed > 0 ? ((json.usage.completion_tokens ?? 0) / (elapsed / 1000)) : undefined,
          };
        }
      } catch {
        // ignore malformed SSE lines
      }
    }
  }

  // If tool calls were accumulated, return them
  if (hasToolCalls && toolCallsMap.size > 0) {
    const toolCalls: ToolCall[] = Array.from(toolCallsMap.values());
    onStream({ content: '', done: true, usage: usageInfo, toolCalls });
    return;
  }

  onStream({ content: '', done: true, usage: usageInfo });
}

// ── Ollama native API (/api/chat) ─────────────────────────────────────────────
async function callOllama(
  provider: Provider,
  messages: Message[],
  onStream: StreamCallback,
  modelOverride?: string,
  options?: StreamOptions,
): Promise<void> {
  const endpoint = `${provider.baseUrl.replace(/\/$/, '')}/api/chat`;

  const apiMessages = messages.map((m) => {
    if (m.role === 'tool') {
      return { role: 'tool' as const, content: m.content };
    }
    if (m.role === 'assistant' && m.toolCalls && m.toolCalls.length > 0) {
      return {
        role: 'assistant' as const,
        content: m.content || '',
        tool_calls: m.toolCalls.map((tc) => ({
          function: { name: tc.name, arguments: JSON.parse(tc.arguments || '{}') },
        })),
      };
    }
    return { role: m.role, content: m.content };
  });

  const bodyObj: Record<string, unknown> = {
    model: modelOverride ?? provider.model,
    messages: apiMessages,
    stream: true,
  };

  if (options?.tools && options.tools.length > 0) {
    bodyObj.tools = options.tools;
  }

  const body = JSON.stringify(bodyObj);

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

  const startTime = Date.now();
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let usageInfo: UsageInfo | undefined;
  const collectedToolCalls: ToolCall[] = [];

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

        // Ollama returns tool_calls in the message
        if (json?.message?.tool_calls) {
          for (const tc of json.message.tool_calls) {
            collectedToolCalls.push({
              id: `ollama-tc-${Date.now()}-${collectedToolCalls.length}`,
              name: tc.function?.name ?? '',
              arguments: JSON.stringify(tc.function?.arguments ?? {}),
            });
          }
        }

        if (json?.done) {
          const inputTokens = json.prompt_eval_count ?? 0;
          const outputTokens = json.eval_count ?? 0;
          const totalDurationNs = json.total_duration ?? 0;
          const evalDurationNs = json.eval_duration ?? 0;
          usageInfo = {
            inputTokens,
            outputTokens,
            totalDuration: totalDurationNs > 0 ? Math.round(totalDurationNs / 1e6) : (Date.now() - startTime),
            generationDuration: evalDurationNs > 0 ? Math.round(evalDurationNs / 1e6) : undefined,
            tokensPerSecond: evalDurationNs > 0 ? (outputTokens / (evalDurationNs / 1e9)) : undefined,
          };
        }
      } catch {
        // ignore
      }
    }
  }

  if (collectedToolCalls.length > 0) {
    onStream({ content: '', done: true, usage: usageInfo, toolCalls: collectedToolCalls });
    return;
  }

  onStream({ content: '', done: true, usage: usageInfo });
}

// ── Anthropic Messages API ────────────────────────────────────────────────────
async function callAnthropic(
  provider: Provider,
  messages: Message[],
  onStream: StreamCallback,
  modelOverride?: string,
  options?: StreamOptions,
): Promise<void> {
  const endpoint = `${provider.baseUrl.replace(/\/$/, '')}/v1/messages`;

  const systemMessage = messages.find((m) => m.role === 'system');
  const conversationMessages = messages
    .filter((m) => m.role !== 'system')
    .map((m) => {
      if (m.role === 'tool') {
        // Anthropic expects tool results as user messages with tool_result content blocks
        return {
          role: 'user' as const,
          content: [{
            type: 'tool_result' as const,
            tool_use_id: m.toolCallId ?? '',
            content: m.content,
          }],
        };
      }
      if (m.role === 'assistant' && m.toolCalls && m.toolCalls.length > 0) {
        const contentBlocks: any[] = [];
        if (m.content) {
          contentBlocks.push({ type: 'text', text: m.content });
        }
        for (const tc of m.toolCalls) {
          contentBlocks.push({
            type: 'tool_use',
            id: tc.id,
            name: tc.name,
            input: JSON.parse(tc.arguments || '{}'),
          });
        }
        return { role: 'assistant' as const, content: contentBlocks };
      }
      return { role: m.role as 'user' | 'assistant', content: m.content };
    });

  const bodyObj: Record<string, unknown> = {
    model: modelOverride ?? provider.model,
    max_tokens: 8192,
    ...(systemMessage ? { system: systemMessage.content } : {}),
    messages: conversationMessages,
    stream: true,
  };

  if (options?.tools && options.tools.length > 0) {
    bodyObj.tools = options.tools.map((t) => ({
      name: t.function.name,
      description: t.function.description,
      input_schema: t.function.parameters,
    }));
  }

  const body = JSON.stringify(bodyObj);

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

  const startTime = Date.now();
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let inputTokens = 0;
  let outputTokens = 0;

  // Tool call accumulation for Anthropic
  const toolCalls: ToolCall[] = [];
  let currentToolId = '';
  let currentToolName = '';
  let currentToolInput = '';

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
        if (json.type === 'message_start') {
          inputTokens = json.message?.usage?.input_tokens ?? 0;
        } else if (json.type === 'content_block_start') {
          if (json.content_block?.type === 'tool_use') {
            currentToolId = json.content_block.id ?? '';
            currentToolName = json.content_block.name ?? '';
            currentToolInput = '';
          }
        } else if (json.type === 'content_block_delta') {
          if (json.delta?.type === 'text_delta') {
            const content = json.delta.text;
            if (content) onStream({ content, done: false });
          } else if (json.delta?.type === 'input_json_delta') {
            currentToolInput += json.delta.partial_json ?? '';
          }
        } else if (json.type === 'content_block_stop') {
          if (currentToolId) {
            toolCalls.push({
              id: currentToolId,
              name: currentToolName,
              arguments: currentToolInput || '{}',
            });
            currentToolId = '';
            currentToolName = '';
            currentToolInput = '';
          }
        } else if (json.type === 'message_delta') {
          outputTokens = json.usage?.output_tokens ?? 0;
        } else if (json.type === 'message_stop') {
          const elapsed = Date.now() - startTime;
          const usageInfo: UsageInfo = {
            inputTokens,
            outputTokens,
            totalDuration: elapsed,
            tokensPerSecond: elapsed > 0 ? (outputTokens / (elapsed / 1000)) : undefined,
          };

          if (toolCalls.length > 0) {
            onStream({ content: '', done: true, usage: usageInfo, toolCalls });
          } else {
            onStream({ content: '', done: true, usage: usageInfo });
          }
        }
      } catch {
        // ignore
      }
    }
  }

  // Safety fallback: ensure done is always sent
  if (toolCalls.length > 0) {
    onStream({ content: '', done: true, toolCalls });
  } else {
    onStream({ content: '', done: true });
  }
}

// ── Validation ────────────────────────────────────────────────────────────────
async function probeOllama(base: string, signal: AbortSignal): Promise<void> {
  const res = await fetch(`${base}/api/tags`, { signal });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
}

async function probeAnthropic(provider: Provider, base: string, signal: AbortSignal): Promise<void> {
  const res = await fetch(`${base}/v1/messages`, {
    method: 'POST',
    signal,
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': provider.apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({ model: provider.model, max_tokens: 1, messages: [{ role: 'user', content: 'hi' }] }),
  });
  if (res.status === 401 || res.status === 403) {
    throw new Error('Authentication failed – check your API key.');
  }
}

async function probeOpenAICompatible(provider: Provider, base: string, signal: AbortSignal): Promise<void> {
  const headers: Record<string, string> = {};
  if (provider.apiKey) headers['Authorization'] = `Bearer ${provider.apiKey}`;
  const res = await fetch(`${base}/models`, { headers, signal });
  if (res.status === 401 || res.status === 403) {
    throw new Error('Authentication failed – check your API key.');
  }
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
}

export async function validateProvider(provider: Provider): Promise<{ ok: boolean; error?: string }> {
  const base = provider.baseUrl.replace(/\/$/, '');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10_000);

  try {
    switch (provider.type) {
      case 'ollama':
        await probeOllama(base, controller.signal);
        break;
      case 'anthropic':
        await probeAnthropic(provider, base, controller.signal);
        break;
      default:
        await probeOpenAICompatible(provider, base, controller.signal);
        break;
    }
    return { ok: true };
  } catch (err: any) {
    if (err?.name === 'AbortError') return { ok: false, error: 'Request timed out – server not reachable.' };
    return { ok: false, error: err?.message ?? 'Unknown error' };
  } finally {
    clearTimeout(timer);
  }
}

// ── Fetch available models ────────────────────────────────────────────────────
export async function fetchModels(provider: Provider): Promise<ModelInfo[]> {
  const base = provider.baseUrl.replace(/\/$/, '');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10_000);

  try {
    switch (provider.type) {
      case 'ollama': {
        const res = await fetch(`${base}/api/tags`, { signal: controller.signal });
        if (!res.ok) return [];
        const data = await res.json();
        const models: any[] = data?.models ?? [];
        const seen = new Set<string>();
        return models.reduce<ModelInfo[]>((acc, m: any) => {
          const id = m.name ?? m.model ?? '';
          if (id && !seen.has(id)) {
            seen.add(id);
            const pricing = getModelPricing(id);
            acc.push({ id, name: id, providerId: provider.id, providerName: provider.name, inputPrice: pricing?.input, outputPrice: pricing?.output });
          }
          return acc;
        }, []);
      }
      case 'anthropic': {
        // Anthropic has no public list-models endpoint — return configured model
        if (!provider.model) return [];
        const pricing = getModelPricing(provider.model);
        return [{
          id: provider.model,
          name: provider.model,
          providerId: provider.id,
          providerName: provider.name,
          inputPrice: pricing?.input,
          outputPrice: pricing?.output,
        }];
      }
      default: {
        // OpenAI-compatible: OpenAI, Mistral, vLLM, Custom
        const headers: Record<string, string> = {};
        if (provider.apiKey) headers['Authorization'] = `Bearer ${provider.apiKey}`;
        const res = await fetch(`${base}/models`, { headers, signal: controller.signal });
        if (!res.ok) return [];
        const data = await res.json();
        const models: any[] = data?.data ?? [];
        const seen = new Set<string>();
        return models.reduce<ModelInfo[]>((acc, m: any) => {
          const id = m.id ?? '';
          if (id && !seen.has(id)) {
            seen.add(id);
            const pricing = getModelPricing(id);
            acc.push({ id, name: id, providerId: provider.id, providerName: provider.name, inputPrice: pricing?.input, outputPrice: pricing?.output });
          }
          return acc;
        }, []);
      }
    }
  } catch {
    return [];
  } finally {
    clearTimeout(timer);
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

async function callProviderOnce(
  provider: Provider,
  messages: Message[],
  onStream: StreamCallback,
  modelOverride?: string,
  options?: StreamOptions,
): Promise<void> {
  switch (provider.type) {
    case 'anthropic':
      return callAnthropic(provider, messages, onStream, modelOverride, options);
    case 'ollama':
      return callOllama(provider, messages, onStream, modelOverride, options);
    case 'openai':
    case 'mistral':
    case 'vllm':
    case 'custom':
    default:
      return callOpenAICompatible(provider, messages, onStream, modelOverride, options);
  }
}

const MAX_TOOL_ITERATIONS = 5;

export async function streamChat(
  provider: Provider,
  messages: Message[],
  onStream: StreamCallback,
  modelOverride?: string,
  options?: StreamOptions,
): Promise<void> {
  // If no tools or no tool handler, do a simple single call
  if (!options?.tools || options.tools.length === 0 || !options.onToolCall) {
    return callProviderOnce(provider, messages, onStream, modelOverride);
  }

  // Tool-calling loop: call provider, handle tool calls, repeat up to MAX_TOOL_ITERATIONS
  let currentMessages = [...messages];
  let iteration = 0;

  while (iteration < MAX_TOOL_ITERATIONS) {
    iteration++;

    let accumulatedContent = '';
    let finalToolCalls: ToolCall[] | undefined;
    let finalUsage: UsageInfo | undefined;

    await callProviderOnce(
      provider,
      currentMessages,
      (chunk) => {
        if (chunk.content) {
          accumulatedContent += chunk.content;
          // Stream text content to the caller in real-time
          onStream({ content: chunk.content, done: false });
        }
        if (chunk.done) {
          finalToolCalls = chunk.toolCalls;
          finalUsage = chunk.usage;
        }
      },
      modelOverride,
      options,
    );

    // If no tool calls, we're done
    if (!finalToolCalls || finalToolCalls.length === 0) {
      onStream({ content: '', done: true, usage: finalUsage });
      return;
    }

    // Notify caller about tool calls (for UI indicators)
    onStream({ content: '', done: false, toolCalls: finalToolCalls });

    // Execute tool calls
    const toolResults = await options.onToolCall(finalToolCalls);

    // Append assistant message with tool calls + tool result messages to history
    const assistantToolMsg: Message = {
      id: `tool-assistant-${Date.now()}`,
      role: 'assistant',
      content: accumulatedContent,
      timestamp: Date.now(),
      toolCalls: finalToolCalls,
    };

    const toolResultMsgs: Message[] = toolResults.map((tr) => ({
      id: `tool-result-${Date.now()}-${tr.toolCallId}`,
      role: 'tool' as const,
      content: tr.content,
      timestamp: Date.now(),
      toolCallId: tr.toolCallId,
    }));

    currentMessages = [...currentMessages, assistantToolMsg, ...toolResultMsgs];
  }

  // Max iterations reached — send final done
  onStream({ content: '', done: true });
}
