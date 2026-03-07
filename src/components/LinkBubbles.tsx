import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  StyleSheet,
  Linking,
  ActivityIndicator,
  Modal,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../constants';
import { LinkMeta } from '../types';

interface InternalLink extends LinkMeta {
  loaded: boolean;
}

/** Module-level cache so fetched metadata survives collapse/expand and re-renders. */
const metaCache = new Map<string, { title: string; favicon: string }>();

const URL_REGEX = /https?:\/\/[^\s)\]>,"'`]+/g;

export function extractUrls(text: string): string[] {
  const matches = text.match(URL_REGEX);
  if (!matches) return [];
  const seen = new Set<string>();
  return matches
    .map((u) => u.replace(/[.),:;!?]+$/, ''))
    .filter((u) => {
      if (seen.has(u)) return false;
      seen.add(u);
      return true;
    });
}

function faviconUrl(pageUrl: string): string {
  try {
    const { hostname } = new URL(pageUrl);
    return `https://www.google.com/s2/favicons?sz=32&domain=${hostname}`;
  } catch {
    return '';
  }
}

function domainLabel(pageUrl: string): string {
  try {
    return new URL(pageUrl).hostname.replace(/^www\./, '');
  } catch {
    return pageUrl;
  }
}

async function fetchTitle(url: string): Promise<string> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'Mozilla/5.0' },
    });
    clearTimeout(timeout);
    const html = await res.text();
    const match = /<title[^>]*>([^<]+)<\/title>/i.exec(html);
    return match ? match[1].trim() : domainLabel(url);
  } catch {
    return domainLabel(url);
  }
}

interface Props {
  readonly content: string;
  readonly references?: LinkMeta[];
  readonly onReferencesLoaded?: (refs: LinkMeta[]) => void;
}

