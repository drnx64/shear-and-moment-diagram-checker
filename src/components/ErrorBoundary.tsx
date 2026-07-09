import { Component, useEffect, useState } from 'react';
import type { ReactNode, ErrorInfo } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  info: string;
}

class ReactErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null, info: '' };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    this.setState({ info: info.componentStack ?? '' });
    console.error('[ErrorBoundary] Caught:', error, info);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null, info: '' });
  };

  render() {
    if (this.state.hasError) {
      return (
        <ErrorFallback
          error={this.state.error}
          info={this.state.info}
          onReset={this.handleReset}
        />
      );
    }
    return this.props.children;
  }
}

function ErrorFallback({ error, info, onReset }: { error: Error | null; info: string; onReset: () => void }) {
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
      <div className="max-w-lg w-full bg-white rounded-xl border border-red-200 shadow-lg overflow-hidden">
        <div className="bg-red-600 px-5 py-4 flex items-center gap-3">
          <AlertTriangle size={22} className="text-white shrink-0" />
          <div>
            <h2 className="text-sm font-bold text-white">Application Error</h2>
            <p className="text-[11px] text-red-100">A critical error occurred. The application cannot continue.</p>
          </div>
        </div>
        <div className="p-5 space-y-3">
          <div className="bg-red-50 border border-red-100 rounded-lg p-3">
            <div className="text-[10px] font-semibold text-red-700 uppercase tracking-wider mb-1">Error Message</div>
            <div className="text-xs font-mono text-red-800 break-words">
              {error?.message || 'Unknown error'}
            </div>
          </div>
          {error?.name && (
            <div className="text-[10px] text-slate-500 font-mono">
              {error.name}
            </div>
          )}
          {info && (
            <div className="bg-slate-50 rounded-lg p-3 max-h-32 overflow-y-auto">
              <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">Component Stack</div>
              <pre className="text-[10px] font-mono text-slate-400 whitespace-pre-wrap">{info}</pre>
            </div>
          )}
          {error?.stack && (
            <div className="bg-slate-50 rounded-lg p-3 max-h-40 overflow-y-auto">
              <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">Stack Trace</div>
              <pre className="text-[10px] font-mono text-slate-400 whitespace-pre-wrap">{error.stack}</pre>
            </div>
          )}
          <button onClick={onReset}
            className="flex items-center justify-center gap-2 w-full py-2.5 text-xs font-semibold text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors">
            <RefreshCw size={14} /> Reload Application
          </button>
        </div>
      </div>
    </div>
  );
}

interface GlobalErrorWatcherProps {
  children: ReactNode;
  onError: (error: Error) => void;
}

function GlobalErrorWatcher({ children, onError }: GlobalErrorWatcherProps) {
  useEffect(() => {
    const handleGlobalError = (event: ErrorEvent) => {
      event.preventDefault();
      const err = event.error || new Error(event.message);
      console.error('[GlobalErrorWatcher] Caught:', err);
      onError(err);
    };

    const handleRejection = (event: PromiseRejectionEvent) => {
      event.preventDefault();
      const err = event.reason instanceof Error ? event.reason : new Error(String(event.reason));
      console.error('[GlobalErrorWatcher] Unhandled rejection:', err);
      onError(err);
    };

    window.addEventListener('error', handleGlobalError);
    window.addEventListener('unhandledrejection', handleRejection);
    return () => {
      window.removeEventListener('error', handleGlobalError);
      window.removeEventListener('unhandledrejection', handleRejection);
    };
  }, [onError]);

  return <>{children}</>;
}

export default function ErrorBoundary({ children }: Props) {
  const [globalError, setGlobalError] = useState<Error | null>(null);

  if (globalError) {
    return (
      <ErrorFallback
        error={globalError}
        info=""
        onReset={() => {
          setGlobalError(null);
          window.location.reload();
        }}
      />
    );
  }

  return (
    <ReactErrorBoundary>
      <GlobalErrorWatcher onError={setGlobalError}>
        {children}
      </GlobalErrorWatcher>
    </ReactErrorBoundary>
  );
}
