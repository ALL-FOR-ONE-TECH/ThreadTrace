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
export type VerificationStatus = 'CRASH' | 'INVESTIGATING' | 'VERIFIED';
export type LinkRelationType = 'CAUSES' | 'CALLS' | 'FIXES' | string;

export interface SnippetNode {
  id: number;
  session_id?: string | null;
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
  checklist?: string | null;
  verification_status?: VerificationStatus | string;
  confidence?: number;
  syncStatus?: NodeSyncStatus;
  created_at?: number;
  updated_at?: number;
}

export interface SnippetLink {
  id: number;
  session_id?: string | null;
  from_id: number;
  to_id: number;
  relation_type?: LinkRelationType;
  created_at?: number;
}

export interface Session {
  id: string;
  name: string;
  workspace: string;
  category?: string;
  status?: string;
  summary?: string;
  created_at: number;
  updated_at: number;
}

export interface SessionActivity {
  id?: number;
  session_id: string;
  actor: string;
  actor_id?: string;
  activity_type: string;
  title: string;
  payload: string;
  timestamp: number;
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
  session_id?: string | null;
  sessions?: Session[];
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

export interface DirEntryItem {
  name: string;
  path: string;
  is_dir: boolean;
  size_bytes: number;
}
