import { useState, useRef, useCallback } from 'react';
import { SnippetNode, SnippetLink } from '../types/board';

export interface BoardHistoryEntry {
  nodes: SnippetNode[];
  links: SnippetLink[];
  label: string;
  at: number;
}

const HISTORY_LIMIT = 40;
// Keystroke coalescing: typing/palette drags reuse the open transaction
// instead of pushing one snapshot per change event.
const COALESCE_WINDOW_MS = 1200;
const TRANSIENT_LABELS = new Set(['EDIT_CODE', 'EDIT_TEXT', 'MOVE', 'RESIZE']);

/**
 * useBoardHistory — bounded undo/redo with transaction coalescing.
 * Structural actions (ADD/DELETE/LINK/LAYOUT/IMPORT) always push;
 * transient streams (typing, drags) coalesce within a 1.2s window.
 */
export function useBoardHistory() {
  const [historyStack, setHistoryStack] = useState<BoardHistoryEntry[]>([]);
  const [redoStack, setRedoStack] = useState<BoardHistoryEntry[]>([]);
  const nodesRef = useRef<SnippetNode[]>([]);
  const linksRef = useRef<SnippetLink[]>([]);
  const lastPushRef = useRef<{ label: string; at: number } | null>(null);

  const syncRefs = useCallback((nodes: SnippetNode[], links: SnippetLink[]) => {
    nodesRef.current = nodes;
    linksRef.current = links;
  }, []);

  const pushHistory = useCallback(
    (curNodes: SnippetNode[], curLinks: SnippetLink[], label: string = 'EDIT') => {
      const now = Date.now();
      const last = lastPushRef.current;
      // Coalesce rapid transient edits into the previous entry.
      if (
        last &&
        TRANSIENT_LABELS.has(label) &&
        TRANSIENT_LABELS.has(last.label) &&
        now - last.at < COALESCE_WINDOW_MS &&
        label === last.label
      ) {
        lastPushRef.current = { label, at: now };
        return;
      }
      lastPushRef.current = { label, at: now };
      const entry: BoardHistoryEntry = { nodes: curNodes, links: curLinks, label, at: now };
      setHistoryStack((prev) => [...prev.slice(-(HISTORY_LIMIT - 1)), entry]);
      setRedoStack([]);
    },
    []
  );

  const undo = useCallback((): BoardHistoryEntry | null => {
    if (historyStack.length === 0) return null;
    const previous = historyStack[historyStack.length - 1];
    setRedoStack((prev) => [
      ...prev,
      { nodes: nodesRef.current, links: linksRef.current, label: 'REDO_BASE', at: Date.now() },
    ]);
    setHistoryStack((prev) => prev.slice(0, -1));
    lastPushRef.current = null;
    return previous;
  }, [historyStack]);

  const redo = useCallback((): BoardHistoryEntry | null => {
    if (redoStack.length === 0) return null;
    const next = redoStack[redoStack.length - 1];
    setHistoryStack((prev) => [
      ...prev.slice(-(HISTORY_LIMIT - 1)),
      { nodes: nodesRef.current, links: linksRef.current, label: 'UNDO_BASE', at: Date.now() },
    ]);
    setRedoStack((prev) => prev.slice(0, -1));
    lastPushRef.current = null;
    return next;
  }, [redoStack]);

  const clear = useCallback(() => {
    setHistoryStack([]);
    setRedoStack([]);
    lastPushRef.current = null;
  }, []);

  return {
    historyStack,
    redoStack,
    historyDepth: historyStack.length,
    redoDepth: redoStack.length,
    pushHistory,
    undo,
    redo,
    clearHistory: clear,
    syncHistoryRefs: syncRefs,
  };
}