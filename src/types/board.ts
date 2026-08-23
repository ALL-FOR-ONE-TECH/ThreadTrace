export type TagType = 'BUG' | 'TASK' | 'FIX' | 'EVIDENCE' | string;

export interface CustomTag {
  id: string;
  label: string;
  color: string;
  sub?: string;
  isCustom?: boolean;
}

export const DEFAULT_TAGS: CustomTag[] = [
  { id: 'BUG', label: 'BUG', color: '#ff4d4f', sub: 'CRITICAL' },
  { id: 'TASK', label: 'TASK', color: '#ffb000', sub: 'TODO' },
  { id: 'FIX', label: 'FIX', color: '#00e676', sub: 'PATCH' },
  { id: 'EVIDENCE', label: 'EVIDENCE', color: '#2979ff', sub: 'PROOF' },
];

export type NodeSyncStatus = 'SYNCED' | 'MODIFIED' | 'DETACHED';

export interface SnippetNode {
  id: number;
  x: number;
  y: number;
  width?: number;
  height?: number;
  title: string;
  tag: TagType;
  mode: 'read' | 'write';
  code: string | null;
  notes?: string | null;
  file_path: string | null;
  line_start: number | null;
  line_end: number | null;
  syncStatus?: NodeSyncStatus;
  created_at?: number;
  updated_at?: number;
}

export interface SnippetLink {
  id: number;
  from_id: number;
  to_id: number;
  created_at?: number;
}

export interface RepoWatchInfo {
  path: string;
  branch?: string;
  last_commit?: string;
  diff_summary?: string;
  is_watching?: boolean;
}

export interface ProcessTelemetry {
  pid: number;
  physical_memory_mb: number;
  virtual_memory_mb: number;
  thread_count: number;
  uptime_seconds: number;
}

export interface SystemTelemetry {
  totalMemoryMb: number;
  jsHeapMb: number;
  fps: number;
  activeEditors: number;
  totalCards: number;
  totalLinks: number;
  domNodes: number;
  history: number[];
}

export interface BoardData {
  title?: string;
  custom_tags?: CustomTag[];
  nodes: SnippetNode[];
  links: SnippetLink[];
  repo_watch?: RepoWatchInfo | null;
}

export interface DraggingState {
  id: number;
  offsetX: number;
  offsetY: number;
}

export interface ResizingState {
  id: number;
  initialWidth: number;
  initialHeight: number;
  initialMouseX: number;
  initialMouseY: number;
}
