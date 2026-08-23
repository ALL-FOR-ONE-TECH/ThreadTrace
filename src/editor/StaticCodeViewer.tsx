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

  const html = useMemo(() => {
    const ext = filePath?.split('.').pop() || 'ts';
    const lang = ext === 'rs' ? 'rust' : ext === 'json' ? 'json' : ext === 'log' ? 'log' : 'typescript';
    const grammar = Prism.languages[lang] || Prism.languages.javascript || Prism.languages.clike;
    return Prism.highlight(code || '// empty', grammar, lang);
  }, [code, filePath]);

  const lines = (code || '// empty').split('\n');

  return (
    <div className="static-code-viewer">
      <div className="gutter-numbers" aria-hidden="true">
        {lines.map((_, idx) => (
          <span key={idx} className="line-no">
            {lineStart + idx}
          </span>
        ))}
      </div>
      <pre className="code-content">
        <code dangerouslySetInnerHTML={{ __html: html }} />
      </pre>
    </div>
  );
};

