import { invoke } from '@tauri-apps/api/core';
import { BoardData, SnippetNode, RepoWatchInfo, CustomTag, DEFAULT_TAGS, ProcessTelemetry } from '../types/board';

export function isTauriEnv(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

const STORAGE_KEY = 'THREAD_TRACE_DATA_V3';

export const INITIAL_BLANK_DATA: BoardData = {
  title: 'THREAD_TRACE // NEW_INVESTIGATION',
  custom_tags: DEFAULT_TAGS,
  nodes: [],
  links: [],
  repo_watch: null,
};

export const DEMO_INVESTIGATION_DATA: BoardData = {
  title: 'THREAD_TRACE // AUTH_INVESTIGATION',
  custom_tags: DEFAULT_TAGS,
  nodes: [
    {
      id: 1,
      x: 60,
      y: 90,
      title: 'BUG_AUTH_TOKEN_RACE',
      tag: 'BUG',
      mode: 'read',
      code: '// RACE CONDITION: Concurrent requests trigger multiple refresh cycles\nasync function handleExpiredSession() {\n  const refreshResponse = await api.post("/auth/refresh");\n  localStorage.setItem("auth_jwt", refreshResponse.token);\n  return refreshResponse.token;\n}',
      file_path: 'src/services/auth.ts',
      line_start: 42,
      line_end: 48,
      created_at: Date.now() - 3600000,
      updated_at: Date.now() - 3600000,
    },
    {
      id: 2,
      x: 460,
      y: 180,
      title: 'FIX_INFLIGHT_REFRESH_MUTEX',
      tag: 'FIX',
      mode: 'read',
      code: '// RESOLUTION: Singleton in-flight promise lock\nlet inflightRefreshPromise: Promise<string> | null = null;\n\nexport async function getSessionToken(): Promise<string> {\n  if (inflightRefreshPromise) return inflightRefreshPromise;\n  inflightRefreshPromise = api.post("/auth/refresh")\n    .then(res => res.data.token)\n    .finally(() => { inflightRefreshPromise = null; });\n  return inflightRefreshPromise;\n}',
      file_path: 'src/services/auth.ts',
      line_start: 50,
      line_end: 62,
      created_at: Date.now() - 1800000,
      updated_at: Date.now() - 1800000,
    },
    {
      id: 3,
      x: 860,
      y: 110,
      title: 'EVIDENCE_PROD_LOG_BURST',
      tag: 'EVIDENCE',
      mode: 'read',
      code: '[2026-08-23 12:30:01] ERROR 401: Token expired mid-transaction\n[2026-08-23 12:30:01] POST /auth/refresh -> 200 (req_id: #8921)\n[2026-08-23 12:30:01] POST /auth/refresh -> 409 (req_id: #8922 - Token revoked)\n[2026-08-23 12:30:02] Client forced logout on socket disconnect',
      file_path: 'logs/prod-audit.log',
      line_start: 1,
      line_end: 4,
      created_at: Date.now() - 900000,
      updated_at: Date.now() - 900000,
    }
  ],
  links: [
    { id: 1, from_id: 1, to_id: 2, created_at: Date.now() - 1800000 },
    { id: 2, from_id: 1, to_id: 3, created_at: Date.now() - 900000 }
  ],
  repo_watch: {
    path: '.',
    branch: 'main',
    last_commit: '8b91a2c: fix(auth): mutex wrap token refresh (10m ago)',
    diff_summary: ' 2 files changed, 18 insertions(+), 4 deletions(-)',
    is_watching: true,
  }
};

function getLocalData(): BoardData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(INITIAL_BLANK_DATA));
      return INITIAL_BLANK_DATA;
    }
    const parsed = JSON.parse(raw);
    if (!parsed.custom_tags || parsed.custom_tags.length === 0) {
      parsed.custom_tags = DEFAULT_TAGS;
    }
    if (!parsed.title) {
      parsed.title = 'THREAD_TRACE // NEW_INVESTIGATION';
    }
    if (!Array.isArray(parsed.nodes)) {
      parsed.nodes = [];
    }
    if (!Array.isArray(parsed.links)) {
      parsed.links = [];
    }
    return parsed;
  } catch {
    return INITIAL_BLANK_DATA;
  }
}

