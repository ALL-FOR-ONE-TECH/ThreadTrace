import { EditorView } from '@codemirror/view';
import { Extension } from '@codemirror/state';

export const amberTerminalTheme: Extension = EditorView.theme(
  {
    '&': {
      color: '#ffb000',
      backgroundColor: '#090b07',
      fontFamily: 'JetBrains Mono, Menlo, Monaco, Consolas, Courier New, monospace',
      fontSize: '11px',
      lineHeight: '1.4',
    },
    '.cm-content': {
      caretColor: '#ffb000',
      padding: '4px 0',
    },
    '&.cm-focused .cm-cursor': {
      borderLeftColor: '#ffb000',
      borderLeftWidth: '2px',
    },
    '&.cm-focused .cm-selectionBackground, ::selection': {
      backgroundColor: 'rgba(255, 176, 0, 0.25)',
    },
    '.cm-gutters': {
      backgroundColor: '#0c0d0a',
      color: '#6e5616',
      borderRight: '1px solid #1a2014',
      fontSize: '10px',
      paddingRight: '4px',
    },
    '.cm-activeLineGutter': {
      backgroundColor: '#141a0e',
      color: '#ffb000',
    },
    '.cm-activeLine': {
      backgroundColor: 'rgba(255, 176, 0, 0.05)',
    },
  },
  { dark: true }
);

