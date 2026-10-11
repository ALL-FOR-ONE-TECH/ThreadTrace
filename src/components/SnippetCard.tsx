import React, { useState } from 'react';
import { SnippetNode, TagType, CustomTag, DEFAULT_TAGS, VerificationStatus } from '../types/board';
import { StaticCodeViewer } from '../editor/StaticCodeViewer';
import { CodeMirrorLazyEditor } from '../editor/CodeMirrorLazyEditor';
import { TauriBridge } from '../services/tauriBridge';
import {
  Link2,
  Trash2,
  FileCode,
  GripVertical,
  FileText,
  Save,
  RotateCcw,
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  CheckSquare,
  Square,
  Activity,
  CheckCircle2,
  AlertOctagon,
  Percent,
} from 'lucide-react';

interface Props {
  node: SnippetNode;
  isArmed: boolean;
  isDragging: boolean;
  isDimmed?: boolean;
  isHighlighted?: boolean;
  onMouseDownHeader: (e: React.MouseEvent, id: number) => void;
  onMouseDownResize?: (e: React.MouseEvent, id: number) => void;
  onUpdateNode: (node: SnippetNode) => void;
  onDeleteNode: (id: number) => void;
  onToggleLink: (id: number) => void;
  customTags?: CustomTag[];
  onOpenTagManager?: () => void;
}

