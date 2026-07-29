import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, WifiOff, Home, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      const isOfflineModuleError = 
        this.state.error?.message?.includes('dynamically imported module') ||
        this.state.error?.message?.includes('fetch') ||
        !navigator.onLine;

      return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
          <div className="text-center p-8 max-w-md bg-white rounded-3xl border border-slate-200 shadow-xl space-y-4">
            {isOfflineModuleError ? (
              <WifiOff className="h-14 w-14 text-amber-500 mx-auto" />
            ) : (
              <AlertTriangle className="h-14 w-14 text-rose-500 mx-auto" />
            )}

            <h1 className="text-xl font-bold text-slate-900">
              {isOfflineModuleError ? 'Page Not Cached Offline' : 'Something went wrong'}
            </h1>

            <p className="text-xs text-slate-600 leading-relaxed">
              {isOfflineModuleError
                ? 'This page module was not loaded while online. Connect to the network once to cache all pages, or return to Dashboard.'
                : (this.state.error?.message || 'An unexpected error occurred')}
            </p>

            <div className="flex items-center justify-center gap-3 pt-2">
              <button
                onClick={() => {
                  this.setState({ hasError: false, error: undefined });
                  window.location.reload();
                }}
                className="px-4 py-2 bg-slate-100 text-slate-700 hover:bg-slate-200 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors"
              >
                <RefreshCw className="w-3.5 h-3.5" /> Retry
              </button>

              <button
                onClick={() => {
                  this.setState({ hasError: false, error: undefined });
                  window.location.hash = '#/';
                }}
                className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-sm"
              >
                <Home className="w-3.5 h-3.5" /> Go to Dashboard
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
