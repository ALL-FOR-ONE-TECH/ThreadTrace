import React, { useState, useEffect } from 'react';
import { Activity, Cpu, Layers, HardDrive, Eye, X, Terminal, Clock } from 'lucide-react';
import { TauriBridge } from '../services/tauriBridge';
import { ProcessTelemetry } from '../types/board';

interface Props {
  nodeCount: number;
  linkCount: number;
  activeEditorCount: number;
  zoom: number;
  pan: { x: number; y: number };
}

export const SystemTelemetryHUD: React.FC<Props> = ({
  nodeCount,
  linkCount,
  activeEditorCount,
  zoom,
  pan,
}) => {
  const [showModal, setShowModal] = useState(false);
  const [fps, setFps] = useState<number>(60);
  const [heapMb, setHeapMb] = useState<number>(18.5);
  const [procTel, setProcTel] = useState<ProcessTelemetry>({
    pid: 0,
    physical_memory_mb: 18.5,
    virtual_memory_mb: 32.0,
    thread_count: 4,
    uptime_seconds: 0,
  });
  const [history, setHistory] = useState<number[]>([18.2, 18.5, 18.9, 19.1, 18.6, 19.4, 18.5]);

  useEffect(() => {
    let frameCount = 0;
    let lastTime = performance.now();
    let animId: number;

    const fetchTelemetry = async () => {
      const data = await TauriBridge.getProcessTelemetry();
      setProcTel(data);
      setHistory((prev) => [...prev.slice(-19), data.physical_memory_mb]);
    };

    fetchTelemetry();
    const timer = setInterval(fetchTelemetry, 1500);

    const loop = (now: number) => {
      frameCount++;
      if (now - lastTime >= 1000) {
        setFps(Math.round((frameCount * 1000) / (now - lastTime)));
        frameCount = 0;
        lastTime = now;

        const perf = window.performance as unknown as {
          memory?: { usedJSHeapSize: number };
        };
        if (perf?.memory) {
          const currentHeap = +(perf.memory.usedJSHeapSize / (1024 * 1024)).toFixed(1);
          setHeapMb(currentHeap);
        }
      }
      animId = requestAnimationFrame(loop);
    };

    animId = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(animId);
      clearInterval(timer);
    };
  }, []);

  const formatUptime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}m ${s < 10 ? '0' : ''}${s}s`;
  };

  return (
    <>
      <div
        className="telemetry-compact-pill"
        onClick={() => setShowModal(true)}
        title="Click for Real-Time Native OS Process & Resource Diagnostics"
      >
        <span className="telemetry-live-dot" />
        {procTel.pid > 0 && (
          <>
            <span className="telemetry-label">PID:</span>
            <span className="amber-glow-text">{procTel.pid}</span>
            <span className="telemetry-sep">·</span>
          </>
        )}
        <span className="telemetry-label">RAM:</span>
        <span className="amber-glow-text">{procTel.physical_memory_mb} MB</span>
        <span className="telemetry-sep">·</span>
        <span className="telemetry-label">HEAP:</span>
        <span>{heapMb} MB</span>
        <span className="telemetry-sep">·</span>
        <span className="telemetry-label">FPS:</span>
        <span className={fps >= 45 ? 'fps-good' : 'fps-warn'}>{fps}</span>
        <span className="telemetry-sep">·</span>
        <span className="telemetry-label">THREADS:</span>
        <span>{procTel.thread_count}</span>
        <Activity size={12} className="telemetry-icon-pulse" />
      </div>

      {showModal && (
        <div className="terminal-modal-overlay" onClick={() => setShowModal(false)}>
          <div className="terminal-modal telemetry-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title telemetry-header-title">
                <Activity size={14} className="amber-glow-icon" />
                <span>[PROCESS_RESOURCE_TELEMETRY // NATIVE OS DIAGNOSTICS]</span>
              </div>
              <button className="modal-close-btn" onClick={() => setShowModal(false)}>
                <X size={14} />
              </button>
            </div>

            <div className="modal-body telemetry-body">
              <div className="telemetry-stats-grid">
                <div className="telemetry-stat-card">
                  <div className="stat-header">
                    <Terminal size={13} />
                    <span>PROCESS ID (PID)</span>
                  </div>
                  <div className="stat-big-val">
                    {procTel.pid > 0 ? procTel.pid : 'STANDALONE'}
                  </div>
                  <div className="stat-sub">Native OS ThreadTrace Process Handle</div>
                </div>

                <div className="telemetry-stat-card">
                  <div className="stat-header">
                    <HardDrive size={13} />
                    <span>PHYSICAL RAM (RSS)</span>
                  </div>
                  <div className="stat-big-val">
                    {procTel.physical_memory_mb} <span className="stat-unit">MB</span>
                  </div>
                  <div className="stat-sub">Working Set Physical Memory Allocation</div>
                </div>

                <div className="telemetry-stat-card">
                  <div className="stat-header">
                    <Layers size={13} />
                    <span>VIRTUAL COMMIT</span>
                  </div>
                  <div className="stat-big-val">
                    {procTel.virtual_memory_mb} <span className="stat-unit">MB</span>
                  </div>
                  <div className="stat-sub">Virtual Memory Pagefile Footprint</div>
                </div>

                <div className="telemetry-stat-card">
                  <div className="stat-header">
                    <Clock size={13} />
                    <span>PROCESS UPTIME</span>
                  </div>
                  <div className="stat-big-val">
                    {formatUptime(procTel.uptime_seconds)}
                  </div>
                  <div className="stat-sub">{procTel.thread_count} Active Operating System Threads</div>
                </div>

                <div className="telemetry-stat-card">
                  <div className="stat-header">
                    <Cpu size={13} />
                    <span>REFRESH RATE</span>
                  </div>
                  <div className="stat-big-val">
                    {fps} <span className="stat-unit">FPS</span>
                  </div>
                  <div className="stat-sub">60Hz Hardware Accelerated Canvas</div>
                </div>

                <div className="telemetry-stat-card">
                  <div className="stat-header">
                    <Eye size={13} />
                    <span>CANVAS ARTIFACTS</span>
                  </div>
                  <div className="stat-big-val">
                    {nodeCount} <span className="stat-unit">NODES / {linkCount} LINKS</span>
                  </div>
                  <div className="stat-sub">{activeEditorCount} Active CodeMirror 6 Editor(s)</div>
                </div>
              </div>

              <div className="telemetry-chart-container">
                <div className="chart-header">
                  <span>LIVE PHYSICAL RAM ALLOCATION TRACKER (MB)</span>
                  <span className="chart-live-badge">NATIVE TELEMETRY</span>
                </div>
                <div className="sparkline-track">
                  {history.map((val, idx) => {
                    const min = 10;
                    const max = 40;
                    const pct = Math.min(100, Math.max(15, ((val - min) / (max - min)) * 100));
                    return (
                      <div key={idx} className="sparkline-bar-col" title={`${val} MB Physical RSS`}>
                        <div className="sparkline-bar" style={{ height: `${pct}%` }} />
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="telemetry-viewport-info">
                <div className="vp-row">
                  <span className="vp-label">CANVAS ZOOM:</span>
                  <span className="vp-val">{Math.round(zoom * 100)}%</span>
                  <span className="vp-sep">|</span>
                  <span className="vp-label">PAN OFFSET:</span>
                  <span className="vp-val">X: {Math.round(pan.x)}px, Y: {Math.round(pan.y)}px</span>
                  <span className="vp-sep">|</span>
                  <span className="vp-label">PERSISTENCE:</span>
                  <span className="vp-val text-green">ACID SQLITE (WAL MODE)</span>
                </div>
              </div>
            </div>

            <div className="modal-footer">
              <button
                type="button"
                className="terminal-btn primary-btn"
                onClick={() => setShowModal(false)}
              >
                CLOSE TELEMETRY [ESC]
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
