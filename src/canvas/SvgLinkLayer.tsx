import React from 'react';
import { SnippetNode, SnippetLink } from '../types/board';

interface Props {
  nodes: SnippetNode[];
  links: SnippetLink[];
  linkStart: number | null;
  cursorPos: { x: number; y: number } | null;
  onDeleteLink: (fromId: number, toId: number) => void;
}

export const SvgLinkLayer: React.FC<Props> = ({
  nodes,
  links,
  linkStart,
  cursorPos,
  onDeleteLink,
}) => {
  const getNodeCenter = (id: number) => {
    const node = nodes.find((n) => n.id === id);
    if (!node) return null;
    return {
      x: node.x + 150,
      y: node.y + 120,
    };
  };

  const computePath = (x1: number, y1: number, x2: number, y2: number) => {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const dist = Math.hypot(dx, dy);
    const sag = Math.min(80, Math.max(25, dist * 0.15));
    const cx = (x1 + x2) / 2;
    const cy = (y1 + y2) / 2 + sag;
    return `M ${x1} ${y1} Q ${cx} ${cy} ${x2} ${y2}`;
  };

  const startNodeCenter = linkStart ? getNodeCenter(linkStart) : null;

  return (
    <svg className="evidence-link-svg-layer">
      <defs>
        <filter id="string-glow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="0" stdDeviation="2.5" floodColor="#ff4d4f" floodOpacity="0.6" />
        </filter>
        <filter id="pin-shadow" x="-30%" y="-30%" width="160%" height="160%">
          <feDropShadow dx="0" dy="1" stdDeviation="1.5" floodColor="#000" floodOpacity="0.8" />
        </filter>
      </defs>

      {links.map((link) => {
        const from = getNodeCenter(link.from_id);
        const to = getNodeCenter(link.to_id);
        if (!from || !to) return null;

        const pathData = computePath(from.x, from.y, to.x, to.y);

        return (
          <g key={`${link.from_id}-${link.to_id}`} className="link-path-group">
            <path
              d={pathData}
              className="evidence-link-hitbox"
              onClick={() => onDeleteLink(link.from_id, link.to_id)}
            />
            <path d={pathData} className="evidence-link-shadow" />
            <path d={pathData} className="evidence-link-core" />
            <circle cx={from.x} cy={from.y} r={4} className="pin-head pin-from" />
            <circle cx={to.x} cy={to.y} r={4} className="pin-head pin-to" />
          </g>
        );
      })}

      {startNodeCenter && cursorPos && (
        <g className="elastic-link-in-progress">
          <path
            d={computePath(startNodeCenter.x, startNodeCenter.y, cursorPos.x, cursorPos.y)}
            className="evidence-link-preview"
          />
          <circle cx={startNodeCenter.x} cy={startNodeCenter.y} r={5} className="pin-head-active" />
          <circle cx={cursorPos.x} cy={cursorPos.y} r={3} className="pin-head-tracking" />
        </g>
      )}
    </svg>
  );
};


