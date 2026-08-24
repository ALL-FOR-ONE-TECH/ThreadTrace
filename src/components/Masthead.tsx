import React, { useState, useRef, useEffect } from 'react';
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
  Sparkles,
  HardDrive,
  FileCode,
  ChevronDown,
  X,
  FilePlus,
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
  isDemoActive?: boolean;
  onOpenExplorer?: () => void;
  onAutoRelayout: () => void;
  onExport: () => void;
  onExportDossier?: () => void;
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
  isDemoActive = false,
  onOpenExplorer,
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
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [repoPathInput, setRepoPathInput] = useState(repoWatch?.path || '');
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [titleInput, setTitleInput] = useState(title);
  const exportMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setTitleInput(title);
  }, [title]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (exportMenuRef.current && !exportMenuRef.current.contains(e.target as Node)) {
        setShowExportMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleRepoSubmit = (e: React.FormEvent) => {
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
        {/* Left: Brand Logo, Single-Line Title & Status */}
        <div className="masthead-brand-section">
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
                  if (e.key === 'Escape') setIsEditingTitle(false);
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
            <div
              className="board-title-wrapper clickable-title"
              onClick={() => setIsEditingTitle(true)}
              title="Click to rename investigation board"
            >
              <span className="board-title-text">{title}</span>
              <span className="blinking-cursor">_</span>
              <Edit2 size={11} className="title-edit-pencil" />
            </div>
          )}

          <div className="sys-status-badge" title={isTauri ? 'Native SQLite WAL Mode' : 'Local-first Web Mode'}>
            <span className="pulse-dot" />
            <span>{isTauri ? 'SQLITE: WAL' : 'WEB'}</span>
          </div>

          <div className="metric-pill-group">
            <div className="metric-pill" title="Total clue nodes on canvas">
              <span className="metric-label">CLUES</span>
              <span className="metric-value amber-glow">{nodeCount}</span>
            </div>
            <div className="metric-pill" title="Total Bézier thread connections">
              <span className="metric-label">LINKS</span>
              <span className="metric-value amber-glow">{linkCount}</span>
            </div>
          </div>

          <div className="tag-counts-cluster">
            {customTags.map((t) => {
              const count = tagCounts[t.id] || 0;
              const isSelected = selectedFilter === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => onSelectFilter(isSelected ? 'ALL' : (t.id as TagType))}
                  className={`tag-count-pill ${isSelected ? 'is-filter-active' : ''}`}
                  style={{
                    borderColor: isSelected ? t.color : `${t.color}50`,
                    backgroundColor: isSelected ? `${t.color}35` : `${t.color}15`,
                    color: t.color,
                  }}
                  title={`Filter by ${t.label} (click to toggle)`}
                >
                  {t.label}: {count}
                </button>
              );
            })}
          </div>
        </div>

        {/* Center: Search & Filter */}
        <div className="masthead-center-section">
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
                <X size={11} />
              </button>
            ) : (
              <span className="kbd-shortcut-badge">CTRL+K</span>
            )}
          </div>
        </div>

        {/* Right: Clean Action Toolbar */}
        <div className="masthead-actions-section">
          <button
            type="button"
            className="terminal-btn"
            onClick={onNewBoard}
            title="Start fresh investigation board"
          >
            <FilePlus size={13} />
            <span>NEW</span>
          </button>

          <button
            type="button"
            className="terminal-btn primary-btn add-clue-btn"
            onClick={onAddSnippet}
            title="Pin new clue card onto canvas (N)"
          >
            <Plus size={13} />
            <span>+ PIN CLUE</span>
          </button>


          <button
            type="button"
            className="terminal-btn explorer-btn"
            onClick={onOpenExplorer}
            title="Open Project File Tree & Code Slicer Explorer (E)"
          >
            <HardDrive size={13} />
            <span>EXPLORER</span>
          </button>

          <button
            type="button"
            className={`terminal-btn demo-btn ${isDemoActive ? 'is-active-demo' : ''}`}
            onClick={onLoadDemo}
            title={isDemoActive ? 'Revert demo back to your personal workspace' : 'Load sample auth race-condition case'}
          >
            <Sparkles size={13} />
            <span>{isDemoActive ? 'REVERT DEMO' : 'DEMO'}</span>
          </button>

          <button
            type="button"
            className="terminal-btn"
            onClick={onOpenTagManager}
            title="Manage Custom Tags & Palette (T)"
          >
            <Tag size={13} />
            <span>TAGS</span>
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

          {/* Export / Dossier Dropdown */}
          <div className="export-dropdown-wrapper" ref={exportMenuRef}>
            <button
              type="button"
              className="terminal-btn dropdown-trigger-btn"
              onClick={() => setShowExportMenu((p) => !p)}
              title="Export dossier or raw JSON data"
            >
              <Download size={13} />
              <span>DOSSIER</span>
              <ChevronDown size={11} />
            </button>

            {showExportMenu && (
              <div className="export-menu-popover">
                <button
                  type="button"
                  className="export-menu-item"
                  onClick={() => {
                    setShowExportMenu(false);
                    if (onExportHtmlDossier) onExportHtmlDossier();
                  }}
                >
                  <FileCode size={12} className="amber-glow-icon" />
                  <span>Offline HTML Dossier (.html)</span>
                </button>
                <button
                  type="button"
                  className="export-menu-item"
                  onClick={() => {
                    setShowExportMenu(false);
                    if (onExportDossier) onExportDossier();
                  }}
                >
                  <FileText size={12} />
                  <span>Markdown Report (.md)</span>
                </button>
                <button
                  type="button"
                  className="export-menu-item"
                  onClick={() => {
                    setShowExportMenu(false);
                    onExport();
                  }}
                >
                  <Download size={12} />
                  <span>Canvas JSON Backup (.json)</span>
                </button>
              </div>
            )}
          </div>

          <button
            type="button"
            className="terminal-btn icon-only-btn"
            onClick={onImport}
            title="Import canvas JSON backup"
          >
            <Upload size={13} />
          </button>

          <button
            type="button"
            className="terminal-btn icon-only-btn"
            onClick={() => setShowRepoModal(true)}
            title={`Git Context: ${repoWatch?.branch || 'None'}`}
          >
            <GitBranch size={13} />
          </button>

          <button
            type="button"
            className="terminal-btn icon-only-btn"
            onClick={onOpenShortcuts}
            title="Keyboard Shortcuts (?)"
          >
            <HelpCircle size={13} />
          </button>
        </div>
      </div>

      {/* Repo Modal */}
      {showRepoModal && (
        <div className="terminal-modal-overlay" onClick={() => setShowRepoModal(false)}>
          <div className="terminal-modal repo-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title">
                <GitBranch size={14} className="amber-glow-icon" />
                <span>[ATTACH_GIT_REPOSITORY_CONTEXT]</span>
              </div>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setShowRepoModal(false)}
              >
                <X size={14} />
              </button>
            </div>

            <form onSubmit={handleRepoSubmit}>
              <div className="modal-body">
                <p className="modal-desc">
                  Enter local absolute path to a Git repository. ThreadTrace will monitor HEAD commits and branch diffs for your evidence board.
                </p>
                <div className="form-group-col">
                  <label className="terminal-label">REPOSITORY PATH:</label>
                  <input
                    type="text"
                    className="terminal-input"
                    placeholder="e.g. X:/Code-Board or C:/projects/my-app"
                    value={repoPathInput}
                    onChange={(e) => setRepoPathInput(e.target.value)}
                    autoFocus
                  />
                </div>

                {repoWatch && (
                  <div className="repo-current-info-card">
                    <div className="info-row">
                      <span className="info-lbl">WATCHING:</span>
                      <span className="info-val">{repoWatch.path}</span>
                    </div>
                    <div className="info-row">
                      <span className="info-lbl">GIT STATUS:</span>
                      <span className={`info-val ${repoWatch.branch ? 'amber-glow' : ''}`}>
                        {repoWatch.branch ? 'CONNECTED' : 'LOCAL DIRECTORY (NO .GIT REPO)'}
                      </span>
                    </div>
                    <div className="info-row">
                      <span className="info-lbl">BRANCH:</span>
                      <span className="info-val amber-glow">{repoWatch.branch || 'None'}</span>
                    </div>
                    <div className="info-row">
                      <span className="info-lbl">LAST COMMIT:</span>
                      <span className="info-val">{repoWatch.last_commit || 'None (Initialize with git init)'}</span>
                    </div>
                  </div>
                )}

              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="terminal-btn"
                  onClick={() => setShowRepoModal(false)}
                >
                  CANCEL
                </button>
                <button type="submit" className="terminal-btn primary-btn">
                  WATCH REPOSITORY
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </header>
  );
};
