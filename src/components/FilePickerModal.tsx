import React, { useState, useEffect, useMemo } from 'react';
import { TagType, CustomTag, DEFAULT_TAGS } from '../types/board';
import { TauriBridge } from '../services/tauriBridge';
import { Folder, FileCode, Check, Search, AlertCircle, FileText } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onPinClue: (clueData: {
    title: string;
    tag: TagType;
    code: string;
    notes: string;
    filePath: string;
    lineStart: number;
    lineEnd: number;
  }) => void;
  repoPath?: string | null;
  customTags?: CustomTag[];
}

export const FilePickerModal: React.FC<Props> = ({
  isOpen,
  onClose,
  onPinClue,
  repoPath = '.',
  customTags = DEFAULT_TAGS,
}) => {
  const [fileList, setFileList] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFile, setSelectedFile] = useState<string>('');
  const [lineStart, setLineStart] = useState<number>(1);
  const [lineEnd, setLineEnd] = useState<number>(20);
  const [title, setTitle] = useState('');
  const [tag, setTag] = useState<TagType>('BUG');
  const [notes, setNotes] = useState('');
  const [previewContent, setPreviewContent] = useState<string>('');
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    TauriBridge.listRepoFiles(repoPath || '.').then((files) => {
      setFileList(files);
      if (files.length > 0 && !selectedFile) {
        setSelectedFile(files[0]);
      }
    });
  }, [isOpen, repoPath, selectedFile]);

  // Load preview when selectedFile or line range changes
  useEffect(() => {
    if (!selectedFile) {
      setPreviewContent('');
      return;
    }
    setIsLoadingPreview(true);
    TauriBridge.readFileBacking(selectedFile, lineStart, lineEnd).then((content) => {
      setPreviewContent(content);
      setIsLoadingPreview(false);
      if (!title) {
        const basename = selectedFile.split(/[\\/]/).pop()?.toUpperCase() || 'SNIPPET';
        setTitle(`${basename}_L${lineStart}_${lineEnd}`);
      }
    });
  }, [selectedFile, lineStart, lineEnd]);

  const filteredFiles = useMemo(() => {
    if (!searchQuery.trim()) return fileList;
    const q = searchQuery.toLowerCase();
    return fileList.filter((f) => f.toLowerCase().includes(q));
  }, [fileList, searchQuery]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile) return;

    onPinClue({
      title: title.trim() || `${selectedFile.split(/[\\/]/).pop()?.toUpperCase()}_L${lineStart}_${lineEnd}`,
      tag,
      code: previewContent,
      notes: notes.trim(),
      filePath: selectedFile,
      lineStart,
      lineEnd,
    });
    onClose();
  };

  return (
    <div className="terminal-modal-overlay" onClick={onClose}>
      <div className="terminal-modal file-picker-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title">
            <Folder size={14} className="amber-glow-icon" />
            <span>[ATTACH_SOURCE_CODE_CLUE]</span>
          </div>
          <button type="button" className="modal-close-btn" onClick={onClose}>
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit} className="file-picker-body">
          <div className="file-picker-columns">
            {/* Left: File Browser */}
            <div className="file-browser-pane">
              <div className="browser-search-box">
                <Search size={12} className="search-bar-icon" />
                <input
                  type="text"
                  className="terminal-input browser-search-input"
                  placeholder="Filter project files..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  autoFocus
                />
              </div>

              <div className="file-items-list">
                {filteredFiles.map((file) => (
                  <div
                    key={file}
                    className={`file-item-row ${selectedFile === file ? 'is-selected' : ''}`}
                    onClick={() => setSelectedFile(file)}
                  >
                    <FileCode size={12} className="file-icon" />
                    <span className="file-item-path">{file}</span>
                  </div>
                ))}
                {filteredFiles.length === 0 && (
                  <div className="file-empty-notice">
                    <AlertCircle size={12} />
                    <span>No matching files found</span>
                  </div>
                )}
              </div>
            </div>

            {/* Right: Slicer, Notes, and Live Preview */}
            <div className="file-config-pane">
              <div className="form-group-row">
                <label className="terminal-label">CLUE TITLE:</label>
                <input
                  type="text"
                  className="terminal-input"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. AUTH_TOKEN_RACE_MUTEX"
                />
              </div>

              <div className="slice-inputs-grid">
                <div className="form-group-col">
                  <label className="terminal-label">TAG TYPE:</label>
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
                  rows={3}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Describe what this code proves, why the bug happens, or resolution thoughts..."
                />
              </div>

              <div className="file-preview-block">
                <div className="preview-block-header">
                  <span>LIVE CODE SLICE PREVIEW:</span>
                  {isLoadingPreview && <span className="preview-loading">Loading...</span>}
                </div>
                <pre className="preview-code-box">
                  <code>{previewContent || '// Empty or file slice loading...'}</code>
                </pre>
              </div>
            </div>
          </div>

          <div className="modal-footer">
            <button type="button" className="terminal-btn" onClick={onClose}>
              CANCEL
            </button>
            <button type="submit" className="terminal-btn primary-btn" disabled={!selectedFile}>
              <Check size={13} />
              <span>PIN CLUE TO BOARD</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
