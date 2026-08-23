import { BoardData } from '../types/board';

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export function generateInvestigationHtml(data: BoardData): string {
  const title = data.title || 'THREAD_TRACE // INVESTIGATION_DOSSIER';
  const nodes = data.nodes || [];
  const links = data.links || [];
  const repo = data.repo_watch;
  const timestamp = new Date().toISOString();

  const nodeMap = new Map(nodes.map((n) => [n.id, n]));

  // Generate SVG Links
  const svgLinks = links
    .map((l) => {
      const from = nodeMap.get(l.from_id);
      const to = nodeMap.get(l.to_id);
      if (!from || !to) return '';
      const x1 = from.x + 140;
      const y1 = from.y + 70;
      const x2 = to.x + 140;
      const y2 = to.y + 70;
      const midX = (x1 + x2) / 2;
      const midY = (y1 + y2) / 2 - 30;
      return `<path d="M ${x1} ${y1} Q ${midX} ${midY} ${x2} ${y2}" fill="none" stroke="#ff4d4f" stroke-width="2" opacity="0.75" />`;
    })
    .join('\n');

  // Generate SVG Nodes
  const svgNodes = nodes
    .map((n) => {
      const color =
        n.tag === 'BUG'
          ? '#ff4d4f'
          : n.tag === 'TASK'
          ? '#ffb000'
          : n.tag === 'FIX'
          ? '#52c41a'
          : '#1890ff';
      return `
      <g transform="translate(${n.x}, ${n.y})">
        <rect width="280" height="140" rx="4" fill="#12140f" stroke="${color}" stroke-width="1.5" />
        <rect width="280" height="24" rx="4" fill="#181c14" />
        <text x="10" y="16" fill="${color}" font-family="monospace" font-size="11" font-weight="bold">${escapeHtml(n.title)}</text>
        <text x="10" y="44" fill="#8c967d" font-family="monospace" font-size="10">TAG: ${n.tag}</text>
        ${n.file_path ? `<text x="10" y="62" fill="#79a6d2" font-family="monospace" font-size="9">${escapeHtml(n.file_path)}</text>` : ''}
      </g>`;
    })
    .join('\n');

  // Generate Clue Cards
  const cardsHtml = nodes
    .map((n) => {
      const color =
        n.tag === 'BUG'
          ? '#ff4d4f'
          : n.tag === 'TASK'
          ? '#ffb000'
          : n.tag === 'FIX'
          ? '#52c41a'
          : '#1890ff';
      return `
      <article class="clue-card" data-tag="${n.tag}">
        <header class="clue-header" style="border-left: 4px solid ${color};">
          <div class="clue-title-row">
            <span class="clue-tag" style="background: ${color}22; color: ${color}; border: 1px solid ${color}66;">${n.tag}</span>
            <h3 class="clue-title">${escapeHtml(n.title)}</h3>
          </div>
          ${
            n.file_path
              ? `<div class="clue-file-meta">
                  <span class="file-path">📁 ${escapeHtml(n.file_path)}</span>
                  ${n.line_start ? `<span class="line-range">L${n.line_start}${n.line_end ? `-${n.line_end}` : ''}</span>` : ''}
                </div>`
              : ''
          }
        </header>
        <div class="clue-body">
          <pre><code>${escapeHtml(n.code || '// No snippet content')}</code></pre>
        </div>
      </article>`;
    })
    .join('\n');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)}</title>
  <style>
    :root {
      --bg: #0c0d0a;
      --surface: #12140f;
      --surface-elevated: #181c14;
      --amber: #ffb000;
      --amber-bright: #ffc83b;
      --text: #ffcc4d;
      --text-muted: #8c967d;
      --border: #252b1d;
      --mono: ui-monospace, monospace;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background: var(--bg);
      color: var(--text);
      font-family: var(--mono);
      font-size: 13px;
      line-height: 1.5;
      padding: 24px;
    }
    .dossier-container { max-width: 1200px; margin: 0 auto; display: flex; flex-direction: column; gap: 24px; }
    header.dossier-masthead {
      background: var(--surface);
      border: 1px solid var(--border);
      border-left: 4px solid var(--amber);
      padding: 16px 20px;
      border-radius: 4px;
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      flex-wrap: wrap;
      gap: 16px;
    }
    h1.dossier-title { font-size: 18px; font-weight: 800; color: var(--amber-bright); letter-spacing: 1px; }
    .dossier-meta { display: flex; gap: 12px; font-size: 11px; color: var(--text-muted); margin-top: 6px; }
    .meta-val { color: var(--amber-bright); }
    .graph-section {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 4px;
      padding: 16px;
      overflow-x: auto;
    }
    .section-title { font-size: 13px; font-weight: 800; color: var(--amber-bright); margin-bottom: 12px; }
    .cards-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(360px, 1fr)); gap: 16px; }
    .clue-card {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 4px;
      overflow: hidden;
      display: flex;
      flex-direction: column;
    }
    .clue-header { padding: 10px 14px; background: var(--surface-elevated); border-bottom: 1px solid var(--border); }
    .clue-title-row { display: flex; align-items: center; gap: 8px; }
    .clue-tag { font-size: 10px; font-weight: 800; padding: 2px 6px; border-radius: 2px; }
    .clue-title { font-size: 13px; font-weight: 800; color: var(--amber-bright); word-break: break-all; }
    .clue-file-meta { font-size: 10px; color: #79a6d2; margin-top: 6px; display: flex; gap: 8px; }
    .clue-body { padding: 12px; background: #080a06; overflow-x: auto; flex: 1; }
    pre { font-family: var(--mono); font-size: 12px; color: var(--text); white-space: pre-wrap; word-break: break-all; }
    footer { text-align: center; color: var(--text-muted); font-size: 11px; padding: 20px 0; }
  </style>
</head>
<body>
  <div class="dossier-container">
    <header class="dossier-masthead">
      <div>
        <h1 class="dossier-title">${escapeHtml(title)}</h1>
        <div class="dossier-meta">
          <span>GENERATED: <span class="meta-val">${escapeHtml(timestamp)}</span></span>
          <span>CLUES: <span class="meta-val">${nodes.length}</span></span>
          <span>LINKS: <span class="meta-val">${links.length}</span></span>
          ${repo?.branch ? `<span>GIT: <span class="meta-val">${escapeHtml(repo.branch)}</span></span>` : ''}
        </div>
      </div>
    </header>

    ${
      nodes.length > 0
        ? `<section class="graph-section">
            <h2 class="section-title">[SPATIAL_EVIDENCE_GRAPH // TOPOLOGY]</h2>
            <svg width="1150" height="420" viewBox="0 0 1400 600" style="background:#080a06;border:1px solid #1a2014;border-radius:4px;width:100%;">
              ${svgLinks}
              ${svgNodes}
            </svg>
          </section>`
        : ''
    }

    <section>
      <h2 class="section-title">[PINNED_CLUES_CATALOG // DETAILED EVIDENCE]</h2>
      <div class="cards-grid">
        ${cardsHtml}
      </div>
    </section>

    <footer>
      ThreadTrace — Spatial Code Investigation Canvas · Generated with ALL-FOR-ONE-TECH
    </footer>
  </div>
</body>
</html>`;
}
