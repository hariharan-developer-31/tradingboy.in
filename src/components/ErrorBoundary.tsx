import { Component, type ErrorInfo, type ReactNode } from 'react';

type Props = { children: ReactNode };
type State = { failed: boolean };

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  componentDidCatch(_error: Error, _info: ErrorInfo) {
    // Avoid exposing client state or user data through production console logs.
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <main className="flex min-h-screen items-center justify-center bg-ink p-6 text-white">
        <section className="w-full max-w-lg border border-white/10 bg-black p-8 text-center shadow-glow" role="alert">
          <p className="text-xs font-bold uppercase tracking-[0.25em] text-electric">Trading Boy</p>
          <h1 className="mt-4 text-3xl font-semibold">Something went wrong.</h1>
          <p className="mt-4 text-sm leading-relaxed text-white/65">The page could not be displayed. Refresh to try again.</p>
          <button type="button" onClick={() => window.location.reload()} className="mt-7 bg-electric px-6 py-4 text-xs font-bold uppercase tracking-widest text-black focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-electric">
            Refresh page
          </button>
        </section>
      </main>
    );
  }
}
