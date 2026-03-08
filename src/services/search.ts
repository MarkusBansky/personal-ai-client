import { WebSearchConfig, SearchResult } from '../types';
import { searchSearxng, validateSearxng } from './searxng';
import { searchTavily, validateTavily } from './tavily';
import { searchExa, validateExa } from './exa';
import { searchBing, validateBing } from './bing';

/**
 * Execute a web search using the currently active search provider.
 */
export async function webSearch(
  config: WebSearchConfig,
  query: string,
): Promise<SearchResult[]> {
  if (!config.enabled) {
    throw new Error('Web search is disabled.');
  }

  switch (config.activeProvider) {
    case 'searxng': {
      if (!config.searxng) throw new Error('SearXNG is not configured.');
      return searchSearxng(config.searxng, query);
    }
    case 'tavily': {
      if (!config.tavily) throw new Error('Tavily is not configured.');
      return searchTavily(config.tavily, query);
    }
    case 'exa': {
      if (!config.exa) throw new Error('Exa is not configured.');
      return searchExa(config.exa, query);
    }
    case 'bing': {
      if (!config.bing) throw new Error('Bing is not configured.');
      return searchBing(config.bing, query);
    }
    default:
      throw new Error(`Unknown search provider: ${config.activeProvider}`);
  }
}

/**
 * Validate the active search provider configuration.
 */
export async function validateWebSearch(
  config: WebSearchConfig,
): Promise<{ valid: boolean; error?: string }> {
  switch (config.activeProvider) {
    case 'searxng': {
      if (!config.searxng) return { valid: false, error: 'SearXNG is not configured.' };
      return validateSearxng(config.searxng);
    }
    case 'tavily': {
      if (!config.tavily) return { valid: false, error: 'Tavily is not configured.' };
      return validateTavily(config.tavily);
    }
    case 'exa': {
      if (!config.exa) return { valid: false, error: 'Exa is not configured.' };
      return validateExa(config.exa);
    }
    case 'bing': {
      if (!config.bing) return { valid: false, error: 'Bing is not configured.' };
      return validateBing(config.bing);
    }
    default:
      return { valid: false, error: `Unknown search provider: ${config.activeProvider}` };
  }
}
