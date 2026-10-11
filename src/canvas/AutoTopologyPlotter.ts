import { SnippetNode, SnippetLink } from '../types/board';

export interface TopologyLayoutOptions {
  startX?: number;
  startY?: number;
  horizontalSpacing?: number;
  verticalGap?: number;
}

/**
 * AutoTopologyPlotter:
 * Computes deterministic causal DAG strata and non-overlapping spatial placement
 * for investigation nodes on the ThreadTrace 2D evidence canvas.
 */
export function computeAutoTopology(
  nodes: SnippetNode[],
  links: SnippetLink[],
  options: TopologyLayoutOptions = {}
): SnippetNode[] {
  if (nodes.length === 0) return [];

  const startX = options.startX ?? 100;
  const startY = options.startY ?? 100;
  const horizontalSpacing = options.horizontalSpacing ?? 460;
  const verticalGap = options.verticalGap ?? 45;

  const nodeMap = new Map<number, SnippetNode>();
  nodes.forEach((n) => nodeMap.set(n.id, { ...n }));

  // Build adjacency graph
  const inDegree = new Map<number, number>();
  const outDegree = new Map<number, number>();
  const outgoing = new Map<number, number[]>();

  nodes.forEach((n) => {
    inDegree.set(n.id, 0);
    outDegree.set(n.id, 0);
    outgoing.set(n.id, []);
  });

  links.forEach((l) => {
    if (nodeMap.has(l.from_id) && nodeMap.has(l.to_id)) {
      outgoing.get(l.from_id)?.push(l.to_id);
      inDegree.set(l.to_id, (inDegree.get(l.to_id) || 0) + 1);
      outDegree.set(l.from_id, (outDegree.get(l.from_id) || 0) + 1);
    }
  });

  // Assign layers: L0 (Bug / Roots), L1 (Evidence / Propagations), L2 (Fixes / Sinks)
  const layerMap = new Map<number, number>();

  // Seed layer 0 with root bugs or nodes with in-degree 0
  const queue: { id: number; layer: number }[] = [];
  const visited = new Set<number>();

  nodes.forEach((n) => {
    const inDeg = inDegree.get(n.id) || 0;
    const outDeg = outDegree.get(n.id) || 0;
    const tagUpper = n.tag.toUpperCase();
    const isBug = tagUpper === 'BUG' || tagUpper.includes('ROOT') || tagUpper.includes('CRASH');
    const isTrueRoot = inDeg === 0 && outDeg > 0;

    if (isTrueRoot || (isBug && inDeg === 0)) {
      layerMap.set(n.id, 0);
      queue.push({ id: n.id, layer: 0 });
      visited.add(n.id);
    }
  });

  // Fallback if graph is a cycle or all in-degree > 0
  if (queue.length === 0 && nodes.length > 0) {
    layerMap.set(nodes[0].id, 0);
    queue.push({ id: nodes[0].id, layer: 0 });
    visited.add(nodes[0].id);
  }

  // BFS / DAG layer propagation
  while (queue.length > 0) {
    const current = queue.shift()!;
    const nextLayer = current.layer + 1;
    const neighbors = outgoing.get(current.id) || [];

    neighbors.forEach((nbrId) => {
      const existingLayer = layerMap.get(nbrId) ?? -1;
      if (nextLayer > existingLayer) {
        layerMap.set(nbrId, nextLayer);
      }
      if (!visited.has(nbrId)) {
        visited.add(nbrId);
        queue.push({ id: nbrId, layer: nextLayer });
      }
    });
  }

  // Any remaining unvisited nodes get assigned based on tag or fallback layer
  nodes.forEach((n) => {
    if (!layerMap.has(n.id)) {
      const tagUpper = n.tag.toUpperCase();
      if (tagUpper === 'FIX' || tagUpper.includes('PATCH')) {
        layerMap.set(n.id, 2);
      } else if (tagUpper === 'EVIDENCE' || tagUpper.includes('TRIGGER')) {
        layerMap.set(n.id, 1);
      } else {
        layerMap.set(n.id, 0);
      }
    }
  });

  // Group nodes by layer
  const layers: Map<number, SnippetNode[]> = new Map();
  nodes.forEach((n) => {
    const l = layerMap.get(n.id) || 0;
    if (!layers.has(l)) layers.set(l, []);
    layers.get(l)!.push(nodeMap.get(n.id)!);
  });

  // Sort layers keys (0, 1, 2...)
  const sortedLayerKeys = Array.from(layers.keys()).sort((a, b) => a - b);

  // Position nodes within layers
  const positionedNodes: SnippetNode[] = [];

  sortedLayerKeys.forEach((layerIdx) => {
    const layerNodes = layers.get(layerIdx)!;
    const layerX = startX + layerIdx * horizontalSpacing;
    let currentY = startY;

    layerNodes.forEach((node) => {
      node.x = layerX;
      node.y = currentY;

      const cardH = node.height || 280;
      currentY += cardH + verticalGap;
      positionedNodes.push(node);
    });
  });

  // Obstacle avoidance / Pairwise collision resolution
  let collisionResolved = false;
  let iterations = 0;
  const maxIterations = 20;

  while (!collisionResolved && iterations < maxIterations) {
    collisionResolved = true;
    iterations++;

    for (let i = 0; i < positionedNodes.length; i++) {
      for (let j = i + 1; j < positionedNodes.length; j++) {
        const a = positionedNodes[i];
        const b = positionedNodes[j];

        const aW = a.width || 360;
        const aH = a.height || 280;
        const bW = b.width || 360;
        const bH = b.height || 280;

        const overlapX = a.x < b.x + bW + 20 && a.x + aW + 20 > b.x;
        const overlapY = a.y < b.y + bH + 20 && a.y + aH + 20 > b.y;

        if (overlapX && overlapY) {
          collisionResolved = false;
          // Push node b below node a
          b.y = a.y + aH + verticalGap;
        }
      }
    }
  }

  return positionedNodes;
}