export default function LinkBubbles({ content, references, onReferencesLoaded }: Props) {
  const urls = extractUrls(content);
  const [visible, setVisible] = useState(false);
  const [links, setLinks] = useState<InternalLink[]>([]);
  const hasNotifiedRef = useRef(false);

  const handlePress = useCallback((url: string) => {
    Linking.openURL(url);
  }, []);

  // Build a lookup from persisted references
  const refMap = useRef(new Map<string, LinkMeta>());
  useEffect(() => {
    refMap.current.clear();
    if (references) {
      for (const r of references) {
        refMap.current.set(r.url, r);
      }
    }
  }, [references]);

  // Initialize link list whenever content changes
  useEffect(() => {
    if (urls.length === 0) return;
    hasNotifiedRef.current = false;

    setLinks(
      urls.map((url) => {
        // Priority: in-memory cache > persisted references > domain fallback
        const cached = metaCache.get(url);
        const persisted = refMap.current.get(url);
        if (cached) {
          return { url, title: cached.title, favicon: cached.favicon, loaded: true };
        }
        if (persisted) {
          metaCache.set(url, { title: persisted.title, favicon: persisted.favicon });
          return { url, title: persisted.title, favicon: persisted.favicon, loaded: true };
        }
        return {
          url,
          title: domainLabel(url),
          favicon: faviconUrl(url),
          loaded: false,
        };
      }),
    );
  }, [content]);

  // Fetch titles when modal is opened
  useEffect(() => {
    if (!visible) return;
    let cancelled = false;

    const loadTitles = async () => {
      const updated = [...links];
      let anyFetched = false;

      for (let i = 0; i < updated.length; i++) {
        if (cancelled || updated[i].loaded) continue;
        const url = updated[i].url;
        const title = await fetchTitle(url);
        if (cancelled) return;
        const favicon = updated[i].favicon;
        metaCache.set(url, { title, favicon });
        updated[i] = { ...updated[i], title, loaded: true };
        anyFetched = true;
        setLinks([...updated]);
      }

      // Notify parent to persist once all are loaded
      if (anyFetched && !hasNotifiedRef.current && onReferencesLoaded) {
        hasNotifiedRef.current = true;
        onReferencesLoaded(
          updated.map(({ url, title, favicon }) => ({ url, title, favicon })),
        );
      }
    };
    loadTitles();

    return () => {
      cancelled = true;
    };
  }, [visible]);

  if (urls.length === 0) return null;

  return (
    <>
      <TouchableOpacity
        style={[styles.triggerButton, { width: Math.min(links.length, 4) * 10 + 24 }]}
        onPress={() => setVisible(true)}
        activeOpacity={0.6}
      >
        <View style={[styles.faviconStack, { width: Math.min(links.length, 4) * 10 + 16 }]}>
          {links.slice(0, 4).map((link, i) => (
            <Image
              key={link.url}
              source={{ uri: link.favicon }}
              style={[styles.stackedFavicon, { left: i * 10, zIndex: 4 - i }]}
              resizeMode="contain"
            />
          ))}
        </View>
      </TouchableOpacity>

      <Modal
        visible={visible}
        transparent
        animationType="fade"
        onRequestClose={() => setVisible(false)}
      >
        <TouchableOpacity
          style={styles.backdrop}
          activeOpacity={1}
          onPress={() => setVisible(false)}
        >
          <TouchableOpacity activeOpacity={1} style={styles.panel}>
            <View style={styles.panelHeader}>
              <Text style={styles.panelTitle}>
                References{' '}
                <Text style={styles.panelCount}>· {urls.length}</Text>
              </Text>
              <TouchableOpacity onPress={() => setVisible(false)} activeOpacity={0.6}>
                <Ionicons name="close" size={22} color={COLORS.textMuted} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.panelBody} showsVerticalScrollIndicator={false}>
              {links.map((link) => (
                <TouchableOpacity
                  key={link.url}
                  style={styles.linkRow}
                  onPress={() => handlePress(link.url)}
                  activeOpacity={0.7}
                >
                  {link.favicon ? (
                    <Image
                      source={{ uri: link.favicon }}
                      style={styles.favicon}
                      resizeMode="contain"
                    />
                  ) : (
                    <View style={styles.faviconPlaceholder} />
                  )}
                  <View style={styles.linkTextWrap}>
                    <Text style={styles.linkTitle} numberOfLines={1}>
                      {link.loaded ? link.title : domainLabel(link.url)}
                    </Text>
                    <Text style={styles.linkDomain} numberOfLines={1}>
                      {domainLabel(link.url)}
                    </Text>
                    <Text style={styles.linkUrl} numberOfLines={1}>
                      {link.url}
                    </Text>
                  </View>
                  {!link.loaded ? (
                    <ActivityIndicator size="small" color={COLORS.textMuted} />
                  ) : (
                    <Ionicons name="open-outline" size={16} color={COLORS.textMuted} />
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  triggerButton: {
    alignItems: 'center',
    justifyContent: 'center',
    height: 40,
    borderRadius: 10,
    backgroundColor: COLORS.surface,
    paddingHorizontal: 4,
  },
  faviconStack: {
    flexDirection: 'row',
    height: 20,
    position: 'relative',
  },
  stackedFavicon: {
    width: 20,
    height: 20,
    borderRadius: 5,
    position: 'absolute',
    borderWidth: 1.5,
    borderColor: COLORS.surface,
    backgroundColor: COLORS.white,
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  panel: {
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '70%',
    paddingBottom: 32,
  },
  panelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.border,
  },
  panelTitle: {
    color: COLORS.text,
    fontSize: 17,
    fontWeight: '700',
  },
  panelCount: {
    color: COLORS.textMuted,
    fontWeight: '400',
  },
  panelBody: {
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surfaceLight,
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginTop: 8,
  },
  favicon: {
    width: 28,
    height: 28,
    borderRadius: 6,
    marginRight: 12,
    backgroundColor: COLORS.white,
  },
  faviconPlaceholder: {
    width: 28,
    height: 28,
    borderRadius: 6,
    marginRight: 12,
    backgroundColor: COLORS.border,
  },
  linkTextWrap: {
    flex: 1,
    marginRight: 8,
  },
  linkTitle: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: '600',
  },
  linkDomain: {
    color: COLORS.textSecondary,
    fontSize: 12,
    marginTop: 2,
  },
  linkUrl: {
    color: COLORS.textMuted,
    fontSize: 11,
    marginTop: 1,
  },
});
