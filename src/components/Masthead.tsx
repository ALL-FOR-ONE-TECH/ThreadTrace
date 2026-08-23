import React, { useState } from 'react';
import { TagType, RepoWatchInfo, CustomTag, DEFAULT_TAGS } from '../types/board';
import appLogo from '../assets/logo.png';
import {
  Plus,
  GitBranch,
  Search,
  Download,
  Upload,
  LayoutGrid,
  FileText,
  HelpCircle,
  Tag,
  Edit2,
  Check,
  FilePlus,
  Sparkles,
  FileCode,
  Terminal
} from 'lucide-react';


interface Props {
  title?: string;
  onTitleChange?: (newTitle: string) => void;
  nodeCount: number;
  linkCount: number;
  tagCounts: Record<string, number>;
  selectedFilter: TagType | 'ALL';
  onSelectFilter: (tag: TagType | 'ALL') => void;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  onAddSnippet: () => void;
  onNewBoard: () => void;
  onLoadDemo: () => void;
  onAutoRelayout: () => void;
  onExport: () => void;
  onExportDossier: () => void;
  onExportHtmlDossier?: () => void;
  onOpenCommandPalette?: () => void;
  onImport: () => void;
  onOpenShortcuts: () => void;
  onOpenTagManager?: () => void;
  customTags?: CustomTag[];
  repoWatch: RepoWatchInfo | null;
  onWatchRepo: (path: string) => void;
  isTauri: boolean;
}