function saveLocalData(data: BoardData) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (err) {
    console.error('Failed to save to localStorage', err);
  }
}

export const TauriBridge = {
  async fetchBoardData(): Promise<BoardData> {
    if (isTauriEnv()) {
      try {
        const board = await invoke<BoardData>('get_board_state');
        const local = getLocalData();
        return {
          title: board.title || local.title || 'THREAD_TRACE // NEW_INVESTIGATION',
          custom_tags: local.custom_tags && local.custom_tags.length > 0 ? local.custom_tags : DEFAULT_TAGS,
          nodes: board.nodes || [],
          links: board.links || [],
          repo_watch: board.repo_watch || local.repo_watch,
        };
      } catch (err) {
        console.warn('Tauri get_board_state failed, falling back to LocalStorage', err);
      }
    }
    return getLocalData();
  },

  async saveBoardTitle(title: string): Promise<void> {
    const current = getLocalData();
    current.title = title;
    saveLocalData(current);
  },

  async saveCustomTags(tags: CustomTag[]): Promise<void> {
    const current = getLocalData();
    current.custom_tags = tags;
    saveLocalData(current);
  },

  async saveNode(node: SnippetNode): Promise<number> {
    if (isTauriEnv()) {
      try {
        const id = await invoke<number>('save_node_cmd', { node });
        node.id = id;
        return id;
      } catch (err) {
        console.warn('Tauri save_node_cmd failed, updating local state', err);
      }
    }
    const current = getLocalData();
    if (node.id === 0) {
      node.id = Date.now();
      current.nodes.push(node);
    } else {
      const idx = current.nodes.findIndex((n) => n.id === node.id);
      if (idx !== -1) current.nodes[idx] = node;
      else current.nodes.push(node);
    }
    saveLocalData(current);
    return node.id;
  },

  async deleteNode(id: number): Promise<void> {
    if (isTauriEnv()) {
      try {
        await invoke('delete_node_cmd', { id });
      } catch (err) {
        console.warn('Tauri delete_node_cmd failed', err);
      }
    }
    const current = getLocalData();
    current.nodes = current.nodes.filter((n) => n.id !== id);
    current.links = current.links.filter((l) => l.from_id !== id && l.to_id !== id);
    saveLocalData(current);
  },

  async addLink(fromId: number, toId: number): Promise<number> {
    if (isTauriEnv()) {
      try {
        return await invoke<number>('add_link_cmd', { fromId, toId });
      } catch (err) {
        console.warn('Tauri add_link_cmd failed', err);
      }
    }
    const current = getLocalData();
    const existing = current.links.find(
      (l) => (l.from_id === fromId && l.to_id === toId) || (l.from_id === toId && l.to_id === fromId)
    );
    if (!existing) {
      const newId = Date.now();
      current.links.push({ id: newId, from_id: fromId, to_id: toId });
      saveLocalData(current);
      return newId;
    }
    return existing.id;
  },

  async deleteLinkBetween(fromId: number, toId: number): Promise<void> {
    if (isTauriEnv()) {
      try {
        await invoke('delete_link_between_cmd', { fromId, toId });
      } catch (err) {
        console.warn('Tauri delete_link_between_cmd failed', err);
      }
    }
    const current = getLocalData();
    current.links = current.links.filter(
      (l) => !((l.from_id === fromId && l.to_id === toId) || (l.from_id === toId && l.to_id === fromId))
    );
    saveLocalData(current);
  },

  async clearBoard(): Promise<BoardData> {
    if (isTauriEnv()) {
      try {
        await invoke('clear_board_cmd');
      } catch (err) {
        console.warn('Tauri clear_board_cmd failed', err);
      }
    }
    const blank: BoardData = {
      title: 'THREAD_TRACE // NEW_INVESTIGATION',
      custom_tags: DEFAULT_TAGS,
      nodes: [],
      links: [],
      repo_watch: null,
    };
    saveLocalData(blank);
    return blank;
  },

  async loadDemoData(): Promise<BoardData> {
    if (isTauriEnv()) {
      try {
        await invoke('clear_board_cmd');
        for (const n of DEMO_INVESTIGATION_DATA.nodes) {
          await invoke('save_node_cmd', { node: n });
        }
        for (const l of DEMO_INVESTIGATION_DATA.links) {
          await invoke('add_link_cmd', { fromId: l.from_id, toId: l.to_id });
        }
        const refreshed = await invoke<BoardData>('get_board_state');
        saveLocalData({
          title: DEMO_INVESTIGATION_DATA.title,
          custom_tags: DEFAULT_TAGS,
          nodes: refreshed.nodes || DEMO_INVESTIGATION_DATA.nodes,
          links: refreshed.links || DEMO_INVESTIGATION_DATA.links,
          repo_watch: DEMO_INVESTIGATION_DATA.repo_watch,
        });
        return {
          title: DEMO_INVESTIGATION_DATA.title,
          custom_tags: DEFAULT_TAGS,
          nodes: refreshed.nodes || DEMO_INVESTIGATION_DATA.nodes,
          links: refreshed.links || DEMO_INVESTIGATION_DATA.links,
          repo_watch: DEMO_INVESTIGATION_DATA.repo_watch,
        };
      } catch (err) {
        console.warn('Tauri demo load failed, saving locally', err);
      }
    }
    saveLocalData(DEMO_INVESTIGATION_DATA);
    return DEMO_INVESTIGATION_DATA;
  },

  async readFileBacking(filePath: string, lineStart?: number, lineEnd?: number): Promise<string> {
    if (isTauriEnv()) {
      try {
        const resp = await invoke<{ content: string; exists: boolean; error?: string }>('read_file_snippet_cmd', {
          filePath,
          lineStart: lineStart ?? null,
          lineEnd: lineEnd ?? null,
        });
        if (resp && resp.content) {
          return resp.content;
        }
      } catch (err) {
        console.warn('Tauri read_file_snippet_cmd failed', err);
      }
    }
    return `// [LOCAL READ ONLY FALLBACK]\n// File backing: ${filePath}\n// Lines: ${lineStart ?? 1} - ${lineEnd ?? 50}\nfunction previewSnippet() {\n  console.log('Viewing local file reference');\n};`;
  },

  async watchRepo(path: string): Promise<RepoWatchInfo> {
    if (isTauriEnv()) {
      try {
        return await invoke<RepoWatchInfo>('watch_repo_cmd', { repoPath: path });
      } catch (err) {
        console.warn('Tauri watch_repo_cmd failed', err);
      }
    }
    const info: RepoWatchInfo = {
      path,
      branch: 'main',
      last_commit: '8b91a2c: fix(auth): mutex wrap token refresh (10m ago)',
      diff_summary: ' 2 files changed, 18 insertions(+), 4 deletions(-)',
      is_watching: true,
    };
    const current = getLocalData();
    current.repo_watch = info;
    saveLocalData(current);
    return info;
  },

  async exportBoard(): Promise<string> {
    if (isTauriEnv()) {
      try {
        return await invoke<string>('export_board_cmd');
      } catch (err) {
        console.warn('Tauri export_board_cmd failed', err);
      }
    }
    const data = await this.fetchBoardData();
    return JSON.stringify(data, null, 2);
  },

  async importBoard(json: string): Promise<BoardData> {
    if (isTauriEnv()) {
      try {
        const board = await invoke<BoardData>('import_board_cmd', { jsonContent: json });
        saveLocalData(board);
        return board;
      } catch (err) {
        console.warn('Tauri import_board_cmd failed', err);
      }
    }
    const parsed = JSON.parse(json) as BoardData;
    saveLocalData(parsed);
    return parsed;
  },

  async getProcessTelemetry(): Promise<ProcessTelemetry> {
    if (isTauriEnv()) {
      try {
        return await invoke<ProcessTelemetry>('get_process_telemetry_cmd');
      } catch (err) {
        console.warn('Tauri get_process_telemetry_cmd failed', err);
      }
    }
    return {
      pid: 1042,
      physical_memory_mb: 18.5,
      virtual_memory_mb: 32.0,
      thread_count: 4,
      uptime_seconds: Math.floor(performance.now() / 1000),
    };
  },
};