export const SnippetCard: React.FC<Props> = ({
  node,
  isArmed,
  isDragging,
  isDimmed = false,
  isHighlighted = false,
  onMouseDownHeader,
  onMouseDownResize,
  onUpdateNode,
  onDeleteNode,
  onToggleLink,
  customTags = DEFAULT_TAGS,
  onOpenTagManager,
}) => {
  const [isEditingFilePath, setIsEditingFilePath] = useState(false);
  const [filePathInput, setFilePathInput] = useState(node.file_path || '');
  const [lineRangeInput, setLineRangeInput] = useState(
    node.line_start && node.line_end ? `${node.line_start}-${node.line_end}` : ''
  );
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);
  const [showNotes, setShowNotes] = useState(false);
  const [isEditingNotesRaw, setIsEditingNotesRaw] = useState(false);
  const [isApplyingSource, setIsApplyingSource] = useState(false);
  const [applySuccessMsg, setApplySuccessMsg] = useState<string | null>(null);

  const cardWidth = node.width || 360;
  const cardHeight = node.height || 280;

  const currentTagObj = customTags.find((t) => t.id === node.tag) || {
    id: node.tag,
    label: node.tag,
    color: '#ffb000',
  };

  const verificationStatus: VerificationStatus =
    (node.verification_status as VerificationStatus) || 'INVESTIGATING';

  const handleModeToggle = () => {
    const nextMode = node.mode === 'read' ? 'write' : 'read';
    onUpdateNode({ ...node, mode: nextMode });
  };

  const handleCycleVerification = (e: React.MouseEvent) => {
    e.stopPropagation();
    const nextStatus: VerificationStatus =
      verificationStatus === 'CRASH'
        ? 'INVESTIGATING'
        : verificationStatus === 'INVESTIGATING'
        ? 'VERIFIED'
        : 'CRASH';
    onUpdateNode({ ...node, verification_status: nextStatus });
  };

  const handleTagChange = (newTag: TagType) => {
    if (newTag === '__NEW_TAG__') {
      if (onOpenTagManager) onOpenTagManager();
      return;
    }
    onUpdateNode({ ...node, tag: newTag });
  };

  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onUpdateNode({ ...node, title: e.target.value });
  };

  const handleCodeChange = (newCode: string) => {
    onUpdateNode({
      ...node,
      code: newCode,
      syncStatus: node.file_path ? 'MODIFIED' : 'DETACHED',
    });
  };

  const handleNotesChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    if (node.checklist !== undefined && node.checklist !== null) {
      onUpdateNode({ ...node, checklist: val });
    } else {
      onUpdateNode({ ...node, notes: val });
    }
  };

  // Interactive Markdown Checklist toggling
  const fullNotesText = node.notes || '';
  const hasMarkdownChecklist = /- \[[ xX]\]/.test(fullNotesText) || (node.checklist && /- \[[ xX]\]/.test(node.checklist));

  const toggleChecklistItem = (lineIdx: number) => {
    const targetSource = node.checklist || node.notes || '';
    const lines = targetSource.split('\n');
    if (lineIdx < 0 || lineIdx >= lines.length) return;

    const line = lines[lineIdx];
    if (line.includes('- [ ]')) {
      lines[lineIdx] = line.replace('- [ ]', '- [x]');
    } else if (line.includes('- [x]')) {
      lines[lineIdx] = line.replace('- [x]', '- [ ]');
    } else if (line.includes('- [X]')) {
      lines[lineIdx] = line.replace('- [X]', '- [ ]');
    }

    const updated = lines.join('\n');
    if (node.checklist) {
      onUpdateNode({ ...node, checklist: updated });
    } else {
      onUpdateNode({ ...node, notes: updated });
    }
  };

  const handleAttachFile = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanPath = filePathInput.trim();
    if (!cleanPath) {
      onUpdateNode({
        ...node,
        file_path: null,
        line_start: null,
        line_end: null,
        syncStatus: 'DETACHED',
      });
      setIsEditingFilePath(false);
      return;
    }

    let start: number | null = null;
    let end: number | null = null;
    if (lineRangeInput.trim()) {
      const parts = lineRangeInput.split('-').map((p) => parseInt(p.trim(), 10));
      if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
        start = parts[0];
        end = parts[1];
      }
    }

    const content = await TauriBridge.readFileBacking(cleanPath, start || undefined, end || undefined);
    onUpdateNode({
      ...node,
      file_path: cleanPath,
      line_start: start,
      line_end: end,
      code: content,
      syncStatus: 'SYNCED',
    });
    setIsEditingFilePath(false);
  };

  const handleRevertFromSource = async () => {
    if (!node.file_path) return;
    const content = await TauriBridge.readFileBacking(
      node.file_path,
      node.line_start || undefined,
      node.line_end || undefined
    );
    onUpdateNode({
      ...node,
      code: content,
      syncStatus: 'SYNCED',
    });
    setApplySuccessMsg('Reverted to disk');
    setTimeout(() => setApplySuccessMsg(null), 2000);
  };

  const handleApplyToSource = async () => {
    if (!node.file_path || !node.code) return;
    const confirmed = window.confirm(
      `Apply edits in "${node.title}" directly to source file on disk?\nTarget: ${node.file_path} (Lines ${node.line_start || 1}-${node.line_end || 'end'})`
    );
    if (!confirmed) return;

    setIsApplyingSource(true);
    try {
      await TauriBridge.writeFileSnippet(
        node.file_path,
        node.line_start || 1,
        node.line_end || 9999,
        node.code
      );
      onUpdateNode({
        ...node,
        syncStatus: 'SYNCED',
      });
      setApplySuccessMsg('Source file updated on disk!');
      setTimeout(() => setApplySuccessMsg(null), 3000);
    } catch (err) {
      alert(`Failed to write to source file: ${err}`);
    } finally {
      setIsApplyingSource(false);
    }
  };

  const customBorderColor = currentTagObj.color;
  const isDraft = node.syncStatus === 'MODIFIED';

  // Verification glow styling
  const getGlowStyles = () => {
    if (isArmed) {
      return {
        borderColor: '#ff4d4f',
        boxShadow: '0 0 20px rgba(255, 77, 79, 0.75)',
      };
    }
    if (isHighlighted) {
      return {
        borderColor: '#ffb000',
        boxShadow: '0 0 24px rgba(255, 176, 0, 0.85)',
      };
    }
    switch (verificationStatus) {
      case 'CRASH':
        return {
          borderColor: '#ff3b30',
          boxShadow: '0 0 18px rgba(255, 59, 48, 0.65), 0 8px 30px rgba(0,0,0,0.85)',
        };
      case 'VERIFIED':
        return {
          borderColor: '#00e676',
          boxShadow: '0 0 18px rgba(0, 230, 118, 0.65), 0 8px 30px rgba(0,0,0,0.85)',
        };
      case 'INVESTIGATING':
      default:
        return {
          borderColor: customBorderColor,
          boxShadow: `0 8px 28px rgba(0,0,0,0.8), 0 0 12px ${customBorderColor}30`,
        };
    }
  };

  const glow = getGlowStyles();

  return (
    <article
      className={`snippet-card tag-${node.tag.toLowerCase()} status-${verificationStatus.toLowerCase()} ${
        node.mode === 'write' ? 'is-active-editor' : 'is-idle-reader'
      } ${isArmed ? 'is-armed-link' : ''} ${isDragging ? 'is-dragging' : ''} ${
        isDimmed ? 'is-search-dimmed' : ''
      } ${isHighlighted ? 'is-search-highlighted' : ''}`}
      style={{
        transform: `translate(${node.x}px, ${node.y}px)`,
        width: `${cardWidth}px`,
        minHeight: `${cardHeight}px`,
        borderColor: glow.borderColor,
        boxShadow: glow.boxShadow,
        opacity: isDimmed ? 0.22 : 1,
      }}
    >
      {/* Draggable Card Header */}
      <header
        className="card-header"
        onMouseDown={(e) => onMouseDownHeader(e, node.id)}
      >
        <div className="card-header-left">
          <GripVertical size={13} className="drag-grip-icon" />

          {/* Verification Status Pill Badge */}
          <button
            type="button"
            className={`verification-status-pill status-${verificationStatus.toLowerCase()}`}
            onClick={handleCycleVerification}
            title={`Verification Status: ${verificationStatus} (Click to cycle CRASH / INVESTIGATING / VERIFIED)`}
            onMouseDown={(e) => e.stopPropagation()}
          >
            {verificationStatus === 'CRASH' && <AlertOctagon size={11} className="status-icon" />}
            {verificationStatus === 'INVESTIGATING' && <Activity size={11} className="status-icon" />}
            {verificationStatus === 'VERIFIED' && <CheckCircle2 size={11} className="status-icon" />}
            <span className="status-text">{verificationStatus}</span>
          </button>

          <input
            type="text"
            className="card-title-input"
            value={node.title}
            onChange={handleTitleChange}
            placeholder="CLUE_TITLE"
            title="Click to rename clue"
            onMouseDown={(e) => e.stopPropagation()}
          />
        </div>

        <div className="card-header-actions" onMouseDown={(e) => e.stopPropagation()}>
          {node.confidence !== undefined && (
            <span className="confidence-pill" title="AI / Static Analysis Confidence Score">
              <Percent size={9} />
              <span>{Math.round(node.confidence * 100)}%</span>
            </span>
          )}

          <button
            type="button"
            className={`mode-badge-btn ${node.mode}`}
            onClick={handleModeToggle}
            title={node.mode === 'read' ? 'Switch to live edit mode' : 'Switch to lightweight viewer'}
          >
            {node.mode === 'read' ? '👁 READ' : '⚡ WRITE'}
          </button>

          <button
            type="button"
            className="file-attach-btn"
            onClick={() => setIsEditingFilePath((v) => !v)}
            title="Attach or edit file slice"
          >
            <FileCode size={13} />
          </button>

          <button
            type="button"
            className={`link-chain-btn ${isArmed ? 'armed' : ''}`}
            onClick={() => onToggleLink(node.id)}
            title={isArmed ? 'Click target node to connect red string' : 'Link evidence string'}
          >
            <Link2 size={13} />
          </button>

          <button
            type="button"
            className="delete-card-btn"
            onClick={() => setShowConfirmDelete(true)}
            title="Delete this clue card"
          >
            <Trash2 size={13} />
          </button>
        </div>
      </header>

      {/* Delete Confirmation Banner */}
      {showConfirmDelete && (
        <div className="card-confirm-delete-banner">
          <AlertTriangle size={13} className="confirm-icon" />
          <span>Delete this clue card?</span>
          <div className="confirm-actions">
            <button
              type="button"
              className="confirm-btn danger-btn"
              onClick={() => {
                setShowConfirmDelete(false);
                onDeleteNode(node.id);
              }}
            >
              YES, DELETE
            </button>
            <button
              type="button"
              className="confirm-btn cancel-btn"
              onClick={() => setShowConfirmDelete(false)}
            >
              CANCEL
            </button>
          </div>
        </div>
      )}

      {/* File Path Drawer */}
      {isEditingFilePath && (
        <form onSubmit={handleAttachFile} className="file-path-editor-form">
          <input
            type="text"
            placeholder="File path (e.g. src/auth.ts)"
            className="file-input"
            value={filePathInput}
            onChange={(e) => setFilePathInput(e.target.value)}
            autoFocus
          />
          <div className="file-line-range-row">
            <input
              type="text"
              placeholder="Lines (e.g. 40-60)"
              className="range-input"
              value={lineRangeInput}
              onChange={(e) => setLineRangeInput(e.target.value)}
            />
            <button type="submit" className="terminal-btn primary-btn btn-xs">
              ATTACH
            </button>
          </div>
        </form>
      )}

      {/* Meta Bar: Tag + File Badge + Sync Status + Notes Toggle */}
      <div className="card-tag-row">
        <div className="tag-selector-wrapper">
          <select
            className="card-tag-select"
            value={node.tag}
            onChange={(e) => handleTagChange(e.target.value)}
            style={{
              color: customBorderColor,
              borderColor: `${customBorderColor}60`,
              backgroundColor: `${customBorderColor}14`,
            }}
          >
            {customTags.map((t) => (
              <option key={t.id} value={t.id}>
                {t.label} {t.sub ? `[${t.sub}]` : ''}
              </option>
            ))}
            <option value="__NEW_TAG__">+ CREATE NEW TAG...</option>
          </select>
        </div>

        <div className="card-meta-right">
          {node.file_path && (
            <span className="file-badge-preview" title={node.file_path}>
              {node.file_path.split(/[\\/]/).pop()}
              {node.line_start ? `:${node.line_start}` : ''}
            </span>
          )}

          <button
            type="button"
            className={`notes-toggle-btn ${showNotes ? 'is-active' : ''}`}
            onClick={() => setShowNotes((v) => !v)}
            title="Toggle Investigation Notes & Markdown Checklist"
          >
            <FileText size={11} />
            <span>NOTES</span>
            {showNotes ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
          </button>
        </div>
      </div>

      {/* Investigation Notes & Interactive Markdown Checklist */}
      {showNotes && (
        <div className="card-notes-drawer">
          <div className="notes-drawer-toolbar">
            <span className="notes-mode-title">
              {hasMarkdownChecklist && !isEditingNotesRaw ? 'INTERACTIVE CHECKLIST' : 'INVESTIGATION HYPOTHESIS'}
            </span>
            <button
              type="button"
              className="notes-toggle-raw-btn"
              onClick={() => setIsEditingNotesRaw((v) => !v)}
              title="Toggle between raw editor and interactive checklist"
            >
              {isEditingNotesRaw ? 'VIEW CHECKLIST' : 'EDIT MARKDOWN'}
            </button>
          </div>

          {hasMarkdownChecklist && !isEditingNotesRaw ? (
            <div className="interactive-checklist-box">
              {(node.checklist || node.notes || '').split('\n').map((line, idx) => {
                const isChecked = /- \[[xX]\]/.test(line);
                const isUnchecked = /- \[ \]/.test(line);
                if (isChecked || isUnchecked) {
                  const label = line.replace(/^\s*- \[[ xX]\]\s*/, '');
                  const leadingSpaces = line.match(/^(\s*)/)?.[1]?.length || 0;
                  const indentLevel = Math.min(Math.floor(leadingSpaces / 2), 4);
                  return (
                    <div
                      key={idx}
                      className={`checklist-item-row ${isChecked ? 'is-item-checked' : ''}`}
                      style={{ paddingLeft: `${4 + indentLevel * 14}px` }}
                      onClick={() => toggleChecklistItem(idx)}
                    >
                      {isChecked ? (
                        <CheckSquare size={13} className="check-box-icon checked" />
                      ) : (
                        <Square size={13} className="check-box-icon unchecked" />
                      )}
                      <span className="checklist-text">{label}</span>
                    </div>
                  );
                } else if (line.trim().length > 0) {
                  const leadingSpaces = line.match(/^(\s*)/)?.[1]?.length || 0;
                  const indentLevel = Math.min(Math.floor(leadingSpaces / 2), 4);
                  return (
                    <p key={idx} className="checklist-plain-line" style={{ paddingLeft: `${4 + indentLevel * 14}px` }}>
                      {line.trim()}
                    </p>
                  );
                }
                return null;
              })}
            </div>
          ) : (
            <textarea
              className="terminal-input card-notes-input"
              rows={3}
              value={node.checklist ?? node.notes ?? ''}
              onChange={handleNotesChange}
              placeholder="Add investigation notes or checklist (- [ ] item)..."
            />
          )}
        </div>
      )}

      {/* Code Editor Viewport */}
      <div className="card-code-body">
        {node.mode === 'write' ? (
          <CodeMirrorLazyEditor
            value={node.code || ''}
            filePath={node.file_path}
            onChange={handleCodeChange}
          />
        ) : (
          <StaticCodeViewer
            code={node.code || ''}
            filePath={node.file_path}
            startLine={node.line_start}
          />
        )}
      </div>

      {/* Disk Source Code Sync Bar (if attached to file) */}
      {node.file_path && (
        <div className="card-sync-footer">
          <div className="sync-status-indicator">
            <span
              className={`sync-status-dot ${
                isDraft ? 'dot-draft' : 'dot-synced'
              }`}
            />
            <span className="sync-status-text">
              {isDraft ? 'DRAFT (Not on disk)' : 'SYNCED'}
            </span>
          </div>

          <div className="sync-actions-group">
            {applySuccessMsg && <span className="sync-msg">{applySuccessMsg}</span>}

            {isDraft && (
              <>
                <button
                  type="button"
                  className="sync-btn apply-btn"
                  onClick={handleApplyToSource}
                  disabled={isApplyingSource}
                  title="Apply modified code directly back to source file on disk"
                >
                  <Save size={11} />
                  <span>{isApplyingSource ? 'APPLYING...' : 'APPLY TO SRC'}</span>
                </button>

                <button
                  type="button"
                  className="sync-btn revert-btn"
                  onClick={handleRevertFromSource}
                  title="Discard card edits and reload from disk"
                >
                  <RotateCcw size={11} />
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* Resize Grip Handle */}
      {onMouseDownResize && (
        <div
          className="card-resize-handle"
          onMouseDown={(e) => onMouseDownResize(e, node.id)}
          title="Drag to resize clue card"
        />
      )}
    </article>
  );
};
