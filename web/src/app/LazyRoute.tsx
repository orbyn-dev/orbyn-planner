import { Component, lazy, Suspense, type ComponentType, type LazyExoticComponent, type ReactNode } from "react";

type Loader<P> = () => Promise<{ default: ComponentType<P> }>;
class RouteError extends Component<{ children: ReactNode; retry: () => void }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() {
    if (this.state.failed) return <div className="empty" role="alert">
      <h2>Couldn’t load this page</h2><button type="button" className="ghost" onClick={this.props.retry}>Try again</button>
    </div>;
    return this.props.children;
  }
}

/** A new component on retry clears React.lazy's cached rejection. */
export class LazyRoute<P extends object> extends Component<{ load: Loader<P>; pageProps: P }, { attempt: number; page: LazyExoticComponent<ComponentType<P>> }> {
  constructor(props: { load: Loader<P>; pageProps: P }) {
    super(props);
    this.state = { attempt: 0, page: lazy(props.load) };
  }
  componentDidUpdate(previous: { load: Loader<P> }) {
    if (previous.load !== this.props.load) this.retry();
  }
  private retry = () => this.setState((old) => ({ attempt: old.attempt + 1, page: lazy(this.props.load) }));
  render() {
    const Page = this.state.page;
    return <RouteError key={this.state.attempt} retry={this.retry}>
      <Suspense fallback={<div className="empty" role="status">Loading page…</div>}><Page {...this.props.pageProps} /></Suspense>
    </RouteError>;
  }
}
