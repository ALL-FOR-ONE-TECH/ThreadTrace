import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  SnippetNode,
  SnippetLink,
  TagType,
  DraggingState,
  ResizingState,
  RepoWatchInfo,
  CustomTag,
  DEFAULT_TAGS,
} from '../types/board';
import { TauriBridge, isTauriEnv } from '../services/tauriBridge';
import { Masthead } from './Masthead';
import { SnippetCard } from './SnippetCard';
import { SvgLinkLayer } from '../canvas/SvgLinkLayer';
import { Minimap } from '../canvas/Minimap';
import { ShortcutsModal } from './ShortcutsModal';
import { TagManagerModal } from './TagManagerModal';
import { CommandPaletteModal } from './CommandPaletteModal';
import { FilePickerModal } from './FilePickerModal';
import { ProjectExplorerDrawer } from './ProjectExplorerDrawer';
import { SystemTelemetryHUD } from './SystemTelemetryHUD';
import { generateInvestigationMarkdown } from '../services/dossierExport';
import { generateInvestigationHtml } from '../services/htmlDossierExport';
import { ZoomIn, ZoomOut, Maximize2, Plus, Sparkles, FolderSearch, FolderOpen } from 'lucide-react';

export const SnippetBoard: React.FC = () => {
  const [boardTitle, setBoardTitle] = useState<string>('THREAD_TRACE // NEW_INVESTIGATION');
  const [nodes, setNodes] = useState<SnippetNode[]>([]);
  const [links, setLinks] = useState<SnippetLink[]>([]);
  const [customTags, setCustomTags] = useState<CustomTag[]>(DEFAULT_TAGS);
  const [linkStart, setLinkStart] = useState<number | null>(null);
  const [dragging, setDragging] = useState<DraggingState | null>(null);
  const [resizing, setResizing] = useState<ResizingState | null>(null);
  const [cursorPos, setCursorPos] = useState<{ x: number; y: number } | null>(null);
  const [selectedFilter, setSelectedFilter] = useState<TagType | 'ALL'>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [showShortcuts, setShowShortcuts] = useState<boolean>(false);
  const [showTagManager, setShowTagManager] = useState<boolean>(false);
  const [showCommandPalette, setShowCommandPalette] = useState<boolean>(false);
  const [showFilePicker, setShowFilePicker] = useState<boolean>(false);
  const [showExplorer, setShowExplorer] = useState<boolean>(false);
  const [isDemoActive, setIsDemoActive] = useState<boolean>(false);
  const [savedUserBoard, setSavedUserBoard] = useState<{
    title: string;
    nodes: SnippetNode[];
    links: SnippetLink[];
  } | null>(null);

  const [historyStack, setHistoryStack] = useState<{ nodes: SnippetNode[]; links: SnippetLink[] }[]>([]);
  const [redoStack, setRedoStack] = useState<{ nodes: SnippetNode[]; links: SnippetLink[] }[]>([]);
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
  const linksRef = useRef<SnippetLink[]>(links);
  linksRef.current = links;

  const pushHistory = useCallback((curNodes: SnippetNode[], curLinks: SnippetLink[]) => {
    setHistoryStack((prev) => [...prev.slice(-25), { nodes: curNodes, links: curLinks }]);
    setRedoStack([]);
  }, []);

  const handleUndo = useCallback(() => {
    if (historyStack.length === 0) return;
    const previous = historyStack[historyStack.length - 1];
    setRedoStack((prev) => [...prev, { nodes: nodesRef.current, links: linksRef.current }]);
    setHistoryStack((prev) => prev.slice(0, -1));
    setNodes(previous.nodes);
    setLinks(previous.links);
  }, [historyStack]);

  const handleRedo = useCallback(() => {
    if (redoStack.length === 0) return;
    const next = redoStack[redoStack.length - 1];
    setHistoryStack((prev) => [...prev, { nodes: nodesRef.current, links: linksRef.current }]);
    setRedoStack((prev) => prev.slice(0, -1));
    setNodes(next.nodes);
    setLinks(next.links);
  }, [redoStack]);

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
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        (e.target as HTMLElement).isContentEditable
      ) {
        return;
      }

      if ((e.ctrlKey || e.metaKey) && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault();
        setShowCommandPalette((p) => !p);
      } else if (e.key === '/') {
        e.preventDefault();
        setShowCommandPalette(true);
      } else if ((e.ctrlKey || e.metaKey) && !e.shiftKey && (e.key === 'z' || e.key === 'Z')) {
        e.preventDefault();
        handleUndo();
      } else if (
        ((e.ctrlKey || e.metaKey) && (e.key === 'y' || e.key === 'Y')) ||
        ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'z' || e.key === 'Z'))
      ) {
        e.preventDefault();
        handleRedo();
      } else if (e.key === 'Escape') {
        setLinkStart(null);
        setShowShortcuts(false);
        setShowTagManager(false);
        setShowCommandPalette(false);
        setShowFilePicker(false);
        setShowExplorer(false);
      } else if (e.key === 'n' || e.key === 'N') {
        e.preventDefault();
        handleAddSnippet();
      } else if (e.key === 'e' || e.key === 'E') {
        e.preventDefault();
        setShowExplorer((v) => !v);
      } else if (e.key === 'f' || e.key === 'F') {
        e.preventDefault();
        setShowFilePicker(true);
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
  }, [handleUndo, handleRedo]);

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
    pushHistory(nodes, links);
    const count = nodes.length;
    const cascadeOffset = (count % 8) * 35;
    const x = Math.max(40, 80 + cascadeOffset - pan.x);
    const y = Math.max(40, 60 + cascadeOffset - pan.y);

    const defaultTitles = [
      'AUTH_RACE_CONDITION',
      'NULL_POINTER_EXCEPTION',
      'MUTEX_LOCK_CONTENTION',
      'EVENT_LOOP_BLOCKER',
      'MEMORY_LEAK_BUFFER',
    ];
    const sampleTitle = defaultTitles[count % defaultTitles.length];

    const newNode: SnippetNode = {
      id: 0,
      x,
      y,
      width: 350,
      height: 270,
      title: `${sampleTitle}_${count + 1}`,
      tag: 'BUG',
      mode: 'read',
      code: '// Type snippet or attach file path above\nfunction handleInvestigation() {\n  // TODO: analyze clue\n}',
      notes: '',
      file_path: null,
      line_start: 1,
      line_end: 4,
      syncStatus: 'DETACHED',
      created_at: Date.now(),
      updated_at: Date.now(),
    };

    const assignedId = await TauriBridge.saveNode(newNode);
    newNode.id = assignedId;
    setNodes((prev) => [...prev, newNode]);
  };

  const handlePinFromPicker = async (data: {
    title: string;
    tag: TagType;
    code: string;
    notes: string;
    filePath: string;
    lineStart: number;
    lineEnd: number;
  }) => {
    pushHistory(nodes, links);
    const count = nodes.length;
    const cascadeOffset = (count % 8) * 35;
    const x = Math.max(40, 80 + cascadeOffset - pan.x);
    const y = Math.max(40, 60 + cascadeOffset - pan.y);

    const newNode: SnippetNode = {
      id: 0,
      x,
      y,
      width: 380,
      height: 290,
      title: data.title,
      tag: data.tag,
      mode: 'read',
      code: data.code,
      notes: data.notes || '',
      file_path: data.filePath,
      line_start: data.lineStart,
      line_end: data.lineEnd,
      syncStatus: 'SYNCED',
      created_at: Date.now(),
      updated_at: Date.now(),
    };

    const assignedId = await TauriBridge.saveNode(newNode);
    newNode.id = assignedId;
    setNodes((prev) => [...prev, newNode]);
  };

  const handleUpdateNode = useCallback(
    (updated: SnippetNode) => {
      setNodes((prev) => prev.map((n) => (n.id === updated.id ? updated : n)));
      TauriBridge.saveNode(updated);
    },
    []
  );

  const handleDeleteNode = useCallback(
    async (id: number) => {
      pushHistory(nodesRef.current, linksRef.current);
      await TauriBridge.deleteNode(id);
      setNodes((prev) => prev.filter((n) => n.id !== id));
      setLinks((prev) => prev.filter((l) => l.from_id !== id && l.to_id !== id));
      if (linkStart === id) setLinkStart(null);
    },
    [linkStart, pushHistory]
  );

  const handleToggleLink = useCallback(
    async (id: number) => {
      if (linkStart === null) {
        setLinkStart(id);
      } else if (linkStart === id) {
        setLinkStart(null);
      } else {
        const fromId = linkStart;
        const toId = id;
        pushHistory(nodesRef.current, linksRef.current);
        const linkId = await TauriBridge.addLink(fromId, toId);
        if (linkId > 0) {
          setLinks((prev) => [...prev, { id: linkId, from_id: fromId, to_id: toId }]);
        }
        setLinkStart(null);
      }
    },
    [linkStart, pushHistory]
  );

  const handleDeleteLink = useCallback(
    async (fromId: number, toId: number) => {
      pushHistory(nodesRef.current, linksRef.current);
      await TauriBridge.deleteLinkBetween(fromId, toId);
      setLinks((prev) =>
        prev.filter(
          (l) => !((l.from_id === fromId && l.to_id === toId) || (l.from_id === toId && l.to_id === fromId))
        )
      );
    },
    [pushHistory]
  );

  const handleMouseDownHeader = (e: React.MouseEvent, id: number) => {
    if (e.button !== 0) return;
    const targetNode = nodes.find((n) => n.id === id);
    if (!targetNode || !boardRef.current) return;

    pushHistory(nodesRef.current, linksRef.current);

    const boardRect = boardRef.current.getBoundingClientRect();
    const cursorX = (e.clientX - boardRect.left - pan.x) / zoom;
    const cursorY = (e.clientY - boardRect.top - pan.y) / zoom;

    setDragging({
      id,
      offsetX: cursorX - targetNode.x,
      offsetY: cursorY - targetNode.y,
    });
  };

  const handleMouseDownResize = (e: React.MouseEvent, id: number) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    const targetNode = nodes.find((n) => n.id === id);
    if (!targetNode) return;

    pushHistory(nodesRef.current, linksRef.current);

    setResizing({
      id,
      initialWidth: targetNode.width || 340,
      initialHeight: targetNode.height || 260,
      initialMouseX: e.clientX,
      initialMouseY: e.clientY,
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
      } else if (resizing) {
        if (rafRef.current) cancelAnimationFrame(rafRef.current);
        rafRef.current = requestAnimationFrame(() => {
          const dx = (e.clientX - resizing.initialMouseX) / zoom;
          const dy = (e.clientY - resizing.initialMouseY) / zoom;
          const newWidth = Math.max(260, Math.min(900, Math.round(resizing.initialWidth + dx)));
          const newHeight = Math.max(180, Math.min(800, Math.round(resizing.initialHeight + dy)));

          setNodes((prev) =>
            prev.map((n) => (n.id === resizing.id ? { ...n, width: newWidth, height: newHeight } : n))
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
      if (resizing) {
        const finishedNode = nodesRef.current.find((n) => n.id === resizing.id);
        if (finishedNode) {
          TauriBridge.saveNode(finishedNode);
        }
        setResizing(null);
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
  }, [dragging, resizing, isPanning, panStart, pan, zoom]);

  const handleBoardMouseDown = (e: React.MouseEvent) => {
    if (e.button === 1 || (e.button === 0 && e.altKey)) {
      e.preventDefault();
      setIsPanning(true);
      setPanStart({ x: e.clientX, y: e.clientY });
    }
  };

  const handleAutoRelayout = () => {
    pushHistory(nodes, links);
    const spacingX = 360;
    const spacingY = 300;
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
    a.download = `thread_trace_${Date.now()}.json`;
    a.click();
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
    a.download = `thread_trace_dossier_${Date.now()}.md`;
    a.click();
  };

  const handleExportHtmlDossier = () => {
    const html = generateInvestigationHtml({
      title: boardTitle,
      nodes,
      links,
      repo_watch: repoWatch,
    });
    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `thread_trace_report_${Date.now()}.html`;
    a.click();
  };

  const handleImport = async () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        pushHistory(nodes, links);
        const text = await file.text();
        const imported = await TauriBridge.importBoard(text);
        setNodes(imported.nodes || []);
        setLinks(imported.links || []);
        if (imported.title) setBoardTitle(imported.title);
        if (imported.custom_tags && imported.custom_tags.length > 0) setCustomTags(imported.custom_tags);
      }
    };
    input.click();
  };

  const handleNewBoard = async () => {
    if (nodes.length > 0) {
      const confirmed = window.confirm('Clear current investigation board? Unsaved layout changes will be lost.');
      if (!confirmed) return;
    }
    pushHistory(nodes, links);
    const blank = await TauriBridge.clearBoard();
    setNodes(blank.nodes);
    setLinks(blank.links);
    setBoardTitle(blank.title || 'THREAD_TRACE // NEW_INVESTIGATION');
    setIsDemoActive(false);
  };

  const handleToggleDemo = async () => {
    pushHistory(nodes, links);
    if (isDemoActive) {
      if (savedUserBoard) {
        setNodes(savedUserBoard.nodes);
        setLinks(savedUserBoard.links);
        setBoardTitle(savedUserBoard.title);
      } else {
        const blank = await TauriBridge.clearBoard();
        setNodes(blank.nodes);
        setLinks(blank.links);
        setBoardTitle(blank.title || 'THREAD_TRACE // NEW_INVESTIGATION');
      }
      setIsDemoActive(false);
    } else {
      setSavedUserBoard({
        title: boardTitle,
        nodes,
        links,
      });
      const demo = await TauriBridge.loadDemoData();
      setNodes(demo.nodes);
      setLinks(demo.links);
      setBoardTitle(demo.title || 'THREAD_TRACE // AUTH_INVESTIGATION');
      if (demo.repo_watch) setRepoWatch(demo.repo_watch);
      setIsDemoActive(true);
    }
  };

  const handleWatchRepo = async (path: string) => {
    const info = await TauriBridge.watchRepo(path);
    setRepoWatch(info);
  };

  const tagCounts = useMemo(() => {
    const counts: Record<string, number> = {
      BUG: 0,
      TASK: 0,
      FIX: 0,
      EVIDENCE: 0,
    };
    customTags.forEach((t) => {
      counts[t.id] = 0;
    });
    nodes.forEach((n) => {
      counts[n.tag] = (counts[n.tag] || 0) + 1;
    });
    return counts;
  }, [nodes, customTags]);

  const filteredByTagNodes = useMemo(() => {
    if (selectedFilter === 'ALL') return nodes;
    return nodes.filter((n) => n.tag === selectedFilter);
  }, [nodes, selectedFilter]);

  const nodeMatchesSearch = (n: SnippetNode, query: string): boolean => {
    if (!query.trim()) return true;
    const q = query.toLowerCase();
    return (
      n.title.toLowerCase().includes(q) ||
      (n.code && n.code.toLowerCase().includes(q)) ||
      (n.notes && n.notes.toLowerCase().includes(q)) ||
      (n.file_path && n.file_path.toLowerCase().includes(q)) ||
      n.tag.toLowerCase().includes(q)
    );
  };

  const handleFocusNode = (nodeId: number) => {
    const target = nodes.find((n) => n.id === nodeId);
    if (!target) return;

    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const targetX = viewportWidth / 2 - (target.x + 160) * zoom;
    const targetY = viewportHeight / 2 - (target.y + 130) * zoom;

    setPan({ x: Math.round(targetX), y: Math.round(targetY) });
  };

  const activeEditors = useMemo(() => nodes.filter((n) => n.mode === 'write').length, [nodes]);

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
        onOpenFilePicker={() => setShowFilePicker(true)}
        onOpenExplorer={() => setShowExplorer((v) => !v)}
        isDemoActive={isDemoActive}
        onNewBoard={handleNewBoard}
        onLoadDemo={handleToggleDemo}
        onAutoRelayout={handleAutoRelayout}
        onExport={handleExport}
        onExportDossier={handleExportDossier}
        onExportHtmlDossier={handleExportHtmlDossier}
        onOpenCommandPalette={() => setShowCommandPalette(true)}
        onImport={handleImport}
        onOpenShortcuts={() => setShowShortcuts(true)}
        onOpenTagManager={() => setShowTagManager(true)}
        customTags={customTags}
        repoWatch={repoWatch}
        onWatchRepo={handleWatchRepo}
        isTauri={isTauri}
      />

      {/* Project File Tree Explorer Drawer */}
      <ProjectExplorerDrawer
        isOpen={showExplorer}
        onClose={() => setShowExplorer(false)}
        currentRepoPath={repoWatch?.path}
        onWatchRepo={handleWatchRepo}
        onPinClue={handlePinFromPicker}
        customTags={customTags}
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

          {nodes.length === 0 && (
            <div className="empty-canvas-welcome-banner">
              <div className="empty-banner-header">
                <FolderSearch size={24} className="amber-glow-icon" />
                <h2>[CANVAS_EMPTY // READY FOR CLUES]</h2>
              </div>
              <p className="empty-banner-text">
                No investigation clues pinned to this evidence board yet.
                Open the Project File Tree Explorer (<kbd>E</kbd>) to slice code, pin hypotheses, or load the demo case.
              </p>
              <div className="empty-banner-actions">
                <button
                  type="button"
                  className="terminal-btn"
                  onClick={() => setShowExplorer(true)}
                >
                  <FolderOpen size={14} />
                  <span>📁 EXPLORE PROJECT TREE (E)</span>
                </button>
                <button
                  type="button"
                  className="terminal-btn primary-btn"
                  onClick={handleAddSnippet}
                >
                  <Plus size={14} />
                  <span>+ PIN FIRST CLUE (N)</span>
                </button>
                <button
                  type="button"
                  className="terminal-btn"
                  onClick={handleToggleDemo}
                >
                  <Sparkles size={14} />
                  <span>⚡ LOAD DEMO CASE</span>
                </button>
              </div>
            </div>
          )}

          {filteredByTagNodes.map((node) => {
            const matches = nodeMatchesSearch(node, searchQuery);
            const isDimmed = !!searchQuery.trim() && !matches;
            const isHighlighted = !!searchQuery.trim() && matches;
            return (
              <SnippetCard
                key={node.id}
                node={node}
                isArmed={linkStart === node.id}
                isDragging={dragging?.id === node.id}
                isDimmed={isDimmed}
                isHighlighted={isHighlighted}
                onMouseDownHeader={handleMouseDownHeader}
                onMouseDownResize={handleMouseDownResize}
                onUpdateNode={handleUpdateNode}
                onDeleteNode={handleDeleteNode}
                onToggleLink={handleToggleLink}
                customTags={customTags}
                onOpenTagManager={() => setShowTagManager(true)}
              />
            );
          })}
        </div>
      </main>

      {showFilePicker && (
        <FilePickerModal
          isOpen={showFilePicker}
          onClose={() => setShowFilePicker(false)}
          onPinClue={handlePinFromPicker}
          repoPath={repoWatch?.path}
          customTags={customTags}
        />
      )}

      {showTagManager && (
        <TagManagerModal
          tags={customTags}
          onSaveTags={handleSaveCustomTags}
          onClose={() => setShowTagManager(false)}
        />
      )}

      {showShortcuts && <ShortcutsModal onClose={() => setShowShortcuts(false)} />}

      {showCommandPalette && (
        <CommandPaletteModal
          nodes={nodes}
          onSelectNode={(node) => handleFocusNode(node.id)}
          onAddSnippet={handleAddSnippet}
          onLoadDemo={handleToggleDemo}
          onClearBoard={handleNewBoard}
          onAutoRelayout={handleAutoRelayout}
          onExportHtml={handleExportHtmlDossier}
          onExportMarkdown={handleExportDossier}
          onExportJson={handleExport}
          onOpenTagManager={() => setShowTagManager(true)}
          onOpenShortcuts={() => setShowShortcuts(true)}
          onSetFilter={setSelectedFilter}
          onClose={() => setShowCommandPalette(false)}
        />
      )}

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
          <span className="shortcut-badge">E: EXPLORER</span>
          <span className="shortcut-badge">F: ATTACH FILE</span>
          <span className="shortcut-badge">CTRL+K: PALETTE</span>
          <span className="shortcut-badge">CTRL+Z: UNDO</span>
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
