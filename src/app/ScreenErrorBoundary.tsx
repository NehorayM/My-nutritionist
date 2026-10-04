import { Component, type ReactNode } from 'react'
import { ErrorState } from '@/components/ui/ErrorState'
import { logger } from '@/lib/logger'

interface ScreenErrorBoundaryProps {
  /** Used in the log line and the message ("Progress couldn't be shown"). */
  screenName: string
  children: ReactNode
}

interface ScreenErrorBoundaryState {
  error: Error | null
}

/**
 * Contains a crash (render error or a failed lazy chunk) to one screen; the bottom navigation keeps
 * working. "Try again" re-renders the screen (lazy screens re-request their code).
 */
export class ScreenErrorBoundary extends Component<ScreenErrorBoundaryProps, ScreenErrorBoundaryState> {
  override state: ScreenErrorBoundaryState = { error: null }

  static getDerivedStateFromError(error: unknown): ScreenErrorBoundaryState {
    return { error: error instanceof Error ? error : new Error('Unknown render error') }
  }

  override componentDidCatch(error: unknown): void {
    logger.error('ui', `${this.props.screenName} screen failed to render`, error)
  }

  private readonly reset = (): void => {
    this.setState({ error: null })
  }

  override render(): ReactNode {
    if (!this.state.error) return this.props.children
    return (
      <ErrorState
        className="min-h-[60dvh] justify-center"
        title={`${this.props.screenName} couldn't be shown`}
        description="Your saved data is safe. Check your connection, then try again."
        onRetry={this.reset}
      />
    )
  }
}
