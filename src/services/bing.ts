import { fetch } from 'expo/fetch';
import { BingConfig, SearchResult } from '../types';

const MAX_RESULTS = 5;

/**
 * Execute a search against the Bing Web Search API.
 */
export async function searchBing(
  config: BingConfig,
  query: string,
): Promise<SearchResult[]> {
  const url = `https://api.bing.microsoft.com/v7.0/search?q=${encodeURIComponent(query)}&count=${MAX_RESULTS}`;
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Ocp-Apim-Subscription-Key': config.apiKey,
    },
  });

  if (!response.ok) {
    throw new Error(`Bing API returned HTTP ${response.status}`);
  }

  const data = await response.json();
  const results: any[] = data?.webPages?.value ?? [];

  return results.slice(0, MAX_RESULTS).map((r) => ({
    title: r.name ?? '',
    url: r.url ?? '',
    content: r.snippet ?? '',
    engine: 'bing',
  }));
}

/**
 * Validate Bing configuration by running a test search.
 */
export async function validateBing(
  config: BingConfig,
): Promise<{ valid: boolean; error?: string }> {
  try {
    const results = await searchBing(config, 'LLM Inference');

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
      error: err?.message ?? 'Unknown error connecting to Bing API.',
    };
  }
}