export const Masthead: React.FC<Props> = ({
  title = 'THREAD_TRACE // NEW_INVESTIGATION',
  onTitleChange,
  nodeCount,
  linkCount,
  tagCounts,
  selectedFilter,
  onSelectFilter,
  searchQuery,
  onSearchChange,
  onAddSnippet,
  onNewBoard,
  onLoadDemo,
  onAutoRelayout,
  onExport,
  onExportDossier,
  onExportHtmlDossier,
  onOpenCommandPalette,
  onImport,
  onOpenShortcuts,
  onOpenTagManager,
  customTags = DEFAULT_TAGS,
  repoWatch,
  onWatchRepo,
  isTauri,
}) => {

  const [showRepoModal, setShowRepoModal] = useState(false);
  const [repoPathInput, setRepoPathInput] = useState(repoWatch?.path || '');
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [titleInput, setTitleInput] = useState(title);

  const handleAttachRepo = (e: React.FormEvent) => {
    e.preventDefault();
    if (repoPathInput.trim()) {
      onWatchRepo(repoPathInput.trim());
      setShowRepoModal(false);
    }
  };

  const handleFinishEditTitle = () => {
    setIsEditingTitle(false);
    const clean = titleInput.trim().toUpperCase() || 'THREAD_TRACE // NEW_INVESTIGATION';
    setTitleInput(clean);
    if (onTitleChange) onTitleChange(clean);
  };

  return (
    <header className="board-masthead">
      {/* Circuit diagram ASCII banner */}
      <pre className="ascii-circuit-banner" aria-hidden="true">{`┌──[0x01:BUG]──┐        ┌──[0x02:EVIDENCE]──┐
│ AUTH_RACE    ├───────►│ PROD_LOGS_409     │
└───┬──────────┘        └───┬───────────────┘
    ▼                       ▼
┌──[0x03:FIX]───────────────┴───────────────┐
│ INFLIGHT_MUTEX_QUEUE_DEDUPLICATION        │
└───────────────────────────────────────────┘`}</pre>

      <div className="masthead-main-bar">
        <div className="masthead-title-group">
          <div className="masthead-title-row">
            <div className="app-logo-wrapper" title="THREAD_TRACE // Terminal Investigation Canvas">
              <img
                src={appLogo}
                alt="ThreadTrace Logo"
                className="app-logo-img"
              />
            </div>

            {isEditingTitle ? (
              <div className="title-edit-form">
                <input
                  type="text"
                  className="terminal-input title-inline-input"
                  value={titleInput}
                  onChange={(e) => setTitleInput(e.target.value)}
                  onBlur={handleFinishEditTitle}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleFinishEditTitle();
                  }}
                  autoFocus
                />
                <button
                  type="button"
                  className="title-confirm-btn"
                  onClick={handleFinishEditTitle}
                >
                  <Check size={12} />
                </button>
              </div>
            ) : (
              <h1
                className="board-title clickable-title"
                onClick={() => setIsEditingTitle(true)}
                title="Click to rename investigation board"
              >
                {title}
                <Edit2 size={12} className="title-edit-pencil" />
              </h1>
            )}

            <div className="sys-status-badge" title={isTauri ? 'Native SQLite DB' : 'Local-first fallback'}>
              <span className="pulse-dot" />
              <span>{isTauri ? 'SYS: TAURI + SQLITE' : 'SYS: WEB + PERSIST'}</span>
            </div>
          </div>

          <div className="masthead-meta-row">
            <span className="meta-item">
              NODES: <strong className="amber-glow">{nodeCount}</strong>
            </span>
            <span className="meta-sep">·</span>
            <span className="meta-item">
              LINKS: <strong className="amber-glow">{linkCount}</strong>
            </span>
            <span className="meta-sep">·</span>
            <div className="tag-counts-cluster">
              {customTags.map((t) => {
                const count = tagCounts[t.id] || 0;
                return (
                  <span
                    key={t.id}
                    className={`tag-count-pill tag-${t.id.toLowerCase()}`}
                    style={{
                      borderColor: `${t.color}60`,
                      backgroundColor: `${t.color}15`,
                      color: t.color,
                    }}
                  >
                    {t.label}:{count}
                  </span>
                );
              })}
            </div>
          </div>
        </div>

        <div className="masthead-toolbar">
          <div className="search-bar-input-group">
            <Search size={12} className="search-bar-icon" />
            <input
              type="text"
              className="search-input"
              placeholder="Search clues / code ..."
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
            />
            {searchQuery && (
              <button
                className="search-clear-btn"
                onClick={() => onSearchChange('')}
                title="Clear search"
              >
                ×
              </button>
            )}
          </div>

          <div className="filter-dropdown-wrapper">
            <select
              className="terminal-select"
              value={selectedFilter}
              onChange={(e) => onSelectFilter(e.target.value as TagType | 'ALL')}
            >
              <option value="ALL">ALL TAGS ({nodeCount})</option>
              {customTags.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label} ({tagCounts[t.id] || 0})
                </option>
              ))}
            </select>
          </div>

          <button
            type="button"
            className="terminal-btn"
            onClick={onNewBoard}
            title="Start fresh new investigation (clears board)"
          >
            <FilePlus size={12} />
            <span>NEW</span>
          </button>

          <button
            type="button"
            className="terminal-btn"
            onClick={onLoadDemo}
            title="Load sample case investigation clues"
          >
            <Sparkles size={12} />
            <span>DEMO</span>
          </button>

          <button
            type="button"
            className="terminal-btn"
            onClick={onOpenTagManager}
            title="Open Custom Tag Engine & Color Palette Manager (T)"
          >
            <Tag size={12} />
            <span>TAGS</span>
          </button>

          <button
            type="button"
            className="terminal-btn"
            onClick={() => setShowRepoModal(true)}
            title="Attach local git repository context"
          >
            <GitBranch size={12} />
            <span>REPO</span>
          </button>

          <button
            type="button"
            className="terminal-btn"
            onClick={onAutoRelayout}
            title="Auto-organize nodes into non-overlapping grid"
          >
            <LayoutGrid size={12} />
            <span>RELAYOUT</span>
          </button>

          <button
            type="button"
            className="terminal-btn"
            onClick={onOpenCommandPalette}
            title="Open Command Palette & Global Search (Ctrl+K or /)"
          >
            <Terminal size={12} />
            <span>PALETTE</span>
          </button>

          <button
            type="button"
            className="terminal-btn"
            onClick={onExportHtmlDossier}
            title="Export interactive offline HTML Investigation Report"
          >
            <FileCode size={12} />
            <span>HTML</span>
          </button>

          <button
            type="button"
            className="terminal-btn"
            onClick={onExportDossier}
            title="Export Markdown Investigation Dossier with Mermaid flowchart"
          >
            <FileText size={12} />
            <span>MD</span>
          </button>


          <button
            type="button"
            className="terminal-btn"
            onClick={onExport}
            title="Export snapshot as JSON"
          >
            <Download size={12} />
            <span>JSON</span>
          </button>

          <button
            type="button"
            className="terminal-btn"
            onClick={onImport}
            title="Import snapshot JSON file"
          >
            <Upload size={12} />
            <span>IMPORT</span>
          </button>

          <button
            type="button"
            className="terminal-btn icon-only"
            onClick={onOpenShortcuts}
            title="Keyboard shortcuts & terminal guide (?)"
          >
            <HelpCircle size={13} />
          </button>

          <button
            type="button"
            className="terminal-btn primary-btn add-btn"
            onClick={onAddSnippet}
            title="Add new code snippet card (N)"
          >
            <Plus size={14} />
            <span>ADD_SNIPPET</span>
          </button>
        </div>
      </div>

      {repoWatch && (
        <div className="git-context-bar">
          <span className="git-icon">⑂</span>
          <span className="git-branch">{repoWatch.branch || 'main'}</span>
          <span className="git-sep">:</span>
          <span className="git-commit">{repoWatch.last_commit || 'Watching repository changes...'}</span>
          {repoWatch.diff_summary && (
            <span className="git-diff-summary">({repoWatch.diff_summary.trim()})</span>
          )}
        </div>
      )}

      {showRepoModal && (
        <div className="shortcuts-modal-backdrop" onClick={() => setShowRepoModal(false)}>
          <div className="shortcuts-modal repo-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title">
                <GitBranch size={14} />
                <span>[ATTACH_LOCAL_REPOSITORY_CONTEXT]</span>
              </div>
            </div>
            <form onSubmit={handleAttachRepo} className="repo-form">
              <p className="modal-desc">
                Enter the absolute or relative path to a local Git repository to stream live commit info, diff
                summaries, and file contents.
              </p>
              <input
                type="text"
                className="terminal-input repo-path-input"
                value={repoPathInput}
                onChange={(e) => setRepoPathInput(e.target.value)}
                placeholder="C:/projects/my-app or /home/user/project"
                autoFocus
              />
              <div className="modal-footer">
                <button
                  type="button"
                  className="terminal-btn"
                  onClick={() => setShowRepoModal(false)}
                >
                  CANCEL
                </button>
                <button type="submit" className="terminal-btn primary-btn">
                  ATTACH REPOSITORY
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </header>
  );
};
