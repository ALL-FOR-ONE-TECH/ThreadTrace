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
  Terminal,
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
      <div className="masthead-main-bar">
        {/* Left: Brand, Title, Status & Tag Badges */}
        <div className="masthead-title-group">
          <div className="masthead-title-row">
            <div className="app-logo-wrapper" title="ThreadTrace: Spatial Investigation Canvas">
              <img src={appLogo} alt="ThreadTrace Logo" className="app-logo-img" />
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
                <span className="blinking-cursor">_</span>
                <Edit2 size={12} className="title-edit-pencil" />
              </h1>
            )}

            <div className="sys-status-badge" title={isTauri ? 'Native SQLite WAL Mode' : 'Local-first Web Mode'}>
              <span className="pulse-dot" />
              <span>{isTauri ? 'SQLITE: WAL' : 'WEB PERSIST'}</span>
            </div>
          </div>

          <div className="masthead-meta-row">
            <div className="metric-pill">
              <span className="metric-label">CLUES</span>
              <span className="metric-value amber-glow">{nodeCount}</span>
            </div>
            <div className="metric-pill">
              <span className="metric-label">LINKS</span>
              <span className="metric-value amber-glow">{linkCount}</span>
            </div>
            <span className="meta-divider" />
            <div className="tag-counts-cluster">
              {customTags.map((t) => {
                const count = tagCounts[t.id] || 0;
                return (
                  <span
                    key={t.id}
                    className={`tag-count-pill tag-${t.id.toLowerCase()}`}
                    style={{
                      borderColor: `${t.color}66`,
                      backgroundColor: `${t.color}18`,
                      color: t.color,
                    }}
                  >
                    {t.label}: {count}
                  </span>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right: Search, Filter, and Action Buttons */}
        <div className="masthead-toolbar">
          <div
            className="search-bar-input-group"
            onClick={() => onOpenCommandPalette && onOpenCommandPalette()}
            title="Search clues or press Ctrl+K for Command Palette"
          >
            <Search size={13} className="search-bar-icon" />
            <input
              type="text"
              className="search-input"
              placeholder="Search clues / code ... (Ctrl+K)"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              onClick={(e) => e.stopPropagation()}
            />
            {searchQuery ? (
              <button
                type="button"
                className="search-clear-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  onSearchChange('');
                }}
                title="Clear search"
              >
                ×
              </button>
            ) : (
              <span className="kbd-shortcut-badge">CTRL+K</span>
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

          <div className="toolbar-btn-group">
            <button
              type="button"
              className="terminal-btn"
              onClick={onNewBoard}
              title="Start fresh new investigation (clears canvas)"
            >
              <FilePlus size={13} />
              <span>NEW</span>
            </button>

            <button
              type="button"
              className="terminal-btn"
              onClick={onLoadDemo}
              title="Load sample investigation case"
            >
              <Sparkles size={13} />
              <span>DEMO</span>
            </button>

            <button
              type="button"
              className="terminal-btn"
              onClick={onOpenTagManager}
              title="Manage Custom Tags & Color Palette (T)"
            >
              <Tag size={13} />
              <span>TAGS</span>
            </button>

            <button
              type="button"
              className="terminal-btn"
              onClick={() => setShowRepoModal(true)}
              title="Attach local git repository context"
            >
              <GitBranch size={13} />
              <span>REPO</span>
            </button>

            <button
              type="button"
              className="terminal-btn"
              onClick={onAutoRelayout}
              title="Auto-organize nodes into clean grid"
            >
              <LayoutGrid size={13} />
              <span>RELAYOUT</span>
            </button>

            <button
              type="button"
              className="terminal-btn"
              onClick={onOpenCommandPalette}
              title="Open Command Palette & Global Search (Ctrl+K or /)"
            >
              <Terminal size={13} />
              <span>PALETTE</span>
            </button>

            <button
              type="button"
              className="terminal-btn"
              onClick={onExportHtmlDossier}
              title="Export interactive offline HTML Dossier"
            >
              <FileCode size={13} />
              <span>HTML</span>
            </button>

            <button
              type="button"
              className="terminal-btn"
              onClick={onExportDossier}
              title="Export Markdown Investigation Dossier"
            >
              <FileText size={13} />
              <span>MD</span>
            </button>

            <button
              type="button"
              className="terminal-btn"
              onClick={onExport}
              title="Export raw JSON"
            >
              <Download size={13} />
              <span>JSON</span>
            </button>

            <button
              type="button"
              className="terminal-btn"
              onClick={onImport}
              title="Import JSON snapshot"
            >
              <Upload size={13} />
              <span>IMPORT</span>
            </button>

            <button
              type="button"
              className="terminal-btn icon-only"
              onClick={onOpenShortcuts}
              title="Keyboard shortcuts & cheatsheet (?)"
            >
              <HelpCircle size={14} />
            </button>
          </div>

          <button
            type="button"
            className="terminal-btn primary-btn add-clue-btn"
            onClick={onAddSnippet}
            title="Pin new clue node (N)"
          >
            <Plus size={15} />
            <span>PIN_CLUE (N)</span>
          </button>
        </div>
      </div>

      {repoWatch && (
        <div className="git-context-bar">
          <GitBranch size={12} className="git-bar-icon" />
          <span className="git-branch-tag">{repoWatch.branch || 'main'}</span>
          <span className="git-bar-sep">:</span>
          <span className="git-commit-text">{repoWatch.last_commit || 'Watching repository changes...'}</span>
          {repoWatch.diff_summary && (
            <span className="git-diff-badge">({repoWatch.diff_summary.trim()})</span>
          )}
        </div>
      )}

      {showRepoModal && (
        <div className="terminal-modal-overlay" onClick={() => setShowRepoModal(false)}>
          <div className="terminal-modal repo-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title">
                <GitBranch size={14} />
                <span>[ATTACH_LOCAL_REPOSITORY_CONTEXT]</span>
              </div>
            </div>
            <form onSubmit={handleAttachRepo} className="repo-form">
              <p className="modal-desc">
                Enter the path to a local Git repository to stream live commit info, diff
                summaries, and file slices directly into clue cards.
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
