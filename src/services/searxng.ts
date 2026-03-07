import { fetch } from 'expo/fetch';
import { SearxngConfig, SearchResult } from '../types';

const MAX_RESULTS = 5;

/**
 * Execute a search against a SearXNG instance.
 */
export async function searchSearxng(
  config: SearxngConfig,
  query: string,
): Promise<SearchResult[]> {
  const base = config.baseUrl.replace(/\/$/, '');

  switch (config.requestType) {
    case 'json_api':
      return searchJsonApi(base, query);
    case 'html_get':
      return searchHtmlGet(base, query);
    case 'html_post':
      return searchHtmlPost(base, query);
    default:
      throw new Error(`Unknown SearXNG request type: ${config.requestType}`);
  }
}

async function searchJsonApi(
  base: string,
  query: string,
): Promise<SearchResult[]> {
  const url = `${base}/search?q=${encodeURIComponent(query)}&format=json`;
  const response = await fetch(url, {
    method: 'GET',
    headers: { Accept: 'application/json' },
  });

  if (!response.ok) {
    throw new Error(`SearXNG JSON API returned HTTP ${response.status}`);
  }

  const data = await response.json();
  const results: any[] = data?.results ?? [];

  return results.slice(0, MAX_RESULTS).map((r) => ({
    title: r.title ?? '',
    url: r.url ?? '',
    content: r.content ?? '',
    engine: r.engine ?? r.engines?.[0] ?? 'unknown',
  }));
}

async function searchHtmlGet(
  base: string,
  query: string,
): Promise<SearchResult[]> {
  const url = `${base}/search?q=${encodeURIComponent(query)}`;
  const response = await fetch(url, {
    method: 'GET',
    headers: { Accept: 'text/html' },
  });

  if (!response.ok) {
    throw new Error(`SearXNG HTML GET returned HTTP ${response.status}`);
  }

  const html = await response.text();
  return parseHtmlResults(html);
}

async function searchHtmlPost(
  base: string,
  query: string,
): Promise<SearchResult[]> {
  const response = await fetch(`${base}/search`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'text/html',
    },
    body: `q=${encodeURIComponent(query)}`,
  });

  if (!response.ok) {
    throw new Error(`SearXNG HTML POST returned HTTP ${response.status}`);
  }

  const html = await response.text();
  return parseHtmlResults(html);
}

/**
 * Parse SearXNG HTML output using regex (no DOM parser in React Native).
 * SearXNG wraps each result in <article> tags with <h3><a href="...">title</a></h3>
 * and <p class="content">snippet</p>.
 */
function parseHtmlResults(html: string): SearchResult[] {
  const results: SearchResult[] = [];

  // Match <article> blocks
  const articleRegex = /<article[^>]*>([\s\S]*?)<\/article>/gi;
  let articleMatch: RegExpExecArray | null;

  while ((articleMatch = articleRegex.exec(html)) !== null && results.length < MAX_RESULTS) {
    const block = articleMatch[1];

    // Extract URL and title from <a href="...">title</a> inside <h3> or <h4>
    const linkMatch = /<h[34][^>]*>\s*<a[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/i.exec(block);
    const url = linkMatch?.[1] ?? '';
    const title = (linkMatch?.[2] ?? '').replaceAll(/<[^>]*>/g, '').trim();

    // Extract content snippet
    const contentMatch = /<p[^>]*class="[^"]*content[^"]*"[^>]*>([\s\S]*?)<\/p>/i.exec(block);
    let content = (contentMatch?.[1] ?? '').replaceAll(/<[^>]*>/g, '').trim();
    if (!content) {
      // Fallback: try first <p> inside article
      const fallbackP = /<p[^>]*>([\s\S]*?)<\/p>/i.exec(block);
      content = (fallbackP?.[1] ?? '').replaceAll(/<[^>]*>/g, '').trim();
    }

    // Extract engine name from data attributes or engine span
    const engineMatch = /class="[^"]*engine[^"]*"[^>]*>([\s\S]*?)<\//i.exec(block);
    const engine = (engineMatch?.[1] ?? 'unknown').replaceAll(/<[^>]*>/g, '').trim();

    if (url && title) {
      results.push({ title, url, content, engine });
    }
  }

  // Fallback: if no <article> tags found, try <div class="result"> blocks
  if (results.length === 0) {
    const divRegex = /<div[^>]*class="[^"]*result[^"]*"[^>]*>([\s\S]*?)<\/div>\s*(?=<div|<\/|$)/gi;
    let divMatch: RegExpExecArray | null;

    while ((divMatch = divRegex.exec(html)) !== null && results.length < MAX_RESULTS) {
      const block = divMatch[1];
      const linkMatch = /<a[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/i.exec(block);
      const url = linkMatch?.[1] ?? '';
      const title = (linkMatch?.[2] ?? '').replaceAll(/<[^>]*>/g, '').trim();
      const pMatch = /<p[^>]*>([\s\S]*?)<\/p>/i.exec(block);
      const content = (pMatch?.[1] ?? '').replaceAll(/<[^>]*>/g, '').trim();

      if (url && title) {
        results.push({ title, url, content, engine: 'unknown' });
      }
    }
  }

  return results;
}

/**
 * Validate a SearXNG configuration by running a test search.
 */
export async function validateSearxng(
  config: SearxngConfig,
): Promise<{ valid: boolean; error?: string }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10_000);

  try {
    const results = await searchSearxng(config, 'LLM Inference');

    if (results.length === 0) {
      return {
        valid: false,
        error: 'Server responded but no search results could be parsed. Check the request type setting.',
      };
    }

    // Verify at least one result has a URL and title
    const hasValidResult = results.some((r) => r.url && r.title);
    if (!hasValidResult) {
      return {
        valid: false,
        error: 'Results were returned but they are missing titles or URLs. The response format may be incompatible.',
      };
    }

    return { valid: true };
  } catch (err: any) {
    if (err?.name === 'AbortError') {
      return { valid: false, error: 'Request timed out — server not reachable.' };
    }
    return {
      valid: false,
      error: err?.message ?? 'Unknown error connecting to SearXNG server.',
    };
  } finally {
    clearTimeout(timer);
  }
}
