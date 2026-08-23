import React, { useState, useEffect, useMemo, useRef } from 'react';
import { TagType, CustomTag, DEFAULT_TAGS, DirEntryItem } from '../types/board';
import { TauriBridge } from '../services/tauriBridge';
import {
  Folder,
  FolderOpen,
  FileCode,
  ChevronRight,
  ChevronDown,
  HardDrive,
  Search,
  Plus,
  X,
  FileText,
  RefreshCw,
} from 'lucide-react';


interface Props {
  isOpen: boolean;
  onClose: () => void;
  currentRepoPath?: string | null;
  onWatchRepo: (path: string) => void;
  onPinClue: (data: {
    title: string;
    tag: TagType;
    code: string;
    notes: string;
    filePath: string;
    lineStart: number;
    lineEnd: number;
  }) => void;
  customTags?: CustomTag[];
}

export const ProjectExplorerDrawer: React.FC<Props> = ({
  isOpen,
  onClose,
  currentRepoPath,
  onWatchRepo,
  onPinClue,
  customTags = DEFAULT_TAGS,
}) => {
  const [drives, setDrives] = useState<string[]>([]);
  const [currentDir, setCurrentDir] = useState<string>(currentRepoPath || '.');
  const [dirEntries, setDirEntries] = useState<DirEntryItem[]>([]);
  const [expandedFolders, setExpandedFolders] = useState<Record<string, DirEntryItem[]>>({});
  const [searchFilter, setSearchFilter] = useState('');
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [fullFileContent, setFullFileContent] = useState<string>('');
  const [selectedSnippet, setSelectedSnippet] = useState<string>('');
  const [lineStart, setLineStart] = useState<number>(1);
  const [lineEnd, setLineEnd] = useState<number>(20);
  const [title, setTitle] = useState('');
  const [tag, setTag] = useState<TagType>('BUG');
  const [notes, setNotes] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const codePreRef = useRef<HTMLPreElement>(null);

  // Load system drives on mount
  useEffect(() => {
    TauriBridge.listSystemDrives().then((d) => setDrives(d));
  }, []);

  // Update currentDir if currentRepoPath changes
  useEffect(() => {
    if (currentRepoPath) {
      setCurrentDir(currentRepoPath);
    }
  }, [currentRepoPath]);

  // Load directory entries when currentDir changes
  useEffect(() => {
    if (!isOpen) return;
    setIsLoading(true);
    TauriBridge.readDirEntries(currentDir).then((entries) => {
      setDirEntries(entries);
      setIsLoading(false);
      onWatchRepo(currentDir);
    });
  }, [currentDir, isOpen, onWatchRepo]);

  // Load full file content when selectedFile changes
  useEffect(() => {
    if (!selectedFile) {
      setFullFileContent('');
      setSelectedSnippet('');
      return;
    }
    TauriBridge.readFileBacking(selectedFile, 1, 500).then((content) => {
      setFullFileContent(content);
      setSelectedSnippet(content);
      const basename = selectedFile.split(/[\\/]/).pop()?.toUpperCase() || 'SNIPPET';
      setTitle(`${basename}_L1_20`);
      setLineStart(1);
      const lines = content.split('\n');
      setLineEnd(Math.min(20, Math.max(1, lines.length)));
    });
  }, [selectedFile]);

  // Handle Mouse Selection directly inside the Code Viewer
  const handleMouseSelection = () => {
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed) return;

    const selectedText = selection.toString();
    if (selectedText.trim().length > 0) {
      setSelectedSnippet(selectedText);
      const selectedLineCount = selectedText.split('\n').length;
      if (selectedFile) {
        const basename = selectedFile.split(/[\\/]/).pop()?.toUpperCase() || 'SNIPPET';
        setTitle(`${basename}_SNIPPET`);
        setLineEnd(lineStart + selectedLineCount - 1);
      }
    }
  };

  const toggleFolder = async (folderPath: string) => {
    if (expandedFolders[folderPath]) {
      setExpandedFolders((prev) => {
        const copy = { ...prev };
        delete copy[folderPath];
        return copy;
      });
    } else {
      const subEntries = await TauriBridge.readDirEntries(folderPath);
      setExpandedFolders((prev) => ({ ...prev, [folderPath]: subEntries }));
    }
  };

  const handleOpenDrive = (drive: string) => {
    setCurrentDir(drive);
    setExpandedFolders({});
    setSelectedFile(null);
  };

  const handlePin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile) return;

    const snippetToPin = selectedSnippet || fullFileContent || '// Empty snippet';
    const fallbackTitle = selectedFile.split(/[\\/]/).pop()?.toUpperCase() || 'SNIPPET';

    onPinClue({
      title: title.trim() || `${fallbackTitle}_L${lineStart}_${lineEnd}`,
      tag,
      code: snippetToPin,
      notes: notes.trim(),
      filePath: selectedFile,
      lineStart,
      lineEnd,
    });
  };

  const filteredEntries = useMemo(() => {
    if (!searchFilter.trim()) return dirEntries;
    const q = searchFilter.toLowerCase();
    return dirEntries.filter((e) => e.name.toLowerCase().includes(q));
  }, [dirEntries, searchFilter]);

  if (!isOpen) return null;

  return (
    <aside className="project-explorer-drawer">
      <div className="drawer-header">
        <div className="drawer-title">
          <HardDrive size={14} className="amber-glow-icon" />
          <span>PROJECT FILE EXPLORER // SOURCE SLICER</span>
        </div>
        <button type="button" className="drawer-close-btn" onClick={onClose} title="Close Explorer (Esc)">
          <X size={14} />
        </button>
      </div>

      {/* Drive / Workspace Selector */}
      <div className="drive-selector-bar">
        <div className="drives-list">
          {drives.map((d) => (
            <button
              key={d}
              type="button"
              className={`drive-chip-btn ${currentDir.startsWith(d) ? 'is-active' : ''}`}
              onClick={() => handleOpenDrive(d)}
              title={`Explore Drive ${d}`}
            >
              <HardDrive size={11} />
              <span>{d}</span>
            </button>
          ))}
          {currentRepoPath && (
            <button
              type="button"
              className={`drive-chip-btn ${currentDir === currentRepoPath ? 'is-active' : ''}`}
              onClick={() => handleOpenDrive(currentRepoPath)}
              title="Open current workspace directory"
            >
              <FolderOpen size={11} />
              <span>WORKSPACE</span>
            </button>
          )}
        </div>

        <div className="path-input-row">
          <input
            type="text"
            className="terminal-input dir-path-input"
            value={currentDir}
            onChange={(e) => setCurrentDir(e.target.value)}
            placeholder="Enter directory path (e.g. C:/projects/my-app)..."
          />
          <button
            type="button"
            className="terminal-btn btn-xs"
            onClick={() => {
              TauriBridge.readDirEntries(currentDir).then((entries) => setDirEntries(entries));
            }}
            title="Refresh directory"
          >
            <RefreshCw size={11} />
          </button>
        </div>
      </div>

      {/* Search / Filter */}
      <div className="drawer-search-box">
        <Search size={12} className="search-bar-icon" />
        <input
          type="text"
          className="terminal-input drawer-search-input"
          placeholder="Filter files in directory..."
          value={searchFilter}
          onChange={(e) => setSearchFilter(e.target.value)}
        />
      </div>

      {/* Two Columns */}
      <div className="drawer-content-grid">
        {/* Left: Tree */}
        <div className="drawer-file-tree">
          {isLoading && <div className="tree-loading-notice">Loading directory...</div>}

          {filteredEntries.map((item) => (
            <div key={item.path} className="tree-entry-group">
              <div
                className={`tree-entry-row ${item.is_dir ? 'is-folder' : 'is-file'} ${
                  selectedFile === item.path ? 'is-selected-file' : ''
                }`}
                onClick={() => {
                  if (item.is_dir) toggleFolder(item.path);
                  else setSelectedFile(item.path);
                }}
              >
                {item.is_dir ? (
                  <>
                    {expandedFolders[item.path] ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                    <Folder size={12} className="tree-icon folder-icon" />
                  </>
                ) : (
                  <>
                    <span className="tree-spacer" />
                    <FileCode size={12} className="tree-icon file-icon" />
                  </>
                )}
                <span className="tree-item-name">{item.name}</span>
              </div>

              {/* Sub Folders */}
              {item.is_dir && expandedFolders[item.path] && (
                <div className="tree-sub-list">
                  {expandedFolders[item.path].map((sub) => (
                    <div
                      key={sub.path}
                      className={`tree-entry-row sub-row ${sub.is_dir ? 'is-folder' : 'is-file'} ${
                        selectedFile === sub.path ? 'is-selected-file' : ''
                      }`}
                      onClick={() => {
                        if (sub.is_dir) toggleFolder(sub.path);
                        else setSelectedFile(sub.path);
                      }}
                    >
                      {sub.is_dir ? (
                        <Folder size={11} className="tree-icon folder-icon" />
                      ) : (
                        <FileCode size={11} className="tree-icon file-icon" />
                      )}
                      <span className="tree-item-name">{sub.name}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Right: Code Slicer & Mouse Drag Selection */}
        <div className="drawer-slicer-pane">
          {selectedFile ? (
            <form onSubmit={handlePin} className="slicer-form">
              <div className="slicer-header-file">
                <FileCode size={13} className="amber-glow-icon" />
                <span className="slicer-filepath" title={selectedFile}>
                  {selectedFile}
                </span>
              </div>

              <div className="slicer-grid-fields">
                <div className="form-group-col">
                  <label className="terminal-label">CLUE TITLE:</label>
                  <input
                    type="text"
                    className="terminal-input"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Enter clue title..."
                    required
                  />
                </div>

                <div className="form-group-col">
                  <label className="terminal-label">TAG CLASSIFICATION:</label>
                  <select
                    className="terminal-select"
                    value={tag}
                    onChange={(e) => setTag(e.target.value as TagType)}
                  >
                    {customTags.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group-col">
                  <label className="terminal-label">LINE RANGE:</label>
                  <div className="line-range-inputs">
                    <input
                      type="number"
                      className="terminal-input range-box"
                      value={lineStart}
                      min={1}
                      onChange={(e) => setLineStart(Math.max(1, parseInt(e.target.value) || 1))}
                    />
                    <span className="range-sep">to</span>
                    <input
                      type="number"
                      className="terminal-input range-box"
                      value={lineEnd}
                      min={lineStart}
                      onChange={(e) => setLineEnd(Math.max(lineStart, parseInt(e.target.value) || lineStart))}
                    />
                  </div>
                </div>
              </div>

              <div className="form-group-col">
                <label className="terminal-label">
                  <FileText size={11} />
                  <span>INVESTIGATION NOTES / HYPOTHESIS:</span>
                </label>
                <textarea
                  className="terminal-input notes-textarea"
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Describe what this code proves, why the bug happens, or reproduction steps..."
                />
              </div>

              {/* Code Viewer with Live Mouse Selection */}
              <div className="slicer-preview-block">
                <div className="preview-block-header">
                  <span>SELECT CODE WITH MOUSE TO PIN SNIPPET:</span>
                  <span className="selection-hint">Highlight lines below ↴</span>
                </div>

                <pre
                  ref={codePreRef}
                  className="preview-code-box interactive-code-select"
                  onMouseUp={handleMouseSelection}
                  title="Highlight any lines with mouse to capture snippet"
                >
                  <code>{fullFileContent || '// Empty or binary file'}</code>
                </pre>
              </div>

              <button type="submit" className="terminal-btn primary-btn pin-submit-btn">
                <Plus size={14} />
                <span>+ INSERT SELECTION INTO BOARD</span>
              </button>
            </form>
          ) : (
            <div className="slicer-empty-prompt">
              <FileCode size={28} className="empty-icon" />
              <p>Select any source file on the left to slice code and pin evidence clues onto the board.</p>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
};
