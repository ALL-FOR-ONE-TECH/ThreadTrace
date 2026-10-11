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
  const getSourceAnchor = (id: number) => {
    const node = nodes.find((n) => n.id === id);
    if (!node) return null;
    const cardWidth = node.width || 340;
    return {
      x: node.x + cardWidth - 24,
      y: node.y + 24,
    };
  };

  const getLinkAnchors = (fromId: number, toId: number) => {
    const fromNode = nodes.find((n) => n.id === fromId);
    const toNode = nodes.find((n) => n.id === toId);
    if (!fromNode || !toNode) return null;

    const fromW = fromNode.width || 340;
    const toW = toNode.width || 340;

    if (fromNode.x <= toNode.x) {
      return {
        from: { x: fromNode.x + fromW - 24, y: fromNode.y + 24 },
        to: { x: toNode.x + 20, y: toNode.y + 24 },
      };
    } else {
      return {
        from: { x: fromNode.x + 20, y: fromNode.y + 24 },
        to: { x: toNode.x + toW - 24, y: toNode.y + 24 },
      };
    }
  };

  const computeCurve = (x1: number, y1: number, x2: number, y2: number) => {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const dist = Math.hypot(dx, dy);
    const theta = Math.atan2(dy, dx);
    const sMax = 95;
    const sMin = 28;
    const lambda = 350;
    const sag = sMax * (1 - Math.exp(-dist / lambda)) * Math.abs(Math.cos(theta)) + sMin;
    const cx = (x1 + x2) / 2;
    const cy = (y1 + y2) / 2 + sag;
    return {
      path: `M ${x1} ${y1} Q ${cx} ${cy} ${x2} ${y2}`,
      midX: cx,
      midY: cy,
    };
  };

  const getRelationColor = (relation?: string) => {
    switch (relation?.toUpperCase()) {
      case 'FIXES':
        return '#00e676';
      case 'CALLS':
        return '#2979ff';
      case 'CAUSES':
      default:
        return '#ff3b30';
    }
  };

  const startNodeAnchor = linkStart ? getSourceAnchor(linkStart) : null;

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
        const anchors = getLinkAnchors(link.from_id, link.to_id);
        if (!anchors) return null;
        const { from, to } = anchors;

        const curve = computeCurve(from.x, from.y, to.x, to.y);
        const relation = link.relation_type || 'CAUSES';
        const badgeColor = getRelationColor(relation);

        return (
          <g key={`${link.from_id}-${link.to_id}`} className="evidence-link-group">
            {/* Wide transparent hitbox for easy click/deletion */}
            <path
              d={curve.path}
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
              d={curve.path}
              stroke="#ff3b30"
              strokeWidth="2.5"
              fill="none"
              filter="url(#string-glow)"
              className="evidence-string-path"
            />

            {/* Core Thread */}
            <path
              d={curve.path}
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

            {/* Typed Causal Relation Badge */}
            <g
              transform={`translate(${curve.midX}, ${curve.midY})`}
              style={{ pointerEvents: 'auto', cursor: 'pointer' }}
              onClick={() => onDeleteLink(link.from_id, link.to_id)}
            >
              <rect
                x="-36"
                y="-10"
                width="72"
                height="20"
                rx="4"
                fill="#0d1117"
                stroke={badgeColor}
                strokeWidth="1"
                opacity="0.95"
              />
              <text
                x="0"
                y="3.5"
                textAnchor="middle"
                fill={badgeColor}
                fontSize="9"
                fontFamily="monospace"
                fontWeight="700"
                letterSpacing="0.5"
              >
                {relation}
              </text>
            </g>
          </g>
        );
      })}

      {/* Active Linking Rubberband String */}
      {startNodeAnchor && cursorPos && (
        <g className="elastic-link-in-progress">
          {(() => {
            const curve = computeCurve(startNodeAnchor.x, startNodeAnchor.y, cursorPos.x, cursorPos.y);
            return (
              <>
                <path
                  d={curve.path}
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
              </>
            );
          })()}
        </g>
      )}
    </svg>
  );
};
