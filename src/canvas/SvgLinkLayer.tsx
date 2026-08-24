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
  const getNodeAnchor = (id: number) => {
    const node = nodes.find((n) => n.id === id);
    if (!node) return null;
    const cardWidth = node.width || 340;
    // Anchor to top-right pin position of the card header
    return {
      x: node.x + cardWidth - 28,
      y: node.y + 18,
    };
  };

  const computeCurve = (x1: number, y1: number, x2: number, y2: number) => {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const dist = Math.hypot(dx, dy);
    const sag = Math.min(90, Math.max(25, dist * 0.15));
    const cx = (x1 + x2) / 2;
    const cy = (y1 + y2) / 2 + sag;
    return `M ${x1} ${y1} Q ${cx} ${cy} ${x2} ${y2}`;
  };

  const startNodeAnchor = linkStart ? getNodeAnchor(linkStart) : null;

  const minBoundX = nodes.length > 0 ? Math.min(0, ...nodes.map((n) => n.x - 400)) : 0;
  const minBoundY = nodes.length > 0 ? Math.min(0, ...nodes.map((n) => n.y - 400)) : 0;
  const maxBoundX = nodes.length > 0 ? Math.max(5000, ...nodes.map((n) => n.x + (n.width || 340) + 600)) : 5000;
  const maxBoundY = nodes.length > 0 ? Math.max(4000, ...nodes.map((n) => n.y + (n.height || 260) + 600)) : 4000;
  const svgW = maxBoundX - minBoundX;
  const svgH = maxBoundY - minBoundY;

  return (
    <svg
      className="evidence-link-svg-layer"
      width={svgW}
      height={svgH}
      style={{
        position: 'absolute',
        top: `${minBoundY}px`,
        left: `${minBoundX}px`,
        width: `${svgW}px`,
        height: `${svgH}px`,
        pointerEvents: 'none',
        zIndex: 5,
      }}
      viewBox={`${minBoundX} ${minBoundY} ${svgW} ${svgH}`}
    >

      <defs>
        <filter id="string-glow" x="-30%" y="-30%" width="160%" height="160%">
          <feDropShadow dx="0" dy="2" stdDeviation="3" floodColor="#ff3b30" floodOpacity="0.8" />
        </filter>
        <filter id="pin-shadow" x="-30%" y="-30%" width="160%" height="160%">
          <feDropShadow dx="0" dy="2" stdDeviation="2" floodColor="#000" floodOpacity="0.9" />
        </filter>
        <linearGradient id="red-thread-grad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#ff453a" />
          <stop offset="50%" stopColor="#ff3b30" />
          <stop offset="100%" stopColor="#d70015" />
        </linearGradient>
      </defs>

      {links.map((link) => {
        const from = getNodeAnchor(link.from_id);
        const to = getNodeAnchor(link.to_id);
        if (!from || !to) return null;

        const pathD = computeCurve(from.x, from.y, to.x, to.y);

        return (
          <g key={`${link.from_id}-${link.to_id}`} className="evidence-link-group">
            {/* Wide transparent hitbox for easy click/deletion */}
            <path
              d={pathD}
              stroke="transparent"
              strokeWidth="24"
              fill="none"
              style={{ pointerEvents: 'stroke', cursor: 'pointer' }}
              onClick={() => onDeleteLink(link.from_id, link.to_id)}
            >
              <title>Click to sever evidence string connection</title>
            </path>

            {/* Glowing Red Investigation String */}
            <path
              d={pathD}
              stroke="#ff3b30"
              strokeWidth="2.5"
              fill="none"
              filter="url(#string-glow)"
              className="evidence-string-path"
            />

            {/* Core Thread */}
            <path
              d={pathD}
              stroke="url(#red-thread-grad)"
              strokeWidth="2"
              strokeDasharray="8 2"
              fill="none"
            />

            {/* Brass Pins on Clue Cards */}
            <circle
              cx={from.x}
              cy={from.y}
              r={5}
              fill="#ff453a"
              stroke="#fff"
              strokeWidth="1.5"
              filter="url(#pin-shadow)"
            />
            <circle
              cx={to.x}
              cy={to.y}
              r={5}
              fill="#ff453a"
              stroke="#fff"
              strokeWidth="1.5"
              filter="url(#pin-shadow)"
            />
          </g>
        );
      })}

      {/* Active Linking Rubberband String */}
      {startNodeAnchor && cursorPos && (
        <g className="elastic-link-in-progress">
          <path
            d={computeCurve(startNodeAnchor.x, startNodeAnchor.y, cursorPos.x, cursorPos.y)}
            stroke="#ff3b30"
            strokeWidth="2"
            strokeDasharray="6 4"
            fill="none"
            filter="url(#string-glow)"
          />
          <circle
            cx={startNodeAnchor.x}
            cy={startNodeAnchor.y}
            r={6}
            fill="#ff3b30"
            stroke="#fff"
            strokeWidth="2"
            filter="url(#pin-shadow)"
          />
          <circle
            cx={cursorPos.x}
            cy={cursorPos.y}
            r={4}
            fill="#ffb000"
            stroke="#fff"
            strokeWidth="1"
          />
        </g>
      )}
    </svg>
  );
};
