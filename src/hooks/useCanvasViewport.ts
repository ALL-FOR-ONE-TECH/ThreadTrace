import { useState, useRef, useCallback, useEffect } from 'react';

export const MIN_ZOOM = 0.5;
export const MAX_ZOOM = 1.5;

export interface Viewport { pan: { x: number; y: number }; zoom: number }

/**
 * useCanvasViewport — pan (Alt/Space/middle-drag) + cursor-centered zoom.
 * Encapsulates the rAF-throttled pan loop so SnippetBoard stays lean.
 */
export function useCanvasViewport(boardRef: React.RefObject<HTMLDivElement | null>) {
  const [zoom, setZoom] = useState<number>(1.0);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const rafRef = useRef<number | null>(null);

  const zoomRef = useRef(zoom);
  zoomRef.current = zoom;
  const panRef = useRef(pan);
  panRef.current = pan;

  const handleZoomAtCursor = useCallback((e: React.WheelEvent | WheelEvent) => {
    const ctrl = (e as React.WheelEvent).ctrlKey ?? (e as WheelEvent).ctrlKey;
    if (!ctrl || !boardRef.current) return;
    e.preventDefault();
    const rect = boardRef.current.getBoundingClientRect();
    const mouseX = (e as React.WheelEvent).clientX - rect.left;
    const mouseY = (e as React.WheelEvent).clientY - rect.top;
    setZoom((prevZoom) => {
      const delta = (e as React.WheelEvent).deltaY > 0 ? -0.08 : 0.08;
      const newZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, +(prevZoom + delta).toFixed(2)));
      if (newZoom !== prevZoom) {
        const scale = newZoom / prevZoom;
        setPan((prevPan) => ({
          x: mouseX - (mouseX - prevPan.x) * scale,
          y: mouseY - (mouseY - prevPan.y) * scale,
        }));
      }
      return newZoom;
    });
  }, [boardRef]);

  // Non-passive wheel listener so Ctrl+Wheel zoom can preventDefault.
  useEffect(() => {
    const el = boardRef.current;
    if (!el) return;
    const native = (e: WheelEvent) => handleZoomAtCursor(e as unknown as React.WheelEvent);
    el.addEventListener('wheel', native, { passive: false });
    return () => el.removeEventListener('wheel', native);
  }, [boardRef, handleZoomAtCursor]);

  const beginPan = useCallback((startX: number, startY: number) => {
    setIsPanning(true);
    setPanStart({ x: startX - panRef.current.x, y: startY - panRef.current.y });
  }, []);

  const movePan = useCallback((clientX: number, clientY: number) => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    const sx = clientX;
    const sy = clientY;
    rafRef.current = requestAnimationFrame(() => {
      setPanStart((ps) => {
        setPan({ x: sx - ps.x, y: sy - ps.y });
        return ps;
      });
    });
  }, []);

  const endPan = useCallback(() => {
    setIsPanning(false);
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  }, []);

  useEffect(() => () => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
  }, []);

  const zoomStep = useCallback((dir: 1 | -1) => {
    setZoom((z) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, +(z + dir * 0.1).toFixed(2))));
  }, []);

  return {
    zoom, setZoom, pan, setPan,
    isPanning, panStart, zoomRef, panRef,
    handleZoomAtCursor, beginPan, movePan, endPan, zoomStep,
  };
}
