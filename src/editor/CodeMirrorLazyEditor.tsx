import React, { useEffect, useRef } from 'react';
import { EditorState } from '@codemirror/state';
import { EditorView, keymap, lineNumbers, highlightActiveLineGutter, highlightActiveLine } from '@codemirror/view';
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands';
import { javascript } from '@codemirror/lang-javascript';
import { rust } from '@codemirror/lang-rust';
import { json } from '@codemirror/lang-json';
import { amberTerminalTheme } from './theme';

interface Props {
  value: string;
  filePath?: string | null;
  onChange: (val: string) => void;
  onBlur?: () => void;
  autoFocus?: boolean;
}

export const CodeMirrorLazyEditor: React.FC<Props> = ({
  value,
  filePath,
  onChange,
  onBlur,
  autoFocus = true,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const ext = filePath?.split('.').pop() || 'ts';
    const langExtension = ext === 'rs' ? rust() : ext === 'json' ? json() : javascript({ typescript: true });

    const updateListener = EditorView.updateListener.of((update) => {
      if (update.docChanged) {
        onChange(update.state.doc.toString());
      }
    });

    const domEventsListener = EditorView.domEventHandlers({
      blur: () => {
        if (onBlur) onBlur();
      },
    });

    const startState = EditorState.create({
      doc: value,
      extensions: [
        lineNumbers(),
        highlightActiveLineGutter(),
        highlightActiveLine(),
        history(),
        langExtension,
        amberTerminalTheme,
        keymap.of([...defaultKeymap, ...historyKeymap]),
        updateListener,
        domEventsListener,
      ],
    });

    const view = new EditorView({
      state: startState,
      parent: containerRef.current,
    });

    viewRef.current = view;

    if (autoFocus) {
      view.focus();
    }

    return () => {
      view.destroy();
      viewRef.current = null;
    };
  }, [filePath]);

  return <div ref={containerRef} className="codemirror-mount-wrapper" />;
};

