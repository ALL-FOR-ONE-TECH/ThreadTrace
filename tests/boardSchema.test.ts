import { describe, it, expect } from 'vitest';
import { normalizeImportedBoard, BOARD_SCHEMA_VERSION, isVersionedBoardExport } from '../src/hooks/useBoardPersistence';

describe('board schema v3', () => {
  it('exports carry the schema version marker', () => {
    expect(BOARD_SCHEMA_VERSION).toBe(3);
    expect(isVersionedBoardExport({ nodes: [], links: [], schema_version: 3 })).toBe(true);
    expect(isVersionedBoardExport({ nodes: 'nope' })).toBe(false);
  });

  it('drops dangling links and coerces bare nodes', () => {
    const { data, warnings } = normalizeImportedBoard({
      schema_version: 1,
      nodes: [{ id: 1, title: 'A' }, { title: 'B' }],
      links: [
        { id: 9, from_id: 1, to_id: 999 },
        { id: 10, from_id: 1, to_id: 1 },
      ],
    });
    expect(data.links).toEqual([]);
    expect(data.nodes).toHaveLength(2);
    expect(data.nodes[1].id).toEqual(expect.any(Number));
    expect(warnings.length).toBeGreaterThan(0);
  });

  it('rejects non-JSON-safe payloads gracefully', () => {
    const { data } = normalizeImportedBoard(null);
    expect(data.nodes).toEqual([]);
    expect(data.links).toEqual([]);
  });
});
