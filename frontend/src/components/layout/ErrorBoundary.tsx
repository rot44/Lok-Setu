import { Component, ErrorInfo, ReactNode } from "react";
import { AlertTriangle, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/Button";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught React error in Lok-Setu:", error, errorInfo);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
    window.location.href = "/";
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center p-6 bg-paper">
          <div className="max-w-md w-full bg-white border border-paper-border rounded-lg shadow-editorial-lg p-8 text-center space-y-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-vermilion/10 text-vermilion mx-auto">
              <AlertTriangle className="h-8 w-8" />
            </div>
            <h2 className="font-serif text-2xl font-bold text-neel">
              Something went wrong
            </h2>
            <p className="text-sm text-neel-muted leading-relaxed">
              An unexpected error occurred while rendering this civic view. Please reload or return to the main portal.
            </p>
            {this.state.error?.message && (
              <pre className="text-xs text-left bg-paper-dark p-3 rounded overflow-x-auto text-vermilion font-mono">
                {this.state.error.message}
              </pre>
            )}
            <div className="pt-2">
              <Button
                variant="primary"
                onClick={this.handleReset}
                leftIcon={<RotateCcw className="h-4 w-4" />}
              >
                Reload Application
              </Button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
