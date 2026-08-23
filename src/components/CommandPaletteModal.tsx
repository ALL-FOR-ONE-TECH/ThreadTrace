import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Search,
  Plus,
  Sparkles,
  Trash2,
  LayoutGrid,
  FileCode,
  FileText,
  Download,
  Tag,
  HelpCircle,
  FolderSearch,
  Check,
} from 'lucide-react';
import { SnippetNode, TagType } from '../types/board';

interface Props {
  nodes: SnippetNode[];
  onSelectNode: (node: SnippetNode) => void;
  onAddSnippet: () => void;
  onLoadDemo: () => void;
  onClearBoard: () => void;
  onAutoRelayout: () => void;
  onExportHtml: () => void;
  onExportMarkdown: () => void;
  onExportJson: () => void;
  onOpenTagManager: () => void;
  onOpenShortcuts: () => void;
  onSetFilter: (filter: TagType | 'ALL') => void;
  onClose: () => void;
}

interface PaletteAction {
  id: string;
  title: string;
  category: 'ACTION' | 'FILTER' | 'NODE';
  icon: React.ReactNode;
  shortcut?: string;
  run: () => void;
}

export const CommandPaletteModal: React.FC<Props> = ({
  nodes,
  onSelectNode,
  onAddSnippet,
  onLoadDemo,
  onClearBoard,
  onAutoRelayout,
  onExportHtml,
  onExportMarkdown,
  onExportJson,
  onOpenTagManager,
  onOpenShortcuts,
  onSetFilter,
  onClose,
}) => {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const allActions: PaletteAction[] = useMemo(() => {
    const baseActions: PaletteAction[] = [
      {
        id: 'add-clue',
        title: 'Pin New Clue Node',
        category: 'ACTION',
        icon: <Plus size={14} />,
        shortcut: 'N',
        run: () => {
          onAddSnippet();
          onClose();
        },
      },
      {
        id: 'load-demo',
        title: 'Load Demo Investigation Case',
        category: 'ACTION',
        icon: <Sparkles size={14} />,
        run: () => {
          onLoadDemo();
          onClose();
        },
      },
      {
        id: 'clear-board',
        title: 'Clear Investigation Canvas',
        category: 'ACTION',
        icon: <Trash2 size={14} />,
        run: () => {
          onClearBoard();
          onClose();
        },
      },
      {
        id: 'auto-relayout',
        title: 'Auto-Relayout Clue Grid',
        category: 'ACTION',
        icon: <LayoutGrid size={14} />,
        run: () => {
          onAutoRelayout();
          onClose();
        },
      },
      {
        id: 'export-html',
        title: 'Export Interactive HTML Dossier',
        category: 'ACTION',
        icon: <FileCode size={14} />,
        run: () => {
          onExportHtml();
          onClose();
        },
      },
      {
        id: 'export-md',
        title: 'Export Markdown Investigation Dossier',
        category: 'ACTION',
        icon: <FileText size={14} />,
        run: () => {
          onExportMarkdown();
          onClose();
        },
      },
      {
        id: 'export-json',
        title: 'Export Raw Canvas JSON',
        category: 'ACTION',
        icon: <Download size={14} />,
        run: () => {
          onExportJson();
          onClose();
        },
      },
      {
        id: 'tag-manager',
        title: 'Manage Custom Phosphor Tags',
        category: 'ACTION',
        icon: <Tag size={14} />,
        shortcut: 'T',
        run: () => {
          onOpenTagManager();
          onClose();
        },
      },
      {
        id: 'shortcuts',
        title: 'Open Keyboard Shortcuts Cheatsheet',
        category: 'ACTION',
        icon: <HelpCircle size={14} />,
        shortcut: '?',
        run: () => {
          onOpenShortcuts();
          onClose();
        },
      },
      {
        id: 'filter-all',
        title: 'Show All Clues',
        category: 'FILTER',
        icon: <Check size={14} />,
        shortcut: '0',
        run: () => {
          onSetFilter('ALL');
          onClose();
        },
      },
      {
        id: 'filter-bug',
        title: 'Filter by BUG Tags',
        category: 'FILTER',
        icon: <Check size={14} />,
        shortcut: '1',
        run: () => {
          onSetFilter('BUG');
          onClose();
        },
      },
      {
        id: 'filter-task',
        title: 'Filter by TASK Tags',
        category: 'FILTER',
        icon: <Check size={14} />,
        shortcut: '2',
        run: () => {
          onSetFilter('TASK');
          onClose();
        },
      },
      {
        id: 'filter-fix',
        title: 'Filter by FIX Tags',
        category: 'FILTER',
        icon: <Check size={14} />,
        shortcut: '3',
        run: () => {
          onSetFilter('FIX');
          onClose();
        },
      },
      {
        id: 'filter-evidence',
        title: 'Filter by EVIDENCE Tags',
        category: 'FILTER',
        icon: <Check size={14} />,
        shortcut: '4',
        run: () => {
          onSetFilter('EVIDENCE');
          onClose();
        },
      },
    ];

    const nodeActions: PaletteAction[] = nodes.map((n) => ({
      id: `node-${n.id}`,
      title: `Jump to: [${n.tag}] ${n.title} ${n.file_path ? `(${n.file_path})` : ''}`,
      category: 'NODE',
      icon: <FolderSearch size={14} />,
      run: () => {
        onSelectNode(n);
        onClose();
      },
    }));

    return [...nodeActions, ...baseActions];
  }, [
    nodes,
    onSelectNode,
    onAddSnippet,
    onLoadDemo,
    onClearBoard,
    onAutoRelayout,
    onExportHtml,
    onExportMarkdown,
    onExportJson,
    onOpenTagManager,
    onOpenShortcuts,
    onSetFilter,
    onClose,
  ]);

  const filtered = useMemo(() => {
    if (!query.trim()) return allActions;
    const q = query.toLowerCase();
    return allActions.filter(
      (a) => a.title.toLowerCase().includes(q) || a.category.toLowerCase().includes(q)
    );
  }, [allActions, query]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % Math.max(1, filtered.length));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev - 1 + filtered.length) % Math.max(1, filtered.length));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filtered[selectedIndex]) {
        filtered[selectedIndex].run();
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    }
  };

  return (
    <div className="terminal-modal-overlay" onClick={onClose}>
      <div
        className="terminal-modal command-palette-modal"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        <div className="palette-search-box">
          <Search size={16} className="palette-search-icon" />
          <input
            ref={inputRef}
            type="text"
            className="palette-search-input"
            placeholder="Type a command, search clues, or jump to file... (ESC to close)"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <span className="palette-badge">ESC</span>
        </div>

        <div className="palette-results-list">
          {filtered.length === 0 ? (
            <div className="palette-empty-state">
              <span>No matching clues or commands found.</span>
            </div>
          ) : (
            filtered.map((action, idx) => (
              <div
                key={action.id}
                className={`palette-item ${idx === selectedIndex ? 'is-selected' : ''}`}
                onClick={action.run}
                onMouseEnter={() => setSelectedIndex(idx)}
              >
                <span className="palette-item-icon">{action.icon}</span>
                <div className="palette-item-content">
                  <span className="palette-item-title">{action.title}</span>
                  <span className="palette-item-category">{action.category}</span>
                </div>
                {action.shortcut && (
                  <span className="palette-item-shortcut">{action.shortcut}</span>
                )}
              </div>
            ))
          )}
        </div>

        <div className="palette-footer-hint">
          <span>↑/↓ to navigate</span>
          <span>↵ to select</span>
          <span>ESC to dismiss</span>
        </div>
      </div>
    </div>
  );
};
