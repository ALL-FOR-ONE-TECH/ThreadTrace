import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { SnippetNode, SnippetLink, TagType, DraggingState, RepoWatchInfo, CustomTag, DEFAULT_TAGS } from '../types/board';
import { TauriBridge, isTauriEnv } from '../services/tauriBridge';
import { Masthead } from './Masthead';
import { SnippetCard } from './SnippetCard';
import { SvgLinkLayer } from '../canvas/SvgLinkLayer';
import { Minimap } from '../canvas/Minimap';
import { ShortcutsModal } from './ShortcutsModal';
import { TagManagerModal } from './TagManagerModal';
import { SystemTelemetryHUD } from './SystemTelemetryHUD';
import { generateInvestigationMarkdown } from '../services/dossierExport';
import { ZoomIn, ZoomOut, Maximize2 } from 'lucide-react';

export const SnippetBoard: React.FC = () => {
  const [boardTitle, setBoardTitle] = useState<string>('THREAD_TRACE // AUTH_INVESTIGATION');
  const [nodes, setNodes] = useState<SnippetNode[]>([]);
  const [links, setLinks] = useState<SnippetLink[]>([]);
  const [customTags, setCustomTags] = useState<CustomTag[]>(DEFAULT_TAGS);
  const [linkStart, setLinkStart] = useState<number | null>(null);
  const [dragging, setDragging] = useState<DraggingState | null>(null);
  const [cursorPos, setCursorPos] = useState<{ x: number; y: number } | null>(null);
  const [selectedFilter, setSelectedFilter] = useState<TagType | 'ALL'>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [showShortcuts, setShowShortcuts] = useState<boolean>(false);
  const [showTagManager, setShowTagManager] = useState<boolean>(false);
  const [repoWatch, setRepoWatch] = useState<RepoWatchInfo | null>(null);
  const [isTauri, setIsTauri] = useState(false);
  const [zoom, setZoom] = useState<number>(1.0);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  const boardRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number | null>(null);
  const nodesRef = useRef<SnippetNode[]>(nodes);
  nodesRef.current = nodes;

  useEffect(() => {
    setIsTauri(isTauriEnv());
    TauriBridge.fetchBoardData().then((data) => {
      setNodes(data.nodes || []);
      setLinks(data.links || []);
      if (data.title) setBoardTitle(data.title);
      if (data.custom_tags && data.custom_tags.length > 0) setCustomTags(data.custom_tags);
      if (data.repo_watch) setRepoWatch(data.repo_watch);
    });
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || (e.target as HTMLElement).isContentEditable) {
        return;
      }
      if (e.key === 'Escape') {
        setLinkStart(null);
        setShowShortcuts(false);
        setShowTagManager(false);
      } else if (e.key === 'n' || e.key === 'N') {
        e.preventDefault();
        handleAddSnippet();
      } else if (e.key === '?') {
        e.preventDefault();
        setShowShortcuts((prev) => !prev);
      } else if (e.key === 't' || e.key === 'T') {
        e.preventDefault();
        setShowTagManager((prev) => !prev);
      } else if (e.key === '0') {
        setSelectedFilter('ALL');
      } else if (e.key === '1') {
        setSelectedFilter('BUG');
      } else if (e.key === '2') {
        setSelectedFilter('TASK');
      } else if (e.key === '3') {
        setSelectedFilter('FIX');
      } else if (e.key === '4') {
        setSelectedFilter('EVIDENCE');
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    const boardEl = boardRef.current;
    if (!boardEl) return;

    const handleWheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) {
        e.preventDefault();
        const boardRect = boardEl.getBoundingClientRect();
        const mouseX = e.clientX - boardRect.left;
        const mouseY = e.clientY - boardRect.top;

        const zoomFactor = e.deltaY < 0 ? 1.08 : 0.92;
        setZoom((prevZoom) => {
          const nextZoom = Math.min(2.0, Math.max(0.4, +(prevZoom * zoomFactor).toFixed(3)));
          setPan((prevPan) => {
            const worldX = (mouseX - prevPan.x) / prevZoom;
            const worldY = (mouseY - prevPan.y) / prevZoom;
            return {
              x: mouseX - worldX * nextZoom,
              y: mouseY - worldY * nextZoom,
            };
          });
          return nextZoom;
        });
      }
    };

    boardEl.addEventListener('wheel', handleWheel, { passive: false });
    return () => boardEl.removeEventListener('wheel', handleWheel);
  }, []);

  const handleTitleChange = (newTitle: string) => {
    setBoardTitle(newTitle);
    TauriBridge.saveBoardTitle(newTitle);
  };

  const handleSaveCustomTags = (newTags: CustomTag[]) => {
    setCustomTags(newTags);
    TauriBridge.saveCustomTags(newTags);
  };

  const handleAddSnippet = async () => {
    const count = nodes.length;
    const cascadeOffset = (count % 8) * 35;
    const x = Math.max(40, 80 + cascadeOffset - pan.x);
    const y = Math.max(40, 60 + cascadeOffset - pan.y);

    const newNode: SnippetNode = {
      id: 0,
      x,
      y,
      title: 'NEW_SNIPPET',
      tag: 'TASK',
      mode: 'read',
      code: '// Type snippet or attach file path above\nfunction handleInvestigation() {\n  // TODO: analyze clue\n}',
      file_path: null,
      line_start: null,
      line_end: null,
    };

    const newId = await TauriBridge.saveNode(newNode);
    newNode.id = newId;
    setNodes((prev) => [...prev, newNode]);
  };

  const handleUpdateNode = useCallback((updated: SnippetNode) => {
    setNodes((prev) => prev.map((n) => (n.id === updated.id ? updated : n)));
    TauriBridge.saveNode(updated);
  }, []);

  const handleDeleteNode = useCallback(async (id: number) => {
    await TauriBridge.deleteNode(id);
    setNodes((prev) => prev.filter((n) => n.id !== id));
    setLinks((prev) => prev.filter((l) => l.from_id !== id && l.to_id !== id));
    if (linkStart === id) {
      setLinkStart(null);
    }
  }, [linkStart]);

  const handleToggleLink = useCallback(async (id: number) => {
    if (linkStart === null) {
      setLinkStart(id);
    } else if (linkStart === id) {
      setLinkStart(null);
    } else {
      const fromId = linkStart;
      const toId = id;
      const linkId = await TauriBridge.addLink(fromId, toId);
      if (linkId > 0) {
        setLinks((prev) => [...prev, { id: linkId, from_id: fromId, to_id: toId }]);
      }
      setLinkStart(null);
    }
  }, [linkStart]);

  const handleDeleteLink = useCallback(async (fromId: number, toId: number) => {
    await TauriBridge.deleteLinkBetween(fromId, toId);
    setLinks((prev) =>
      prev.filter(
        (l) => !((l.from_id === fromId && l.to_id === toId) || (l.from_id === toId && l.to_id === fromId))
      )
    );
  }, []);

  const handleMouseDownHeader = (e: React.MouseEvent, id: number) => {
    if (e.button !== 0) return;
    const targetNode = nodes.find((n) => n.id === id);
    if (!targetNode || !boardRef.current) return;

    const boardRect = boardRef.current.getBoundingClientRect();
    const cursorX = (e.clientX - boardRect.left - pan.x) / zoom;
    const cursorY = (e.clientY - boardRect.top - pan.y) / zoom;

    setDragging({
      id,
      offsetX: cursorX - targetNode.x,
      offsetY: cursorY - targetNode.y,
    });
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!boardRef.current) return;
      const boardRect = boardRef.current.getBoundingClientRect();
      const rawX = (e.clientX - boardRect.left - pan.x) / zoom;
      const rawY = (e.clientY - boardRect.top - pan.y) / zoom;

      setCursorPos({ x: rawX, y: rawY });

      if (dragging) {
        if (rafRef.current) cancelAnimationFrame(rafRef.current);
        rafRef.current = requestAnimationFrame(() => {
          const clampedX = Math.max(10, Math.round(rawX - dragging.offsetX));
          const clampedY = Math.max(10, Math.round(rawY - dragging.offsetY));

          setNodes((prev) =>
            prev.map((n) => (n.id === dragging.id ? { ...n, x: clampedX, y: clampedY } : n))
          );
        });
      } else if (isPanning) {
        const dx = e.clientX - panStart.x;
        const dy = e.clientY - panStart.y;
        setPan((prev) => ({ x: prev.x + dx, y: prev.y + dy }));
        setPanStart({ x: e.clientX, y: e.clientY });
      }
    };

    const handleMouseUp = () => {
      if (dragging) {
        const finishedNode = nodesRef.current.find((n) => n.id === dragging.id);
        if (finishedNode) {
          TauriBridge.saveNode(finishedNode);
        }
        setDragging(null);
      }
      if (isPanning) {
        setIsPanning(false);
      }
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [dragging, isPanning, panStart, pan, zoom]);

  const handleBoardMouseDown = (e: React.MouseEvent) => {
    if (e.button === 1 || (e.button === 0 && e.altKey)) {
      e.preventDefault();
      setIsPanning(true);
      setPanStart({ x: e.clientX, y: e.clientY });
    }
  };

  const handleAutoRelayout = () => {
    const spacingX = 320;
    const spacingY = 260;
    const cols = Math.max(2, Math.floor((window.innerWidth - 100) / spacingX));

    const updated = nodes.map((node, idx) => {
      const col = idx % cols;
      const row = Math.floor(idx / cols);
      return {
        ...node,
        x: 60 + col * spacingX,
        y: 40 + row * spacingY,
      };
    });

    setNodes(updated);
    updated.forEach((n) => TauriBridge.saveNode(n));
  };

  const handleExport = async () => {
    const json = await TauriBridge.exportBoard();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 	hread_trace_.json;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportDossier = () => {
    const md = generateInvestigationMarkdown({
      title: boardTitle,
      nodes,
      links,
      repo_watch: repoWatch,
    });
    const blob = new Blob([md], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = investigation_dossier_.md;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        const text = await file.text();
        const data = await TauriBridge.importBoard(text);
        setNodes(data.nodes || []);
        setLinks(data.links || []);
        if (data.title) setBoardTitle(data.title);
        if (data.custom_tags) setCustomTags(data.custom_tags);
      }
    };
    input.click();
  };

  const handleWatchRepo = async (path: string) => {
    const info = await TauriBridge.watchRepo(path);
    setRepoWatch(info);
  };

  const filteredNodes = useMemo(() => {
    return nodes.filter((n) => {
      if (selectedFilter !== 'ALL' && n.tag !== selectedFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchTitle = n.title.toLowerCase().includes(q);
        const matchCode = (n.code || '').toLowerCase().includes(q);
        const matchFile = (n.file_path || '').toLowerCase().includes(q);
        const matchTag = n.tag.toLowerCase().includes(q);
        return matchTitle || matchCode || matchFile || matchTag;
      }
      return true;
    });
  }, [nodes, selectedFilter, searchQuery]);

  const tagCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const t of customTags) {
      counts[t.id] = 0;
    }
    for (const n of nodes) {
      counts[n.tag] = (counts[n.tag] || 0) + 1;
    }
    return counts;
  }, [nodes, customTags]);

  const activeEditors = useMemo(() => {
    return nodes.filter((n) => n.mode === 'write').length;
  }, [nodes]);

  return (
    <div className="snippet-board-container">
      <div className="crt-scanline-overlay" />
      <div className="crt-flicker-vignette" />

      <Masthead
        title={boardTitle}
        onTitleChange={handleTitleChange}
        nodeCount={nodes.length}
        linkCount={links.length}
        tagCounts={tagCounts}
        selectedFilter={selectedFilter}
        onSelectFilter={setSelectedFilter}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        onAddSnippet={handleAddSnippet}
        onAutoRelayout={handleAutoRelayout}
        onExport={handleExport}
        onExportDossier={handleExportDossier}
        onImport={handleImport}
        onOpenShortcuts={() => setShowShortcuts(true)}
        onOpenTagManager={() => setShowTagManager(true)}
        customTags={customTags}
        repoWatch={repoWatch}
        onWatchRepo={handleWatchRepo}
        isTauri={isTauri}
      />

      <Minimap
        nodes={nodes}
        links={links}
        pan={pan}
        zoom={zoom}
        onNavigate={(nx, ny) => setPan({ x: nx, y: ny })}
        customTags={customTags}
      />

      <div className="canvas-hud-controls">
        <button
          className="hud-btn"
          onClick={() => setZoom((z) => Math.min(2.0, +(z + 0.1).toFixed(2)))}
          title="Zoom In"
        >
          <ZoomIn size={14} />
        </button>
        <span className="hud-zoom-label">{Math.round(zoom * 100)}%</span>
        <button
          className="hud-btn"
          onClick={() => setZoom((z) => Math.max(0.4, +(z - 0.1).toFixed(2)))}
          title="Zoom Out"
        >
          <ZoomOut size={14} />
        </button>
        <button
          className="hud-btn"
          onClick={() => {
            setZoom(1.0);
            setPan({ x: 0, y: 0 });
          }}
          title="Reset View"
        >
          <Maximize2 size={14} />
        </button>
      </div>

      <main
        ref={boardRef}
        className={`investigation-board ${isPanning ? 'is-panning-canvas' : ''}`}
        onMouseDown={handleBoardMouseDown}
      >
        <div
          className="canvas-transform-layer"
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
            transformOrigin: '0 0',
          }}
        >

          <SvgLinkLayer
            nodes={nodes}
            links={links}
            linkStart={linkStart}
            cursorPos={cursorPos}
            onDeleteLink={handleDeleteLink}
          />

          {filteredNodes.map((node) => (
            <SnippetCard
              key={node.id}
              node={node}
              isArmed={linkStart === node.id}
              isDragging={dragging?.id === node.id}
              onMouseDownHeader={handleMouseDownHeader}
              onUpdateNode={handleUpdateNode}
              onDeleteNode={handleDeleteNode}
              onToggleLink={handleToggleLink}
              customTags={customTags}
              onOpenTagManager={() => setShowTagManager(true)}
            />
          ))}
        </div>
      </main>

      {showTagManager && (
        <TagManagerModal
          tags={customTags}
          onSaveTags={handleSaveCustomTags}
          onClose={() => setShowTagManager(false)}
        />
      )}

      {showShortcuts && <ShortcutsModal onClose={() => setShowShortcuts(false)} />}

      <footer className="board-status-footer">
        <div className="footer-left">
          <SystemTelemetryHUD
            nodeCount={nodes.length}
            linkCount={links.length}
            activeEditorCount={activeEditors}
            zoom={zoom}
            pan={pan}
          />
        </div>
        <div className="footer-right">
          <span className="shortcut-badge">N: ADD</span>
          <span className="shortcut-badge">T: TAGS</span>
          <span className="shortcut-badge">CTRL+WHEEL: ZOOM</span>
          <span className="shortcut-badge">ALT+DRAG: PAN</span>
          <span className="shortcut-badge">?: CHEATSHEET</span>
        </div>
      </footer>
    </div>
  );
};

