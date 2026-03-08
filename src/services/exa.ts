import { fetch } from 'expo/fetch';
import { ExaConfig, SearchResult } from '../types';

const MAX_RESULTS = 5;

/**
 * Execute a search against the Exa.ai Search API.
 */
export async function searchExa(
  config: ExaConfig,
  query: string,
): Promise<SearchResult[]> {
  const response = await fetch('https://api.exa.ai/search', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': config.apiKey,
    },
    body: JSON.stringify({
      query,
      numResults: MAX_RESULTS,
      contents: {
        text: { maxCharacters: 500 },
      },
    }),
  });

  if (!response.ok) {
    throw new Error(`Exa API returned HTTP ${response.status}`);
  }

  const data = await response.json();
  const results: any[] = data?.results ?? [];

  return results.slice(0, MAX_RESULTS).map((r) => ({
    title: r.title ?? '',
    url: r.url ?? '',
    content: r.text ?? r.highlight ?? '',
    engine: 'exa',
  }));
}

/**
 * Validate Exa configuration by running a test search.
 */
export async function validateExa(
  config: ExaConfig,
): Promise<{ valid: boolean; error?: string }> {
  try {
    const results = await searchExa(config, 'LLM Inference');

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
      error: err?.message ?? 'Unknown error connecting to Exa API.',
    };
  }
}
