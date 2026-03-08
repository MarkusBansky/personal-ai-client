import { fetch } from 'expo/fetch';
import { TavilyConfig, SearchResult } from '../types';

const MAX_RESULTS = 5;

/**
 * Execute a search against the Tavily Search API.
 */
export async function searchTavily(
  config: TavilyConfig,
  query: string,
): Promise<SearchResult[]> {
  const response = await fetch('https://api.tavily.com/search', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      api_key: config.apiKey,
      query,
      max_results: MAX_RESULTS,
      include_answer: false,
    }),
  });

  if (!response.ok) {
    throw new Error(`Tavily API returned HTTP ${response.status}`);
  }

  const data = await response.json();
  const results: any[] = data?.results ?? [];

  return results.slice(0, MAX_RESULTS).map((r) => ({
    title: r.title ?? '',
    url: r.url ?? '',
    content: r.content ?? '',
    engine: 'tavily',
  }));
}

/**
 * Validate Tavily configuration by running a test search.
 */
export async function validateTavily(
  config: TavilyConfig,
): Promise<{ valid: boolean; error?: string }> {
  try {
    const results = await searchTavily(config, 'LLM Inference');

    if (results.length === 0) {
      return {
        valid: false,
        error: 'Server responded but no search results were returned.',
      };
    }

    return { valid: true };
  } catch (err: any) {
    return {
      valid: false,
      error: err?.message ?? 'Unknown error connecting to Tavily API.',
    };
  }
}
