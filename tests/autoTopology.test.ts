import { describe, it, expect } from 'vitest';
import { computeAutoTopology } from '../src/canvas/AutoTopologyPlotter';
import { SnippetNode, SnippetLink } from '../src/types/board';

function makeNode(id: number, overrides: Partial<SnippetNode> = {}): SnippetNode {
  return {
    id, x: 0, y: 0, width: 340, height: 260,
    title: `NODE_${id}`, tag: 'EVIDENCE', mode: 'read',
    code: '', notes: '', file_path: null,
    line_start: 1, line_end: 1,
    ...overrides,
  };
}

describe('computeAutoTopology', () => {
  it('places CAUSES sources left of targets', () => {
    const nodes = [makeNode(1, { tag: 'BUG' }), makeNode(2, { tag: 'FIX' })];
    const links: SnippetLink[] = [{ id: 1, from_id: 1, to_id: 2, relation_type: 'CAUSES' }];
    const out = computeAutoTopology(nodes, links, { startX: 0, startY: 0, horizontalSpacing: 460, verticalGap: 45 });
    const a = out.find((n) => n.id === 1)!;
    const b = out.find((n) => n.id === 2)!;
    expect(a.x).toBeLessThan(b.x);
  });

  it('handles empty boards without throwing', () => {
    expect(computeAutoTopology([], [], {})).toEqual([]);
  });

  it('separates overlapping nodes vertically', () => {
    const nodes = [makeNode(1), makeNode(2), makeNode(3)];
    const out = computeAutoTopology(nodes, [], { startX: 0, startY: 0, horizontalSpacing: 460, verticalGap: 45 });
    const ys = out.map((n) => n.y).sort((a, b) => a - b);
    for (let i = 1; i < ys.length; i++) {
      expect(ys[i] - ys[i - 1]).toBeGreaterThanOrEqual(200);
    }
  });
});
