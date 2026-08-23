import React from 'react';
import { Terminal, X } from 'lucide-react';

interface Props {
  onClose: () => void;
}

export const ShortcutsModal: React.FC<Props> = ({ onClose }) => {
  return (
    <div className="shortcuts-modal-backdrop" onClick={onClose}>
      <div className="shortcuts-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title">
            <Terminal size={14} className="terminal-icon-pulse" />
            <span>[INVESTIGATION_TERMINAL_CHEAT_SHEET]</span>
          </div>
          <button className="modal-close-btn" onClick={onClose}>
            <X size={14} />
          </button>
        </div>

        <div className="modal-body">
          <table className="shortcuts-table">
            <thead>
              <tr>
                <th>KEY / MOUSE</th>
                <th>ACTION</th>
                <th>SUBSYSTEM</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><kbd>N</kbd></td>
                <td>Create and place new code snippet card</td>
                <td>BOARD</td>
              </tr>
              <tr>
                <td><kbd>T</kbd></td>
                <td>Open Custom Tag Engine & Color Palette Manager</td>
                <td>TAGS</td>
              </tr>
              <tr>
                <td><kbd>0</kbd></td>
                <td>Filter: ALL TAGS</td>
                <td>FILTER</td>
              </tr>
              <tr>
                <td><kbd>1</kbd></td>
                <td>Filter: BUG [CRITICAL]</td>
                <td>FILTER</td>
              </tr>
              <tr>
                <td><kbd>2</kbd></td>
                <td>Filter: TASK [TODO]</td>
                <td>FILTER</td>
              </tr>
              <tr>
                <td><kbd>3</kbd></td>
                <td>Filter: FIX [PATCH]</td>
                <td>FILTER</td>
              </tr>
              <tr>
                <td><kbd>4</kbd></td>
                <td>Filter: EVIDENCE [PROOF]</td>
                <td>FILTER</td>
              </tr>
              <tr>
                <td><kbd>CTRL + WHEEL</kbd></td>
                <td>Cursor-centered smooth zoom</td>
                <td>CANVAS</td>
              </tr>
              <tr>
                <td><kbd>ALT + DRAG</kbd></td>
                <td>Pan canvas viewport</td>
                <td>CANVAS</td>
              </tr>
              <tr>
                <td><kbd>ESC</kbd></td>
                <td>Cancel armed link / Close active modal</td>
                <td>GENERAL</td>
              </tr>
              <tr>
                <td><kbd>?</kbd></td>
                <td>Toggle this cheat sheet</td>
                <td>HELP</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="modal-footer">
          <button className="terminal-btn primary-btn" onClick={onClose}>
            CLOSE CHEATSHEET [ESC]
          </button>
        </div>
      </div>
    </div>
  );
};

