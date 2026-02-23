import { Component } from 'react'

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, errorInfo) {
    if (import.meta.env.DEV) {
      console.error('ErrorBoundary caught:', error, errorInfo)
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="card" style={{ margin: 16, textAlign: 'center' }}>
          <h2 style={{ color: 'var(--danger)' }}>Something went wrong</h2>
          <pre style={{ whiteSpace: 'pre-wrap', fontSize: 13, marginTop: 12, color: 'var(--text)', textAlign: 'left' }}>
            {this.state.error?.message || 'Unknown error'}
          </pre>
          <button
            className="btn btn-primary btn-block"
            onClick={() => this.setState({ hasError: false, error: null })}
          >
            Try Again
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
