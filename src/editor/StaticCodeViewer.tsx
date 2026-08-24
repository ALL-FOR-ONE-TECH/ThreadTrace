import React, { useMemo } from 'react';
import Prism from 'prismjs';
import 'prismjs/components/prism-typescript';
import 'prismjs/components/prism-javascript';
import 'prismjs/components/prism-rust';
import 'prismjs/components/prism-json';
import 'prismjs/components/prism-log';

interface Props {
  code: string;
  filePath?: string | null;
  startLine?: number | null;
}

export const StaticCodeViewer: React.FC<Props> = ({ code, filePath, startLine = 1 }) => {
  const lineStart = startLine || 1;

  const lines = useMemo(() => {
    const raw = code || '// No snippet code';
    const ext = filePath?.split('.').pop() || 'ts';
    const lang = ext === 'rs' ? 'rust' : ext === 'json' ? 'json' : ext === 'log' ? 'log' : 'typescript';
    const grammar = Prism.languages[lang] || Prism.languages.javascript || Prism.languages.clike;

    const fullHighlighted = Prism.highlight(raw, grammar, lang);
    return fullHighlighted.split('\n').map((htmlLine, idx) => ({
      num: lineStart + idx,
      html: htmlLine || '&nbsp;',
    }));
  }, [code, filePath, lineStart]);


  return (
    <div className="static-code-viewer">
      <div className="code-rows-container">
        {lines.map((l) => (
          <div key={l.num} className="code-line-row">
            <span className="line-num-gutter" aria-hidden="true">
              {l.num}
            </span>
            <span className="code-line-tokens" dangerouslySetInnerHTML={{ __html: l.html }} />
          </div>
        ))}
      </div>
    </div>
  );
};
