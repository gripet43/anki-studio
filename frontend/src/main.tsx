import React, { Component, ErrorInfo, ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[Anki Studio Crash Caught]', error, errorInfo);
    this.setState({ errorInfo });
    try {
      if ((window as any).pycmd) {
        (window as any).pycmd(`modern_anki:log_error:${error.message}`);
      }
    } catch {}
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          padding: '40px 32px',
          fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Text", monospace',
          color: '#FF453A',
          background: '#16161A',
          height: '100vh',
          overflow: 'auto',
          boxSizing: 'border-box'
        }}>
          <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8, color: '#FF453A' }}>
            ⚠️ 渲染异常 (Render Error)
          </h2>
          <p style={{ fontSize: 13, color: '#A1A1A6', marginBottom: 20 }}>
            Anki Studio 捕捉到了一个未处理的运行时错误：
          </p>
          <div style={{
            padding: 16,
            background: 'rgba(255, 69, 58, 0.1)',
            borderRadius: 12,
            border: '1px solid rgba(255, 69, 58, 0.3)',
            marginBottom: 20,
            fontSize: 14,
            fontWeight: 600,
            color: '#FF6961'
          }}>
            {this.state.error?.name}: {this.state.error?.message}
          </div>
          <pre style={{
            fontSize: 12,
            lineHeight: 1.6,
            color: '#E5E5EA',
            background: 'rgba(255,255,255,0.05)',
            padding: 16,
            borderRadius: 12,
            overflowX: 'auto',
            whiteSpace: 'pre-wrap'
          }}>
            {this.state.error?.stack}
          </pre>
          {this.state.errorInfo?.componentStack && (
            <pre style={{
              fontSize: 11,
              marginTop: 16,
              color: '#8E8E93',
              background: 'rgba(255,255,255,0.02)',
              padding: 16,
              borderRadius: 12,
              overflowX: 'auto',
              whiteSpace: 'pre-wrap'
            }}>
              {this.state.errorInfo.componentStack}
            </pre>
          )}
        </div>
      );
    }
    return this.props.children;
  }
}

const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  root.render(
    <React.StrictMode>
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    </React.StrictMode>
  );
}
