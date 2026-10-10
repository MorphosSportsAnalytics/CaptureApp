import React from "react"
import { recordBootError } from "@/diagnostics/bootLog"

type AppErrorBoundaryProps = {
  children: React.ReactNode
  fallback: (error: Error, retry: () => void) => React.ReactNode
}

type AppErrorBoundaryState = {
  error: Error | null
}

export class AppErrorBoundary extends React.Component<AppErrorBoundaryProps, AppErrorBoundaryState> {
  state: AppErrorBoundaryState = { error: null }

  static getDerivedStateFromError(error: Error): AppErrorBoundaryState {
    return { error }
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    recordBootError(error, true, info.componentStack ?? "")
  }

  private retry = (): void => {
    this.setState({ error: null })
  }

  render(): React.ReactNode {
    if (this.state.error) {
      return this.props.fallback(this.state.error, this.retry)
    }
    return this.props.children
  }
}
