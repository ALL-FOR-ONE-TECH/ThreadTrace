import React, { useState } from 'react';
import { SnippetNode, TagType, CustomTag, DEFAULT_TAGS } from '../types/board';
import { StaticCodeViewer } from '../editor/StaticCodeViewer';
import { CodeMirrorLazyEditor } from '../editor/CodeMirrorLazyEditor';
import { TauriBridge } from '../services/tauriBridge';
import { Link2, Trash2, FileCode, GripVertical } from 'lucide-react';

interface Props {
  node: SnippetNode;
  isArmed: boolean;
  isDragging: boolean;
  onMouseDownHeader: (e: React.MouseEvent, id: number) => void;
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
  onMouseDownHeader,
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

  const currentTagObj = customTags.find((t) => t.id === node.tag) || {
    id: node.tag,
    label: node.tag,
    color: '#ffb000',
  };

  const handleModeToggle = () => {
    const nextMode = node.mode === 'read' ? 'write' : 'read';
    onUpdateNode({ ...node, mode: nextMode });
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
    onUpdateNode({ ...node, code: newCode });
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
    });
    setIsEditingFilePath(false);
  };

  const customBorderColor = currentTagObj.color;

  return (
    <article
      className={`snippet-card tag-${node.tag.toLowerCase()} ${
        node.mode === 'write' ? 'is-active-editor' : 'is-idle-reader'
      } ${isArmed ? 'is-armed-link' : ''} ${isDragging ? 'is-dragging' : ''}`}
      style={{
        transform: `translate(${node.x}px, ${node.y}px)`,
        borderColor: isArmed ? '#ff4d4f' : customBorderColor,
        boxShadow: isArmed
          ? '0 0 15px rgba(255, 77, 79, 0.6)'
          : `0 4px 20px rgba(0,0,0,0.8), 0 0 8px ${customBorderColor}25`,
      }}
    >
      <header
        className="card-header"
        onMouseDown={(e) => onMouseDownHeader(e, node.id)}
      >
        <div className="card-header-left">
          <GripVertical size={13} className="drag-grip-icon" />
          <input
            type="text"
            className="card-title-input"
            value={node.title}
            onChange={handleTitleChange}
            placeholder="SNIPPET_TITLE"
            title="Click to rename snippet"
          />
        </div>

        <div className="card-header-actions">
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
            title="Attach or link local file path"
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
            onClick={() => onDeleteNode(node.id)}
            title="Delete this clue card"
          >
            <Trash2 size={13} />
          </button>
        </div>
      </header>

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
          <input
            type="text"
            placeholder="L40-L60"
            className="line-range-input"
            value={lineRangeInput}
            onChange={(e) => setLineRangeInput(e.target.value)}
          />
          <button type="submit" className="attach-submit-btn">
            ATTACH
          </button>
        </form>
      )}

      <div className="card-meta-bar">
        <div className="tag-selector-wrapper">
          <select
            className="tag-dropdown"
            value={node.tag}
            onChange={(e) => handleTagChange(e.target.value)}
            style={{
              color: customBorderColor,
              borderColor: `${customBorderColor}60`,
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

        {node.file_path && (
          <span className="file-badge" title={node.file_path}>
            {node.file_path.split('/').pop()}
            {node.line_start ? `:${node.line_start}` : ''}
          </span>
        )}
      </div>

      <div className="card-editor-viewport">
        {node.mode === 'write' ? (
          <CodeMirrorLazyEditor
            value={node.code || ''}
            filePath={node.file_path}
            onChange={handleCodeChange}
            onBlur={() => onUpdateNode({ ...node, mode: 'read' })}
          />
        ) : (
          <StaticCodeViewer
            code={node.code || ''}
            filePath={node.file_path}
            startLine={node.line_start}
          />
        )}
      </div>
    </article>
  );
};


