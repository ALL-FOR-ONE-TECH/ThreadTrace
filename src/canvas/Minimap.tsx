import React, { useMemo, useState } from 'react';
import { SnippetNode, SnippetLink, CustomTag, DEFAULT_TAGS } from '../types/board';
import { Radio, Minimize2, Maximize2 } from 'lucide-react';

interface Props {
  nodes: SnippetNode[];
  links: SnippetLink[];
  pan: { x: number; y: number };
  zoom: number;
  onNavigate: (newPanX: number, newPanY: number) => void;
  customTags?: CustomTag[];
}

export const Minimap: React.FC<Props> = ({
  nodes,
  links,
  pan,
  zoom,
  onNavigate,
  customTags = DEFAULT_TAGS,
}) => {
  const [collapsed, setCollapsed] = useState(false);
  const mapW = 180;
  const mapH = 120;

  const tagColorMap = useMemo(() => {
    const map: Record<string, string> = {};
    for (const t of customTags) {
      map[t.id] = t.color;
    }
    return map;
  }, [customTags]);

  const bounds = useMemo(() => {
    const viewW = window.innerWidth;
    const viewH = window.innerHeight;
    const viewLeft = -pan.x / zoom;
    const viewTop = -pan.y / zoom;
    const viewRight = viewLeft + viewW / zoom;
    const viewBottom = viewTop + viewH / zoom;

    let minX = viewLeft;
    let minY = viewTop;
    let maxX = viewRight;
    let maxY = viewBottom;

    for (const n of nodes) {
      if (n.x < minX) minX = n.x;
      if (n.y < minY) minY = n.y;
      if (n.x + 300 > maxX) maxX = n.x + 300;
      if (n.y + 200 > maxY) maxY = n.y + 200;
    }

    const padding = 160;
    minX -= padding;
    minY -= padding;
    maxX += padding;
    maxY += padding;

    const spanX = Math.max(1200, maxX - minX);
    const spanY = Math.max(800, maxY - minY);

    return {
      originX: minX,
      originY: minY,
      spanX,
      spanY,
      scaleX: mapW / spanX,
      scaleY: mapH / spanY,
    };
  }, [nodes, pan, zoom]);

  const toMapX = (worldX: number) => (worldX - bounds.originX) * bounds.scaleX;
  const toMapY = (worldY: number) => (worldY - bounds.originY) * bounds.scaleY;

  const vpLeft = toMapX(-pan.x / zoom);
  const vpTop = toMapY(-pan.y / zoom);
  const vpW = Math.max(8, (window.innerWidth / zoom) * bounds.scaleX);
  const vpH = Math.max(8, (window.innerHeight / zoom) * bounds.scaleY);

  const handleMinimapClick = (e: React.MouseEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const clickMapX = e.clientX - rect.left;
    const clickMapY = e.clientY - rect.top;

    const targetWorldX = bounds.originX + clickMapX / bounds.scaleX;
    const targetWorldY = bounds.originY + clickMapY / bounds.scaleY;

    const newPanX = -(targetWorldX * zoom - window.innerWidth / 2);
    const newPanY = -(targetWorldY * zoom - window.innerHeight / 2);

    onNavigate(newPanX, newPanY);
  };

  if (collapsed) {
    return (
      <div className="minimap-collapsed-pill" onClick={() => setCollapsed(false)}>
        <Radio size={12} className="radar-blip-icon" />
        <span>RADAR HUD</span>
        <Maximize2 size={11} />
      </div>
    );
  }

  return (
    <aside className="minimap-container dynamic-radar-hud">
      <div className="minimap-header">
        <div className="minimap-title-row">
          <Radio size={12} className="radar-blip-icon" />
          <span className="minimap-title">RADAR_HUD // DYNAMIC</span>
        </div>
        <div className="minimap-header-actions">
          <span className="minimap-count">{nodes.length} CLUES</span>
          <button
            className="minimap-toggle-btn"
            onClick={() => setCollapsed(true)}
            title="Collapse Radar"
          >
            <Minimize2 size={11} />
          </button>
        </div>
      </div>

      <svg
        className="minimap-svg"
        width={mapW}
        height={mapH}
        onClick={handleMinimapClick}
      >
        {links.map((l) => {
          const n1 = nodes.find((n) => n.id === l.from_id);
          const n2 = nodes.find((n) => n.id === l.to_id);
          if (!n1 || !n2) return null;
          return (
            <line
              key={`mm-l-${l.id}`}
              x1={toMapX(n1.x + 150)}
              y1={toMapY(n1.y + 100)}
              x2={toMapX(n2.x + 150)}
              y2={toMapY(n2.y + 100)}
              stroke="rgba(193, 68, 14, 0.75)"
              strokeWidth="1"
              strokeDasharray="2,2"
            />
          );
        })}

        {nodes.map((node) => {
          const color = tagColorMap[node.tag] || '#ffb000';
          return (
            <rect
              key={`mm-n-${node.id}`}
              x={toMapX(node.x)}
              y={toMapY(node.y)}
              width={Math.max(4, 300 * bounds.scaleX)}
              height={Math.max(3, 180 * bounds.scaleY)}
              fill={color}
              opacity={0.85}
              rx={1}
            />
          );
        })}


        <rect
          x={vpLeft}
          y={vpTop}
          width={vpW}
          height={vpH}
          fill="none"
          stroke="var(--amber-bright)"
          strokeWidth="1.5"
          strokeDasharray="3,2"
        />
      </svg>
    </aside>
  );
};

