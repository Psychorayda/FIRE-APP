// 全局错误边界：捕获子树渲染错误，展示兜底 UI + 重试按钮
// Global error boundary: catch subtree render errors, show fallback UI + retry

import { Component, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
}
interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    // 生产环境可在此上报错误；当前仅保留钩子
    // Production error reporting hook goes here; left intentionally minimal
    console.error('[ErrorBoundary] 捕获渲染错误:', error, errorInfo);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 p-8">
          <div className="max-w-md w-full bg-white rounded-lg shadow p-6 text-center">
            <div className="text-red-500 text-4xl mb-4">⚠</div>
            <h1 className="text-lg font-semibold text-gray-900 mb-2">出现错误</h1>
            <p className="text-sm text-gray-600 mb-4">
              应用遇到意外错误。您可以尝试重试，或重启应用。
            </p>
            {this.state.error && (
              <pre className="text-xs text-gray-400 bg-gray-50 p-2 rounded mb-4 overflow-auto max-h-32">
                {this.state.error.message}
              </pre>
            )}
            <button
              onClick={this.handleRetry}
              className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700"
            >
              重试
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
