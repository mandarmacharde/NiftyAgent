import { Component } from 'react'

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  render() {
    if (this.state.error) {
      return (
        <div className="card border-red-800 bg-red-950/30">
          <p className="text-sm font-medium text-red-400">Component Error</p>
          <p className="mt-1 text-xs text-red-300/70">{this.state.error.message}</p>
          <button
            onClick={() => this.setState({ error: null })}
            className="mt-3 rounded bg-red-800 px-3 py-1 text-xs text-red-200 hover:bg-red-700"
          >
            Retry
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
