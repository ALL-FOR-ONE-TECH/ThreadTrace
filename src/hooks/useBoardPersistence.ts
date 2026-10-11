import { useRef, useCallback } from 'react';
import { BoardData, SnippetNode, SnippetLink } from '../types/board';
import { TauriBridge } from '../services/tauriBridge';

/** JSON dossier schema version. Bump on breaking BoardData changes. */
export const BOARD_SCHEMA_VERSION = 3;

export interface VersionedBoardExport extends BoardData {
  schema_version: number;
  exported_at: string;
  app: string;
}

export function isVersionedBoardExport(v: unknown): v is VersionedBoardExport {
  if (typeof v !== 'object' || v === null) return false;
  const o = v as Record<string, unknown>;
  return Array.isArray(o['nodes']) && Array.isArray(o['links']);
}

export function normalizeImportedBoard(raw: unknown): { data: BoardData; warnings: string[] } {
  const warnings: string[] = [];
  const o = (raw ?? {}) as Record<string, unknown>;
  const schema = typeof o['schema_version'] === 'number' ? (o['schema_version'] as number) : 0;
  if (schema !== 0 && schema !== BOARD_SCHEMA_VERSION) {
    warnings.push(`Schema v${schema} imported into v${BOARD_SCHEMA_VERSION} reader — unknown fields preserved where possible.`);
  }
  const nodes = Array.isArray(o['nodes']) ? (o['nodes'] as SnippetNode[]) : [];
  const links = Array.isArray(o['links']) ? (o['links'] as SnippetLink[]) : [];
  const nodeIds = new Set(nodes.map((n) => n.id));
  const cleanLinks = links.filter((l) => {
    const ok = nodeIds.has(l.from_id) && nodeIds.has(l.to_id) && l.from_id !== l.to_id;
    if (!ok) warnings.push(`Dropped dangling link ${l.from_id}->${l.to_id}.`);
    return ok;
  });
  const cleanNodes: SnippetNode[] = nodes.map((n, i) => ({
    ...n,
    id: typeof n.id === 'number' ? n.id : Date.now() + i,
    title: String(n.title ?? 'UNTITLED_CLUE'),
    tag: String(n.tag ?? 'EVIDENCE'),
    mode: n.mode === 'write' ? 'write' : 'read',
    x: Number.isFinite(n.x) ? (n.x as number) : 100 + i * 40,
    y: Number.isFinite(n.y) ? (n.y as number) : 100 + i * 40,
  }));
  return {
    data: {
      title: typeof o['title'] === 'string' ? (o['title'] as string) : 'THREAD_TRACE // IMPORTED',
      custom_tags: Array.isArray(o['custom_tags']) ? (o['custom_tags'] as BoardData['custom_tags']) : undefined,
      nodes: cleanNodes,
      links: cleanLinks,
      repo_watch: (o['repo_watch'] as BoardData['repo_watch']) ?? null,
      session_id: (o['session_id'] as string | null) ?? null,
    },
    warnings,
  };
}

/**
 * useBoardPersistence — debounced Tauri save + versioned JSON export/import.
 * Debounce (700ms) collapses keystroke streams into one `save_node_cmd` burst.
 */
export function useBoardPersistence() {
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const persistNodeDebounced = useCallback((node: SnippetNode, delayMs = 700) => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      TauriBridge.saveNode(node).catch((e) => console.warn('persist node failed', e));
    }, delayMs);
  }, []);

  const persistAllNow = useCallback(async (nodes: SnippetNode[]) => {
    if (saveTimer.current) {
      clearTimeout(saveTimer.current);
      saveTimer.current = null;
    }
    for (const n of nodes) {
      try {
        await TauriBridge.saveNode(n);
      } catch (e) {
        console.warn('persist-all node failed', n.id, e);
      }
    }
  }, []);

  const exportVersionedJson = useCallback((data: BoardData) => {
    const payload: VersionedBoardExport = {
      ...data,
      schema_version: BOARD_SCHEMA_VERSION,
      exported_at: new Date().toISOString(),
      app: 'ThreadTrace',
    };
    return JSON.stringify(payload, null, 2);
  }, []);

  return { persistNodeDebounced, persistAllNow, exportVersionedJson };
}
