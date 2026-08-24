import { BoardData } from '../types/board';

export function generateInvestigationMarkdown(boardData: BoardData): string {
  const { title = 'THREAD_TRACE // Investigation Dossier', nodes, links, repo_watch } = boardData;
  const now = new Date().toISOString().replace('T', ' ').substring(0, 19);

  let doc = `# 🕵️ ${title}\n\n`;
  doc += `> Generated on **${now}** · Local-First Evidence Board Report\n\n`;

  if (repo_watch) {
    doc += `### 📁 Repository Context\n`;
    doc += `- **Repo Path**: \`${repo_watch.path}\`\n`;
    if (repo_watch.branch) doc += `- **Active Branch**: \`${repo_watch.branch}\`\n`;
    if (repo_watch.last_commit) doc += `- **Latest Commit**: \`${repo_watch.last_commit}\`\n`;
    if (repo_watch.diff_summary) doc += `- **Diff Summary**: \`${repo_watch.diff_summary.trim()}\`\n`;
    doc += `\n`;
  }

  doc += `## 📊 Evidence Graph (Mermaid Flowchart)\n\n`;
  doc += `\`\`\`mermaid\ngraph TD\n`;

  const safeMermaid = (s: string) =>
    s
      .replace(/["\\[\\](){}:;]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

  const safeTable = (s: string) => s.replace(/\|/g, '\\|').trim();

  for (const n of nodes) {
    doc += `  N${n.id}["(${safeMermaid(n.tag)}) #${n.id}: ${safeMermaid(n.title)}"]\n`;
  }

  for (const l of links) {
    doc += `  N${l.from_id} ==>|linked evidence| N${l.to_id}\n`;
  }

  doc += `\`\`\`\n\n`;

  doc += `## 📋 Clue Inventory (${nodes.length} Items)\n\n`;
  doc += `| ID | Tag | Title | File Backing | Mode |\n`;
  doc += `|---|---|---|---|---|\n`;

  for (const n of nodes) {
    const fileRef = n.file_path ? `\`${safeTable(n.file_path)}\` (L${n.line_start || 1}-L${n.line_end || 50})` : `*scratch snippet*`;
    doc += `| #${n.id} | **${safeTable(n.tag)}** | \`${safeTable(n.title)}\` | ${fileRef} | ${n.mode} |\n`;
  }


  doc += `\n---\n\n## 📝 Detailed Snippets & Evidence Code\n\n`;

  for (const n of nodes) {
    doc += `### [${n.tag}] #${n.id}: ${safeMermaid(n.title)}\n\n`;
    if (n.file_path) {

      doc += `📍 **Source**: \`${n.file_path}\` (Lines ${n.line_start || 1}–${n.line_end || 50})\n\n`;
    }
    const ext = n.file_path?.split('.').pop() || 'ts';
    doc += `\`\`\`${ext}\n${n.code || '// (empty)'}\n\`\`\`\n\n`;
  }

  return doc;
}


