import { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Trash2 } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class RetroErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      error,
      errorInfo: null,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('RetroErrorBoundary caught an unhandled exception:', error, errorInfo);
    this.setState({
      error,
      errorInfo,
    });
  }

  handleRecover = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  handleHardReset = () => {
    try {
      localStorage.clear();
      window.location.reload();
    } catch {
      window.location.reload();
    }
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="retro-error-boundary-screen">
          <div className="crt-scanline-overlay" />
          <div className="crt-flicker-vignette" />

          <div className="retro-error-card">
            <div className="error-card-header">
              <AlertTriangle size={24} className="error-pulse-icon" />
              <h2>[SYSTEM_FAULT // COMPONENT_RENDER_EXCEPTION]</h2>
            </div>

            <p className="error-summary-text">
              An unexpected render fault was intercepted by ThreadTrace Error Barrier.
              The application state was preserved in SQLite without crashing the host process.
            </p>

            <div className="error-terminal-output">
              <div className="error-msg-line">
                <span className="err-prefix">FATAL: </span>
                <span className="err-body">{this.state.error?.message || 'Unknown Exception'}</span>
              </div>
              {this.state.error?.stack && (
                <pre className="error-stack-trace">
                  {this.state.error.stack.split('\n').slice(0, 8).join('\n')}
                </pre>
              )}
            </div>

            <div className="error-card-actions">
              <button
                type="button"
                className="terminal-btn primary-btn"
                onClick={this.handleRecover}
              >
                <RefreshCw size={14} />
                <span>⚡ RECOVER CANVAS</span>
              </button>

              <button
                type="button"
                className="terminal-btn"
                onClick={this.handleHardReset}
              >
                <Trash2 size={14} />
                <span>🧹 CLEAR CACHE & RELOAD</span>
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
