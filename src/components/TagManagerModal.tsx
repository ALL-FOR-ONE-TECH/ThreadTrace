import React, { useState } from 'react';
import { Tag, X, Plus, Trash2 } from 'lucide-react';
import { CustomTag } from '../types/board';

interface Props {
  tags: CustomTag[];
  onSaveTags: (tags: CustomTag[]) => void;
  onClose: () => void;
}

const PRESET_COLORS = [
  '#ff4d4f', // Crimson
  '#ffb000', // Amber
  '#52c41a', // Emerald
  '#13c2c2', // Cyan
  '#1890ff', // Cobalt
  '#722ed1', // Purple
  '#eb2f96', // Magenta
  '#faad14', // Gold
];

export const TagManagerModal: React.FC<Props> = ({ tags, onSaveTags, onClose }) => {
  const [newTagId, setNewTagId] = useState('');
  const [newTagSub, setNewTagSub] = useState('');
  const [selectedColor, setSelectedColor] = useState(PRESET_COLORS[5]);

  const handleAddTag = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanId = newTagId.trim().toUpperCase().replace(/[^A-Z0-9_-]/g, '');
    if (!cleanId) return;

    if (tags.some((t) => t.id === cleanId)) {
      alert(`Tag "${cleanId}" already exists.`);
      return;
    }


    const newTag: CustomTag = {
      id: cleanId,
      label: cleanId,
      sub: newTagSub.trim().toUpperCase() || undefined,
      color: selectedColor,
      isCustom: true,
    };

    const updated = [...tags, newTag];
    onSaveTags(updated);
    setNewTagId('');
    setNewTagSub('');
  };

  const handleDeleteTag = (id: string) => {
    const updated = tags.filter((t) => t.id !== id);
    onSaveTags(updated);
  };

  return (
    <div className="shortcuts-modal-backdrop" onClick={onClose}>
      <div className="shortcuts-modal tag-manager-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title">
            <Tag size={14} className="terminal-icon-pulse" />
            <span>[CUSTOM_TAG_ENGINE // CLUE CLASSIFICATION]</span>
          </div>
          <button className="modal-close-btn" onClick={onClose}>
            <X size={14} />
          </button>
        </div>

        <div className="modal-body tag-manager-body">
          <form onSubmit={handleAddTag} className="new-tag-form">
            <div className="form-title">
              <Plus size={13} />
              <span>DEFINE NEW INVESTIGATION TAG</span>
            </div>

            <div className="tag-inputs-grid">
              <div className="tag-input-field">
                <label className="terminal-label">TAG ID (e.g. SECURITY):</label>
                <input
                  type="text"
                  className="terminal-input"
                  placeholder="SECURITY"
                  value={newTagId}
                  onChange={(e) => setNewTagId(e.target.value)}
                  maxLength={16}
                  required
                />
              </div>

              <div className="tag-input-field">
                <label className="terminal-label">SUB-LABEL (OPTIONAL):</label>
                <input
                  type="text"
                  className="terminal-input"
                  placeholder="CVE_AUDIT"
                  value={newTagSub}
                  onChange={(e) => setNewTagSub(e.target.value)}
                  maxLength={16}
                />
              </div>
            </div>

            <div className="color-swatches-section">
              <label className="terminal-label">BADGE PHOSPHOR COLOR:</label>
              <div className="swatches-row">
                {PRESET_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    className={`swatch-btn ${selectedColor === c ? 'swatch-active' : ''}`}
                    style={{ backgroundColor: c }}
                    onClick={() => setSelectedColor(c)}
                  />
                ))}
              </div>
            </div>

            <div className="tag-live-preview-box">
              <span className="preview-label">LIVE PREVIEW:</span>
              <span
                className="tag-pill-preview"
                style={{
                  color: selectedColor,
                  borderColor: selectedColor,
                  backgroundColor: `${selectedColor}18`,
                  boxShadow: `0 0 8px ${selectedColor}40`,
                }}
              >
                {newTagId.trim().toUpperCase() || 'SAMPLE_TAG'}
                {newTagSub.trim() ? ` [${newTagSub.trim().toUpperCase()}]` : ''}
              </span>

              <button type="submit" className="terminal-btn primary-btn add-tag-btn">
                + REGISTER TAG
              </button>
            </div>
          </form>

          <div className="existing-tags-section">
            <div className="form-title">
              <Tag size={13} />
              <span>ACTIVE CLASSIFICATION TAGS ({tags.length})</span>
            </div>

            <div className="tags-chips-list">
              {tags.map((t) => (
                <div
                  key={t.id}
                  className="tag-chip-row"
                  style={{
                    borderColor: `${t.color}60`,
                    backgroundColor: `${t.color}14`,
                    color: t.color,
                  }}
                >
                  <span className="tag-chip-label">
                    {t.label}
                    {t.sub ? ` [${t.sub}]` : ''}
                  </span>
                  {t.isCustom && (
                    <button
                      type="button"
                      className="delete-tag-icon-btn"
                      onClick={() => handleDeleteTag(t.id)}
                      title={`Delete tag ${t.id}`}
                    >
                      <Trash2 size={12} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>


        <div className="modal-footer">
          <button className="terminal-btn primary-btn" onClick={onClose}>
            DONE [ESC]
          </button>
        </div>
      </div>
    </div>
  );
};

